import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { centrosVisibles, type Sesion } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import { rolPuedeTenerPermiso, type AccionPermiso } from "@/lib/permisos-catalogo";

let cache: { revocados: Set<string>; expiraEn: number } | null = null;

const llave = (rol: string, accion: string) => `${rol}:${accion}`;

export async function obtenerPermisosRevocados(): Promise<Set<string>> {
  if (cache && cache.expiraEn > Date.now()) return cache.revocados;
  const admin = createAdminClient();
  const { data, error } = await admin.from("permisos_revocados").select("rol, accion");
  // Si la tabla aún no existe (migración pendiente) se comporta como hoy:
  // sin revocaciones, cada rol conserva los permisos del catálogo.
  const revocados = new Set(error ? [] : (data ?? []).map((f) => llave(f.rol, f.accion)));
  cache = { revocados, expiraEn: Date.now() + 30_000 };
  return revocados;
}

export function invalidarCachePermisos() {
  cache = null;
}

/**
 * ¿La sesión puede hacer `accion` en esa organización? super_admin siempre
 * puede - así nadie queda sin forma de revertir una revocación.
 */
export async function tienePermiso(
  sesion: Sesion,
  accion: AccionPermiso,
  organizacionId: string | null,
): Promise<boolean> {
  if (sesion.esSuperAdmin) return true;
  if (!organizacionId) return false;
  const revocados = await obtenerPermisosRevocados();
  return sesion.roles.some(
    (r) =>
      r.organizacionId === organizacionId &&
      rolPuedeTenerPermiso(accion, r.rol) &&
      !revocados.has(llave(r.rol, accion)),
  );
}

/** Organizaciones donde la sesión tiene `accion` (no aplica a super_admin, que las tiene todas). */
export async function organizacionesConPermiso(sesion: Sesion, accion: AccionPermiso) {
  const revocados = await obtenerPermisosRevocados();
  const orgs = new Map<string, { id: string; razon_social: string }>();
  for (const r of sesion.roles) {
    if (r.organizacionId && rolPuedeTenerPermiso(accion, r.rol) && !revocados.has(llave(r.rol, accion))) {
      orgs.set(r.organizacionId, { id: r.organizacionId, razon_social: r.organizacionNombre ?? "" });
    }
  }
  return [...orgs.values()];
}

export async function tienePermisoEnAlgunaOrg(sesion: Sesion, accion: AccionPermiso): Promise<boolean> {
  if (sesion.esSuperAdmin) return true;
  return (await organizacionesConPermiso(sesion, accion)).length > 0;
}

/**
 * Ver un certificado: su dueño, o quien tenga certificados.ver en la
 * organización. Un supervisor_centro sólo ve los de trabajadores de su
 * centro, igual que en la matriz (RLS de certificados abarca toda la org).
 */
export async function puedeVerCertificado(
  sesion: Sesion,
  supabase: Awaited<ReturnType<typeof createClient>>,
  certificado: { organizacionId: string | null; personaRun: string; duenoUsuarioId: string | null },
): Promise<boolean> {
  if (sesion.esSuperAdmin || certificado.duenoUsuarioId === sesion.usuarioId) return true;
  const { organizacionId } = certificado;
  if (!organizacionId || !(await tienePermiso(sesion, "certificados.ver", organizacionId))) return false;

  const centros = centrosVisibles(sesion, organizacionId);
  if (centros === "todos") return true;
  const { data: vinculo } = await supabase
    .from("vinculos_laborales")
    .select("centro_trabajo_id")
    .eq("persona_run", certificado.personaRun)
    .eq("organizacion_id", organizacionId)
    .maybeSingle();
  return !!vinculo?.centro_trabajo_id && centros.includes(vinculo.centro_trabajo_id);
}
