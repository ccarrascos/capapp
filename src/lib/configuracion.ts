import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULTS_CONFIGURACION = {
  password_temporal_horas: 72,
  recuperacion_throttle_minutos: 5,
  login_max_intentos: 5,
  login_bloqueo_minutos: 15,
  edad_minima_trabajador: 18,
  vigencia_por_vencer_dias: 60,
  certificado_vigencia_anios: 2,
  curso_horas_minimas: 8,
  edicion_plazo_maximo_meses: 3,
  max_mb_logo_organizacion: 2,
  max_mb_avatar_usuario: 3,
  max_mb_materiales_curso: 20,
} as const;

export type ClaveConfiguracion = keyof typeof DEFAULTS_CONFIGURACION;
export type ConfiguracionPlataforma = { [K in ClaveConfiguracion]: number };

const TTL_MS = 30 * 1000;
let cache: { datos: ConfiguracionPlataforma; expiraEn: number } | null = null;

export async function obtenerConfiguracion(): Promise<ConfiguracionPlataforma> {
  if (cache && cache.expiraEn > Date.now()) return cache.datos;

  const admin = createAdminClient();
  const { data } = await admin.from("configuracion_plataforma").select("clave, valor");

  const resultado: ConfiguracionPlataforma = { ...DEFAULTS_CONFIGURACION };
  for (const fila of data ?? []) {
    const clave = fila.clave as ClaveConfiguracion;
    if (clave in resultado && typeof fila.valor === "number") {
      resultado[clave] = fila.valor;
    }
  }

  cache = { datos: resultado, expiraEn: Date.now() + TTL_MS };
  return resultado;
}

/** Se llama después de cualquier update en configuracion_plataforma, para que el panel refleje el cambio de inmediato en vez de esperar el TTL de la caché. */
export function invalidarCacheConfiguracion() {
  cache = null;
}
