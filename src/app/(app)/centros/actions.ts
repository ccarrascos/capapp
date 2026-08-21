"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCentroTrabajo(input: {
  organizacionId: string;
  nombre: string;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
}) {
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
