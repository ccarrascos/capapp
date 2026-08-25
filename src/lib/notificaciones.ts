import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Sesion } from "@/lib/auth";

/**
 * Genera (si hace falta) las notificaciones de vencimiento próximo/vencido
 * para quien gestiona la capacitación (admin_organizacion, prevencionista)
 * de las organizaciones de `sesion`. No depende de un cron: se ejecuta al
 * pedir las notificaciones, y el índice único (usuario_id, inscripcion_id,
 * tipo) evita duplicar la misma alerta en cada visita — sólo se crea una
 * vez por destinatario y por ciclo de aprobación del curso.
 */
export async function sincronizarNotificacionesVencimiento(
  supabase: SupabaseClient<Database>,
  sesion: Sesion,
) {
  if (sesion.esSuperAdmin) return;

  const orgsGestionadas = [
    ...new Set(
      sesion.roles
        .filter((r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId)
        .map((r) => r.organizacionId!),
    ),
  ];
  if (orgsGestionadas.length === 0) return;

  const { data: filas } = await supabase
    .from("matriz_vigencia_capacitacion")
    .select("persona_run, inscripcion_id, nombres, apellido_paterno, estado_vigencia, cursos(nombre)")
    .in("organizacion_id", orgsGestionadas)
    .in("estado_vigencia", ["por_vencer", "vencido"])
    .not("inscripcion_id", "is", null);

  if (!filas || filas.length === 0) return;

  const nuevas = filas.map((f) => ({
    usuario_id: sesion.usuarioId,
    persona_run: f.persona_run,
    inscripcion_id: f.inscripcion_id,
    tipo: (f.estado_vigencia === "vencido" ? "vencido" : "vencimiento_proximo") as Database["public"]["Enums"]["tipo_notificacion"],
    mensaje: `${f.nombres} ${f.apellido_paterno} — ${f.cursos?.nombre ?? "su curso"} ${
      f.estado_vigencia === "vencido" ? "venció" : "está por vencer"
    }.`,
  }));

  await supabase.from("notificaciones").upsert(nuevas, {
    onConflict: "usuario_id,inscripcion_id,tipo",
    ignoreDuplicates: true,
  });
}
