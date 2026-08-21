"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarManualCurso(input: {
  cursoId: string;
  campo: "manual_participante_path" | "manual_facilitador_path";
  path: string;
}) {
  const supabase = await createClient();
  const update =
    input.campo === "manual_participante_path"
      ? { manual_participante_path: input.path }
      : { manual_facilitador_path: input.path };
  const { error } = await supabase.from("cursos").update(update).eq("id", input.cursoId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}

export async function guardarMaterialModulo(input: { moduloId: string; cursoId: string; path: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("modulos")
    .update({ material_path: input.path })
    .eq("id", input.moduloId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}

export async function obtenerUrlFirmada(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("materiales").createSignedUrl(path, 300);

  if (error || !data) return { ok: false as const, mensaje: error?.message ?? "No se pudo generar el enlace." };

  return { ok: true as const, url: data.signedUrl };
}
