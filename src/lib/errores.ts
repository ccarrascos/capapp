import "server-only";

type ErrorDb = { code?: string | null; message?: string | null };

const MENSAJES_POR_CODIGO: Record<string, string> = {
  "23505": "Ya existe un registro con esos datos.",
  "23503": "El registro está relacionado con otros datos y no se puede completar la operación.",
  "42501": "No tienes permiso para realizar esta acción.",
  "22P02": "Los datos enviados no son válidos.",
};

/**
 * Mensaje seguro para el cliente: el detalle de Postgres/Supabase (tablas,
 * constraints, políticas) queda sólo en el log del servidor.
 */
export function mensajeDeError(error: ErrorDb, contexto: string, porDefecto = "No se pudo completar la operación.") {
  console.error(`[${contexto}]`, error.code ?? "", error.message ?? "");
  return (error.code && MENSAJES_POR_CODIGO[error.code]) || porDefecto;
}
