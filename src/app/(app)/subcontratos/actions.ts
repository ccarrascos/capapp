"use server";

import { revalidatePath } from "next/cache";
import { getSesion, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function autorizado(sesion: Sesion, organizacionId: string) {
  return (
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === organizacionId)
  );
}

export async function crearSubcontrato(input: {
  organizacionId: string;
  nombre: string;
  rut: string | null;
  centroTrabajoId: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar subcontratos." };
  }

  const supabase = await createClient();

  const { data: subcontrato, error } = await supabase
    .from("subcontratos")
    .insert({ organizacion_id: input.organizacionId, nombre: input.nombre, rut: input.rut })
    .select("id")
    .single();

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Ya existe un subcontrato con ese nombre en esta organización — asígnalo a otro centro en vez de crearlo de nuevo."
      : error.message;
    return { ok: false as const, mensaje };
  }

  const { error: errorAsignacion } = await supabase
    .from("subcontratos_centros")
    .insert({ subcontrato_id: subcontrato.id, centro_trabajo_id: input.centroTrabajoId });

  if (errorAsignacion) {
    await supabase.from("subcontratos").delete().eq("id", subcontrato.id);
    return { ok: false as const, mensaje: errorAsignacion.message };
  }

  revalidatePath("/subcontratos");
  return { ok: true as const };
}

export async function asignarCentroASubcontrato(input: {
  subcontratoId: string;
  organizacionId: string;
  centroTrabajoId: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar subcontratos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("subcontratos_centros")
    .insert({ subcontrato_id: input.subcontratoId, centro_trabajo_id: input.centroTrabajoId });

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Este subcontrato ya está asignado a ese centro."
      : error.message;
    return { ok: false as const, mensaje };
  }

  revalidatePath("/subcontratos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}
