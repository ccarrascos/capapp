import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

/**
 * Deja rastro de un cambio sensible (rol, acceso, activación) en
 * auditoria_log, atribuido a quien lo hizo. Se usa el mismo cliente con
 * RLS de la acción que llama — ins_auditoria sólo permite insertar filas
 * con `usuario_id = auth.uid()`, así que nadie puede registrar una acción
 * a nombre de otra persona. Si la escritura falla (ej. sesión ya cerrada
 * a mitad de la función), no se interrumpe la acción principal — la
 * auditoría es un registro adicional, no una condición para que el
 * cambio en sí sea válido.
 */
export async function registrarAuditoria(
  supabase: SupabaseClient<Database>,
  input: {
    usuarioId: string;
    accion: string;
    tabla: string;
    registroId?: string | null;
    datosAnteriores?: unknown;
    datosNuevos?: unknown;
  },
) {
  await supabase.from("auditoria_log").insert({
    usuario_id: input.usuarioId,
    accion: input.accion,
    tabla: input.tabla,
    registro_id: input.registroId ?? null,
    datos_anteriores: (input.datosAnteriores ?? null) as Json,
    datos_nuevos: (input.datosNuevos ?? null) as Json,
  });
}
