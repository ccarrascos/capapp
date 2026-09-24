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

export const CLAVES_POR_ORGANIZACION = [
  "vigencia_por_vencer_dias",
  "curso_horas_minimas",
  "edicion_plazo_maximo_meses",
] as const;
export type ClavePorOrganizacion = (typeof CLAVES_POR_ORGANIZACION)[number];
export type ConfiguracionOrganizacion = Record<ClavePorOrganizacion, number>;
type AjustesOrganizacion = Record<ClavePorOrganizacion, number | null>;

let cacheOrgs: { porOrg: Map<string, AjustesOrganizacion>; expiraEn: number } | null = null;

async function ajustesDeOrganizaciones(): Promise<Map<string, AjustesOrganizacion>> {
  if (cacheOrgs && cacheOrgs.expiraEn > Date.now()) return cacheOrgs.porOrg;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizaciones")
    .select("id, vigencia_por_vencer_dias, curso_horas_minimas, edicion_plazo_maximo_meses");
  const porOrg = new Map((data ?? []).map((o) => [o.id, o]));
  cacheOrgs = { porOrg, expiraEn: Date.now() + TTL_MS };
  return porOrg;
}

/**
 * Valor efectivo para una organización: su ajuste propio o, si no tiene, el
 * de la plataforma. Las horas nunca bajan del mínimo de la plataforma ni el
 * plazo sube del máximo, aunque la plataforma cambie después de guardarlos.
 */
export async function obtenerConfiguracionOrganizacion(
  organizacionId: string | null,
): Promise<ConfiguracionOrganizacion> {
  const [global, porOrg] = await Promise.all([obtenerConfiguracion(), ajustesDeOrganizaciones()]);
  const propio = organizacionId ? porOrg.get(organizacionId) : undefined;
  return {
    vigencia_por_vencer_dias: propio?.vigencia_por_vencer_dias ?? global.vigencia_por_vencer_dias,
    curso_horas_minimas: Math.max(propio?.curso_horas_minimas ?? 0, global.curso_horas_minimas),
    edicion_plazo_maximo_meses: Math.min(
      propio?.edicion_plazo_maximo_meses ?? Infinity,
      global.edicion_plazo_maximo_meses,
    ),
  };
}

export function invalidarCacheConfiguracionOrganizaciones() {
  cacheOrgs = null;
}

/** Ventana "por vencer" si todas esas organizaciones usan la misma; null si difieren. */
export async function ventanaPorVencerComun(organizacionIds: string[]): Promise<number | null> {
  const unicas = [...new Set(organizacionIds)];
  if (unicas.length === 0) return (await obtenerConfiguracion()).vigencia_por_vencer_dias;
  const ventanas = new Set(
    await Promise.all(unicas.map(async (id) => (await obtenerConfiguracionOrganizacion(id)).vigencia_por_vencer_dias)),
  );
  return ventanas.size === 1 ? [...ventanas][0] : null;
}
