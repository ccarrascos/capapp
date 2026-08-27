"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

async function autorizadoParaCurso(supabase: Awaited<ReturnType<typeof createClient>>, cursoId: string) {
  const sesion = await getSesion();
  if (!sesion) return false;
  if (sesion.esSuperAdmin) return true;

  const { data: curso } = await supabase.from("cursos").select("organizacion_id").eq("id", cursoId).maybeSingle();
  if (!curso) return false;

  return sesion.roles.some(
    (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === curso.organizacion_id,
  );
}

export async function guardarManualCurso(input: {
  cursoId: string;
  campo: "manual_participante_path" | "manual_facilitador_path";
  path: string;
}) {
  const supabase = await createClient();

  if (!(await autorizadoParaCurso(supabase, input.cursoId))) {
    return { ok: false as const, mensaje: "No tienes permiso para editar este curso." };
  }

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

  if (!(await autorizadoParaCurso(supabase, input.cursoId))) {
    return { ok: false as const, mensaje: "No tienes permiso para editar este curso." };
  }

  // Sin el .eq("curso_id", ...) esto actualizaba cualquier módulo por id,
  // sin importar a qué curso perteneciera realmente.
  const { data, error } = await supabase
    .from("modulos")
    .update({ material_path: input.path })
    .eq("id", input.moduloId)
    .eq("curso_id", input.cursoId)
    .select("id");

  if (error) return { ok: false as const, mensaje: error.message };
  if (!data || data.length === 0) {
    return { ok: false as const, mensaje: "El módulo no corresponde a este curso." };
  }

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}

export async function obtenerUrlFirmada(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("materiales").createSignedUrl(path, 300);

  if (error || !data) return { ok: false as const, mensaje: error?.message ?? "No se pudo generar el enlace." };

  return { ok: true as const, url: data.signedUrl };
}
