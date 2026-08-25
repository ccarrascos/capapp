import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { centrosVisibles, type Sesion } from "@/lib/auth";

type FilaVigencia = {
  persona_run: string | null;
  inscripcion_id: string | null;
  organizacion_id: string | null;
  centro_trabajo_id: string | null;
  nombres: string | null;
  apellido_paterno: string | null;
  estado_vigencia: string | null;
  cursos: { nombre: string } | null;
};

function filaANotificacion(usuarioId: string, f: FilaVigencia, mensaje: string) {
  return {
    usuario_id: usuarioId,
    persona_run: f.persona_run,
    inscripcion_id: f.inscripcion_id,
    tipo: (f.estado_vigencia === "vencido" ? "vencido" : "vencimiento_proximo") as Database["public"]["Enums"]["tipo_notificacion"],
    mensaje,
  };
}

/**
 * Genera (si hace falta) las notificaciones de vencimiento próximo/vencido
 * para quien gestiona la capacitación: admin_organizacion y prevencionista
 * ven todo su organización; supervisor_centro sólo su centro asignado (o
 * toda la organización si no tiene uno asignado, igual que el resto de la
 * app). No depende de un cron: se ejecuta al pedir las notificaciones, y el
 * índice único (usuario_id, inscripcion_id, tipo) evita duplicar la misma
 * alerta en cada visita — sólo se crea una vez por destinatario y por
 * ciclo de aprobación del curso.
 */
async function sincronizarNotificacionesGestion(supabase: SupabaseClient<Database>, sesion: Sesion) {
  if (sesion.esSuperAdmin) return;

  const orgsConVisibilidad = [
    ...new Set(
      sesion.roles
        .filter(
          (r) =>
            (r.rol === "admin_organizacion" || r.rol === "prevencionista" || r.rol === "supervisor_centro") &&
            r.organizacionId,
        )
        .map((r) => r.organizacionId!),
    ),
  ];
  if (orgsConVisibilidad.length === 0) return;

  const { data: filas, error: errorLectura } = await supabase
    .from("matriz_vigencia_capacitacion")
    .select("persona_run, inscripcion_id, organizacion_id, centro_trabajo_id, nombres, apellido_paterno, estado_vigencia, cursos(nombre)")
    .in("organizacion_id", orgsConVisibilidad)
    .in("estado_vigencia", ["por_vencer", "vencido"])
    .not("inscripcion_id", "is", null);

  if (errorLectura) {
    console.error("sincronizarNotificacionesGestion: no se pudo leer la matriz de vigencia", errorLectura.message);
    return;
  }
  if (!filas || filas.length === 0) return;

  const filasVisibles = filas.filter((f) => {
    if (!f.organizacion_id) return false;
    const cv = centrosVisibles(sesion, f.organizacion_id);
    return cv === "todos" || (f.centro_trabajo_id != null && cv.includes(f.centro_trabajo_id));
  });
  if (filasVisibles.length === 0) return;

  const nuevas = filasVisibles.map((f) =>
    filaANotificacion(
      sesion.usuarioId,
      f,
      `${f.nombres} ${f.apellido_paterno} — ${f.cursos?.nombre ?? "su curso"} ${
        f.estado_vigencia === "vencido" ? "venció" : "está por vencer"
      }.`,
    ),
  );

  const { error: errorEscritura } = await supabase
    .from("notificaciones")
    .upsert(nuevas, { onConflict: "usuario_id,inscripcion_id,tipo", ignoreDuplicates: true });

  if (errorEscritura) {
    console.error("sincronizarNotificacionesGestion: no se pudieron guardar las notificaciones", errorEscritura.message);
  }
}

/** Un trabajador con portal propio se entera de su propio vencimiento próximo/vencido. */
async function sincronizarNotificacionesPropias(supabase: SupabaseClient<Database>, sesion: Sesion) {
  const esTrabajador = sesion.roles.some((r) => r.rol === "trabajador");
  if (!esTrabajador) return;

  const { data: persona } = await supabase
    .from("personas")
    .select("run")
    .eq("usuario_id", sesion.usuarioId)
    .maybeSingle();
  if (!persona) return;

  const { data: filas, error: errorLectura } = await supabase
    .from("matriz_vigencia_capacitacion")
    .select("persona_run, inscripcion_id, organizacion_id, centro_trabajo_id, nombres, apellido_paterno, estado_vigencia, cursos(nombre)")
    .eq("persona_run", persona.run)
    .in("estado_vigencia", ["por_vencer", "vencido"])
    .not("inscripcion_id", "is", null);

  if (errorLectura) {
    console.error("sincronizarNotificacionesPropias: no se pudo leer la matriz de vigencia", errorLectura.message);
    return;
  }
  if (!filas || filas.length === 0) return;

  const nuevas = filas.map((f) =>
    filaANotificacion(
      sesion.usuarioId,
      f,
      `Tu curso ${f.cursos?.nombre ?? ""} ${f.estado_vigencia === "vencido" ? "venció" : "está por vencer"}.`,
    ),
  );

  const { error: errorEscritura } = await supabase
    .from("notificaciones")
    .upsert(nuevas, { onConflict: "usuario_id,inscripcion_id,tipo", ignoreDuplicates: true });

  if (errorEscritura) {
    console.error("sincronizarNotificacionesPropias: no se pudieron guardar las notificaciones", errorEscritura.message);
  }
}

export async function sincronizarNotificaciones(supabase: SupabaseClient<Database>, sesion: Sesion) {
  await Promise.all([
    sincronizarNotificacionesGestion(supabase, sesion),
    sincronizarNotificacionesPropias(supabase, sesion),
  ]);
}
