"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";
import { esUuid } from "@/lib/validar";
import { mensajeDeError } from "@/lib/errores";

const NOMBRE_ARCHIVO = "(manual-participante|manual-facilitador|material)\\.(pdf|docx?|pptx?)";
const PATH_CURSO_RE = new RegExp(`^([0-9a-f-]{36})/cursos/([0-9a-f-]{36})/${NOMBRE_ARCHIVO}$`, "i");
const PATH_MODULO_RE = new RegExp(`^([0-9a-f-]{36})/cursos/([0-9a-f-]{36})/modulos/([0-9a-f-]{36})/${NOMBRE_ARCHIVO}$`, "i");

function parsearPath(path: unknown) {
  if (typeof path !== "string" || path.length > 300) return null;
  const modulo = PATH_MODULO_RE.exec(path);
  if (modulo) return { orgId: modulo[1], cursoId: modulo[2], moduloId: modulo[3] as string | null, archivo: modulo[4] };
  const curso = PATH_CURSO_RE.exec(path);
  if (curso) return { orgId: curso[1], cursoId: curso[2], moduloId: null as string | null, archivo: curso[3] };
  return null;
}

async function autorizadoParaCurso(supabase: Awaited<ReturnType<typeof createClient>>, cursoId: string) {
  if (!esUuid(cursoId)) return null;
  const sesion = await getSesion();
  if (!sesion) return null;

  const { data: curso } = await supabase.from("cursos").select("organizacion_id").eq("id", cursoId).maybeSingle();
  if (!curso) return null;
  if (sesion.esSuperAdmin) return curso;

  return (await tienePermiso(sesion, "cursos.gestionar", curso.organizacion_id)) ? curso : null;
}

const NO_PERMISO = { ok: false as const, mensaje: "No tienes permiso para editar este curso." };
const PATH_INVALIDO = { ok: false as const, mensaje: "El archivo no es válido." };

export async function guardarManualCurso(input: {
  cursoId: string;
  campo: "manual_participante_path" | "manual_facilitador_path";
  path: string;
}) {
  const supabase = await createClient();

  const curso = await autorizadoParaCurso(supabase, input?.cursoId);
  if (!curso) return NO_PERMISO;

  if (input.campo !== "manual_participante_path" && input.campo !== "manual_facilitador_path") return PATH_INVALIDO;
  const parsed = parsearPath(input.path);
  if (
    !parsed ||
    parsed.moduloId ||
    parsed.orgId !== curso.organizacion_id ||
    parsed.cursoId !== input.cursoId ||
    parsed.archivo !== (input.campo === "manual_participante_path" ? "manual-participante" : "manual-facilitador")
  ) {
    return PATH_INVALIDO;
  }

  const update =
    input.campo === "manual_participante_path"
      ? { manual_participante_path: input.path }
      : { manual_facilitador_path: input.path };
  const { data, error } = await supabase.from("cursos").update(update).eq("id", input.cursoId).select("id");

  if (error) return { ok: false as const, mensaje: mensajeDeError(error, "guardarManualCurso") };
  if (!data?.length) return NO_PERMISO;

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}

export async function guardarMaterialModulo(input: { moduloId: string; cursoId: string; path: string }) {
  const supabase = await createClient();

  const curso = await autorizadoParaCurso(supabase, input?.cursoId);
  if (!curso) return NO_PERMISO;

  const parsed = parsearPath(input.path);
  if (
    !esUuid(input.moduloId) ||
    !parsed ||
    parsed.moduloId !== input.moduloId ||
    parsed.orgId !== curso.organizacion_id ||
    parsed.cursoId !== input.cursoId ||
    parsed.archivo !== "material"
  ) {
    return PATH_INVALIDO;
  }

  // Sin el .eq("curso_id", ...) esto actualizaba cualquier módulo por id,
  // sin importar a qué curso perteneciera realmente.
  const { data, error } = await supabase
    .from("modulos")
    .update({ material_path: input.path })
    .eq("id", input.moduloId)
    .eq("curso_id", input.cursoId)
    .select("id");

  if (error) return { ok: false as const, mensaje: mensajeDeError(error, "guardarMaterialModulo") };
  if (!data || data.length === 0) {
    return { ok: false as const, mensaje: "El módulo no corresponde a este curso." };
  }

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}

export async function obtenerUrlFirmada(path: string) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const parsed = parsearPath(path);
  if (!parsed) return PATH_INVALIDO;

  const supabase = await createClient();

  // El path debe ser exactamente el que el curso/módulo tiene registrado
  // (nunca uno arbitrario del cliente) y estar en una organización del usuario.
  const { data: curso } = await supabase
    .from("cursos")
    .select("id, organizacion_id, manual_participante_path, manual_facilitador_path")
    .eq("id", parsed.cursoId)
    .maybeSingle();
  if (!curso || curso.organizacion_id !== parsed.orgId) return PATH_INVALIDO;

  let registrado = curso.manual_participante_path === path || curso.manual_facilitador_path === path;
  if (!registrado && parsed.moduloId) {
    const { data: modulo } = await supabase
      .from("modulos")
      .select("id")
      .eq("id", parsed.moduloId)
      .eq("curso_id", parsed.cursoId)
      .eq("material_path", path)
      .maybeSingle();
    registrado = !!modulo;
  }
  if (!registrado) return PATH_INVALIDO;

  // El material de uso interno (manual del facilitador, material didáctico)
  // no es para el rol trabajador; sólo el manual del participante lo es.
  if (!sesion.esSuperAdmin && parsed.archivo !== "manual-participante") {
    const rolesEnOrg = sesion.roles.filter((r) => r.organizacionId === parsed.orgId);
    if (rolesEnOrg.length === 0 || rolesEnOrg.every((r) => r.rol === "trabajador")) return NO_PERMISO_VER;
  }

  const { data, error } = await supabase.storage.from("materiales").createSignedUrl(path, 300);
  if (error || !data) return { ok: false as const, mensaje: "No se pudo generar el enlace." };

  return { ok: true as const, url: data.signedUrl };
}

const NO_PERMISO_VER = { ok: false as const, mensaje: "No tienes permiso para ver este material." };
