"use server";

import { revalidatePath } from "next/cache";
import { getSesion, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function autorizado(sesion: Sesion, organizacionId: string) {
  return (
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === organizacionId,
    )
  );
}

export async function crearCentroTrabajo(input: {
  organizacionId: string;
  nombre: string;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar centros de trabajo." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("centros_trabajo").insert({
    organizacion_id: input.organizacionId,
    nombre: input.nombre,
    direccion: input.direccion,
    comuna: input.comuna,
    region: input.region,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/centros");
  return { ok: true as const };
}

export async function actualizarCentroTrabajo(input: {
  centroId: string;
  organizacionId: string;
  nombre: string;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar centros de trabajo." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("centros_trabajo")
    .update({
      nombre: input.nombre,
      direccion: input.direccion,
      comuna: input.comuna,
      region: input.region,
    })
    .eq("id", input.centroId)
    .eq("organizacion_id", input.organizacionId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/centros");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}

export async function actualizarActivoCentroTrabajo(input: {
  centroId: string;
  organizacionId: string;
  activo: boolean;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar centros de trabajo." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("centros_trabajo")
    .update({ activo: input.activo })
    .eq("id", input.centroId)
    .eq("organizacion_id", input.organizacionId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/centros");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}
