"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCargo(input: { organizacionId: string; nombre: string }) {
  const supabase = await createClient();

  const { error } = await supabase.from("cargos").insert({
    organizacion_id: input.organizacionId,
    nombre: input.nombre,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/cargos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}

export async function actualizarActivoCargo(input: { cargoId: string; activo: boolean }) {
  const supabase = await createClient();

  const { error } = await supabase.from("cargos").update({ activo: input.activo }).eq("id", input.cargoId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/cargos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}
