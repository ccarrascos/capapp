"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Igual que autorizadoParaEdicion, pero además exige que el plazo de la
 * edición no haya vencido — se verifica en el servidor y no sólo ocultando
 * el botón en la interfaz, porque de lo contrario cualquiera podría seguir
 * llamando a la acción directamente después del plazo.
 */
async function verificarGestion(
  sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  edicionId: string,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  if (!(await autorizadoParaEdicion(sesion, supabase, edicionId))) {
    return { ok: false, mensaje: "No tienes permiso para gestionar esta edición." };
  }

  const { data: edicion } = await supabase
    .from("ediciones_curso")
    .select("fecha_limite")
    .eq("id", edicionId)
    .maybeSingle();

  if (edicion && edicion.fecha_limite < new Date().toISOString().slice(0, 10)) {
    return { ok: false, mensaje: "El plazo de esta edición venció — ya no se puede gestionar." };
  }

  return { ok: true };
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
    .select("organizacion_id, cursos(nombre)")
    .eq("id", edicionId)
    .maybeSingle();
  if (!edicion) return { ok: false as const, mensaje: "No se encontró la edición." };

  if (!(await autorizadoParaInscribir(sesion, edicionId, edicion.organizacion_id))) {
    return { ok: false as const, mensaje: "No tienes permiso para inscribir trabajadores en esta edición." };
  }

  const { data: insertadas, error } = await supabase
    .from("inscripciones")
    .insert(
      personaRuns.map((run) => ({
        edicion_id: edicionId,
        persona_run: run,
        estado: "inscrito" as const,
      })),
    )
    .select("id, persona_run");

  if (error) return { ok: false as const, mensaje: error.message };

  // Quien tiene portal propio se entera de que lo inscribieron en un curso.
  // Se usa el cliente admin porque la notificación queda a nombre del
  // trabajador, no de quien inscribe — ins_notificaciones sólo permite que
  // cada quien inserte las suyas.
  const admin = createAdminClient();
  const { data: personasConAcceso } = await admin
    .from("personas")
    .select("run, usuario_id")
    .in("run", personaRuns)
    .not("usuario_id", "is", null);

  const usuarioIdPorRun = new Map(
    (personasConAcceso ?? [])
      .filter((p): p is typeof p & { usuario_id: string } => p.usuario_id !== null)
      .map((p) => [p.run, p.usuario_id]),
  );

  const notificacionesNuevaInscripcion = (insertadas ?? [])
    .filter((i) => usuarioIdPorRun.has(i.persona_run))
    .map((i) => ({
      usuario_id: usuarioIdPorRun.get(i.persona_run)!,
      persona_run: i.persona_run,
      inscripcion_id: i.id,
      tipo: "nueva_inscripcion" as const,
      mensaje: `Fuiste inscrito en ${edicion.cursos?.nombre ?? "un curso"}.`,
    }));

  if (notificacionesNuevaInscripcion.length > 0) {
    await admin
      .from("notificaciones")
      .upsert(notificacionesNuevaInscripcion, { onConflict: "usuario_id,inscripcion_id,tipo", ignoreDuplicates: true });
  }

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

  const verificacion = await verificarGestion(sesion, supabase, input.edicionId);
  if (!verificacion.ok) return { ok: false as const, mensaje: verificacion.mensaje };

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

  const verificacion = await verificarGestion(sesion, supabase, input.edicionId);
  if (!verificacion.ok) return { ok: false as const, mensaje: verificacion.mensaje };

  let personaRun: string | null = null;
  let cursoNombre: string | null = null;

  if (input.aprobado) {
    const [{ data: inscripcion }, { data: edicion }] = await Promise.all([
      supabase
        .from("inscripciones")
        .select("persona_run, manual_entregado, asistencias_modulo(presente)")
        .eq("id", input.inscripcionId)
        .single(),
      supabase.from("ediciones_curso").select("curso_id, cursos(nombre)").eq("id", input.edicionId).single(),
    ]);

    if (!inscripcion || !edicion) {
      return { ok: false as const, mensaje: "No se pudo verificar la inscripción." };
    }

    personaRun = inscripcion.persona_run;
    cursoNombre = edicion.cursos?.nombre ?? null;

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

  // Igual que al inscribir: quien tiene portal propio se entera de que fue
  // aprobado. Cliente admin porque la notificación es para el trabajador,
  // no para quien evalúa.
  if (input.aprobado && personaRun) {
    const admin = createAdminClient();
    const { data: persona } = await admin
      .from("personas")
      .select("usuario_id")
      .eq("run", personaRun)
      .maybeSingle();

    if (persona?.usuario_id) {
      await admin.from("notificaciones").upsert(
        {
          usuario_id: persona.usuario_id,
          persona_run: personaRun,
          inscripcion_id: input.inscripcionId,
          tipo: "curso_finalizado",
          mensaje: `Fuiste aprobado en ${cursoNombre ?? "tu curso"}.`,
        },
        { onConflict: "usuario_id,inscripcion_id,tipo", ignoreDuplicates: true },
      );
    }
  }

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

  const verificacion = await verificarGestion(sesion, supabase, input.edicionId);
  if (!verificacion.ok) return { ok: false as const, mensaje: verificacion.mensaje };

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
    .select("organizacion_id, cursos(nombre), facilitadores(tipo_proveedor, oal_id, otec_id)")
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

  // Le avisamos al trabajador que su certificado ya está disponible —
  // aparte del aviso de aprobación, porque la emisión suele pasar más tarde.
  const admin = createAdminClient();
  const { data: persona } = await admin
    .from("personas")
    .select("usuario_id")
    .eq("run", input.personaRun)
    .maybeSingle();

  if (persona?.usuario_id) {
    await admin.from("notificaciones").upsert(
      {
        usuario_id: persona.usuario_id,
        persona_run: input.personaRun,
        inscripcion_id: input.inscripcionId,
        tipo: "certificado_emitido",
        mensaje: `Tu certificado de ${edicion.cursos?.nombre ?? "tu curso"} ya está disponible.`,
      },
      { onConflict: "usuario_id,inscripcion_id,tipo", ignoreDuplicates: true },
    );
  }

  revalidatePath(`/ediciones/${input.edicionId}`);
  return { ok: true as const };
}
