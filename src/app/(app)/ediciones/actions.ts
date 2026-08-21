"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function inscribirTrabajadores(edicionId: string, personaRuns: string[]) {
  if (personaRuns.length === 0) return { ok: false as const, mensaje: "Selecciona al menos un trabajador." };

  const supabase = await createClient();
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
  const supabase = await createClient();

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

  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

  const numeroCertificado = `DS44-${input.personaRun}-${Date.now().toString(36).toUpperCase()}`;

  const { data: edicion } = await supabase
    .from("ediciones_curso")
    .select("facilitadores(tipo_proveedor, oal_id, otec_id)")
    .eq("id", input.edicionId)
    .single();

  const facilitador = edicion?.facilitadores;
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
