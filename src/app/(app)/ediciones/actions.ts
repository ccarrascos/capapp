"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

/**
 * Gestionar una edición (inscribir, tomar asistencia, evaluar, certificar) requiere
 * ser admin/prevencionista de la organización dueña de la edición, o el facilitador
 * a cargo de esa edición puntual. Se verifica en la app además de en RLS porque estas
 * acciones producen el registro de cumplimiento del DS 44 — no basta con confiar en
 * la política de base de datos como única barrera.
 */
async function autorizadoParaEdicion(
  sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  edicionId: string,
) {
  const { data: edicion } = await supabase
    .from("ediciones_curso")
    .select("organizacion_id, facilitador_id")
    .eq("id", edicionId)
    .maybeSingle();

  if (!edicion) return false;
  if (sesion.esSuperAdmin) return true;

  const esAdminOrgOPrevencionista = sesion.roles.some(
    (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === edicion.organizacion_id,
  );
  if (esAdminOrgOPrevencionista) return true;

  if (edicion.facilitador_id) {
    const { data: miFacilitador } = await supabase
      .from("facilitadores")
      .select("id")
      .eq("usuario_id", sesion.usuarioId)
      .maybeSingle();
    if (miFacilitador?.id === edicion.facilitador_id) return true;
  }

  return false;
}

/** Sólo admin/prevencionista deciden quién toma un curso — no el facilitador que lo dicta. */
async function autorizadoParaInscribir(
  sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>,
  edicionId: string,
  organizacionId: string,
) {
  if (sesion.esSuperAdmin) return true;
  return sesion.roles.some(
    (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === organizacionId,
  );
}

export async function inscribirTrabajadores(edicionId: string, personaRuns: string[]) {
  if (personaRuns.length === 0) return { ok: false as const, mensaje: "Selecciona al menos un trabajador." };

  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();

  const { data: edicion } = await supabase
    .from("ediciones_curso")
    .select("organizacion_id")
    .eq("id", edicionId)
    .maybeSingle();
  if (!edicion) return { ok: false as const, mensaje: "No se encontró la edición." };

  if (!(await autorizadoParaInscribir(sesion, edicionId, edicion.organizacion_id))) {
    return { ok: false as const, mensaje: "No tienes permiso para inscribir trabajadores en esta edición." };
  }

  const { error } = await supabase.from("inscripciones").insert(
    personaRuns.map((run) => ({
      edicion_id: edicionId,
      persona_run: run,
      estado: "inscrito" as const,
    })),
  );

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/ediciones/${edicionId}`);
  return { ok: true as const };
}

export async function registrarAsistenciaModulo(input: {
  inscripcionId: string;
  moduloId: string;
  fecha: string;
  presente: boolean;
  edicionId: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();

  if (!(await autorizadoParaEdicion(sesion, supabase, input.edicionId))) {
    return { ok: false as const, mensaje: "No tienes permiso para registrar asistencia en esta edición." };
  }

  const { error } = await supabase
    .from("asistencias_modulo")
    .upsert(
      {
        inscripcion_id: input.inscripcionId,
        modulo_id: input.moduloId,
        fecha: input.fecha,
        presente: input.presente,
      },
      { onConflict: "inscripcion_id,modulo_id" },
    );

  if (error) return { ok: false as const, mensaje: error.message };

  const { error: errorEstado } = await supabase
    .from("inscripciones")
    .update({ estado: "en_progreso" })
    .eq("id", input.inscripcionId)
    .eq("estado", "inscrito");

  void errorEstado;

  revalidatePath(`/ediciones/${input.edicionId}`);
  return { ok: true as const };
}

export async function registrarEvaluacionFinal(input: {
  inscripcionId: string;
  edicionId: string;
  puntaje: number;
  aprobado: boolean;
}) {
  if (!Number.isInteger(input.puntaje) || input.puntaje < 0 || input.puntaje > 100) {
    return { ok: false as const, mensaje: "El puntaje debe ser un número entero entre 0 y 100." };
  }

  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();

  if (!(await autorizadoParaEdicion(sesion, supabase, input.edicionId))) {
    return { ok: false as const, mensaje: "No tienes permiso para evaluar en esta edición." };
  }

  if (input.aprobado) {
    const [{ data: inscripcion }, { data: edicion }] = await Promise.all([
      supabase
        .from("inscripciones")
        .select("manual_entregado, asistencias_modulo(presente)")
        .eq("id", input.inscripcionId)
        .single(),
      supabase.from("ediciones_curso").select("curso_id").eq("id", input.edicionId).single(),
    ]);

    if (!inscripcion || !edicion) {
      return { ok: false as const, mensaje: "No se pudo verificar la inscripción." };
    }

    const { count: totalModulos } = await supabase
      .from("modulos")
      .select("id", { count: "exact", head: true })
      .eq("curso_id", edicion.curso_id);

    const modulosConAsistencia = inscripcion.asistencias_modulo.filter((a) => a.presente).length;

    if (!totalModulos || modulosConAsistencia < totalModulos) {
      return { ok: false as const, mensaje: "Debes registrar la asistencia de todos los módulos antes de aprobar." };
    }

    if (!inscripcion.manual_entregado) {
      return { ok: false as const, mensaje: "Debes registrar la entrega del manual del participante antes de aprobar." };
    }
  }

  const { error: errorEval } = await supabase.from("evaluaciones_resultado").insert({
    inscripcion_id: input.inscripcionId,
    modulo_id: null,
    puntaje: input.puntaje,
    aprobado: input.aprobado,
  });

  if (errorEval) return { ok: false as const, mensaje: errorEval.message };

  const { error: errorInscripcion } = await supabase
    .from("inscripciones")
    .update({
      estado: input.aprobado ? "aprobado" : "reprobado",
      fecha_aprobacion: input.aprobado ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", input.inscripcionId);

  if (errorInscripcion) return { ok: false as const, mensaje: errorInscripcion.message };

  revalidatePath(`/ediciones/${input.edicionId}`);
  revalidatePath("/trabajadores");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function marcarManualEntregado(input: {
  inscripcionId: string;
  edicionId: string;
  entregado: boolean;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();

  if (!(await autorizadoParaEdicion(sesion, supabase, input.edicionId))) {
    return { ok: false as const, mensaje: "No tienes permiso para registrar esto en esta edición." };
  }

  const { error } = await supabase
    .from("inscripciones")
    .update({
      manual_entregado: input.entregado,
      manual_entregado_fecha: input.entregado ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", input.inscripcionId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/ediciones/${input.edicionId}`);
  return { ok: true as const };
}

export async function emitirCertificado(input: {
  inscripcionId: string;
  personaRun: string;
  cursoId: string;
  edicionId: string;
  vigenciaHasta: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();

  const { data: edicion } = await supabase
    .from("ediciones_curso")
    .select("organizacion_id, facilitadores(tipo_proveedor, oal_id, otec_id)")
    .eq("id", input.edicionId)
    .single();

  if (!edicion) return { ok: false as const, mensaje: "No se encontró la edición." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === edicion.organizacion_id,
    );
  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para emitir certificados en esta edición." };
  }

  const numeroCertificado = `DS44-${input.personaRun}-${Date.now().toString(36).toUpperCase()}`;

  const facilitador = edicion.facilitadores;
  const entidadEmisoraTipo = facilitador?.tipo_proveedor === "oal" || facilitador?.tipo_proveedor === "otec"
    ? facilitador.tipo_proveedor
    : "empleador";
  const entidadEmisoraId = facilitador?.oal_id ?? facilitador?.otec_id ?? null;

  const { error } = await supabase.from("certificados").insert({
    inscripcion_id: input.inscripcionId,
    persona_run: input.personaRun,
    curso_id: input.cursoId,
    numero_certificado: numeroCertificado,
    fecha_vigencia_hasta: input.vigenciaHasta,
    entidad_emisora_tipo: entidadEmisoraTipo,
    entidad_emisora_id: entidadEmisoraId,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/ediciones/${input.edicionId}`);
  return { ok: true as const };
}
