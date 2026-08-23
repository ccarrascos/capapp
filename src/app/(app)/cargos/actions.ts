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

export async function crearCargo(input: { organizacionId: string; nombre: string }) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar cargos." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("cargos").insert({
    organizacion_id: input.organizacionId,
    nombre: input.nombre,
  });

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Ya existe un cargo con ese nombre en esta organización."
      : error.message;
    return { ok: false as const, mensaje };
  }

  revalidatePath("/cargos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}

export async function actualizarCargo(input: { cargoId: string; organizacionId: string; nombre: string }) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar cargos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cargos")
    .update({ nombre: input.nombre })
    .eq("id", input.cargoId)
    .eq("organizacion_id", input.organizacionId);

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Ya existe otro cargo con ese nombre en esta organización."
      : error.message;
    return { ok: false as const, mensaje };
  }

  revalidatePath("/cargos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}

export async function actualizarActivoCargo(input: { cargoId: string; organizacionId: string; activo: boolean }) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar cargos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cargos")
    .update({ activo: input.activo })
    .eq("id", input.cargoId)
    .eq("organizacion_id", input.organizacionId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/cargos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}
