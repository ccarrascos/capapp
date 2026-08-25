import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type RolNombre = Database["public"]["Enums"]["rol_nombre"];

export type AsignacionRol = {
  rol: RolNombre;
  nivelJerarquico: number;
  organizacionId: string | null;
  organizacionNombre: string | null;
  centroTrabajoId: string | null;
};

export type Sesion = {
  usuarioId: string;
  nombres: string;
  apellidos: string;
  email: string;
  avatarUrl: string | null;
  roles: AsignacionRol[];
  esSuperAdmin: boolean;
  organizacionesIds: string[];
  rolPrincipal: RolNombre;
};

/** Sesión del usuario autenticado, o null si no hay sesión. Server-only. */
export async function getSesion(): Promise<Sesion | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: usuario }, { data: asignaciones }] = await Promise.all([
    supabase.from("usuarios").select("*").eq("id", user.id).single(),
    supabase
      .from("usuario_roles")
      .select(
        "organizacion_id, centro_trabajo_id, roles(nombre, nivel_jerarquico), organizaciones(razon_social, activo)",
      )
      .eq("usuario_id", user.id),
  ]);

  if (!usuario) return null;

  // Una organización desactivada (ej. por falta de pago) le retira el
  // acceso a todos sus roles — no sólo visualmente, acá mismo, para que
  // toda verificación de rol/organización en cualquier página deje de
  // encontrar ese rol automáticamente, sin tener que tocar cada página.
  const roles: AsignacionRol[] = (asignaciones ?? [])
    .filter((a) => a.roles)
    .filter((a) => a.organizacion_id === null || a.organizaciones?.activo !== false)
    .map((a) => ({
      rol: a.roles!.nombre,
      nivelJerarquico: a.roles!.nivel_jerarquico,
      organizacionId: a.organizacion_id,
      organizacionNombre: a.organizaciones?.razon_social ?? null,
      centroTrabajoId: a.centro_trabajo_id,
    }));

  const esSuperAdmin = roles.some((r) => r.rol === "super_admin");
  const organizacionesIds = [
    ...new Set(roles.map((r) => r.organizacionId).filter((v): v is string => !!v)),
  ];
  const rolPrincipal =
    [...roles].sort((a, b) => b.nivelJerarquico - a.nivelJerarquico)[0]?.rol ?? "trabajador";

  return {
    usuarioId: usuario.id,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    avatarUrl: usuario.avatar_url,
    roles,
    esSuperAdmin,
    organizacionesIds,
    rolPrincipal,
  };
}

export function tieneRol(sesion: Sesion, rol: RolNombre) {
  return sesion.esSuperAdmin || sesion.roles.some((r) => r.rol === rol);
}

/**
 * Qué centros de trabajo de una organización puede ver `sesion`: "todos" si
 * tiene un rol de alcance completo en esa organización (admin_organizacion,
 * prevencionista, auditor o super_admin), o la lista puntual de centros si
 * sólo tiene el rol supervisor_centro. Una asignación de supervisor_centro
 * sin centro asignado (legado, o creada sin especificar uno) se trata como
 * "todos" — no restringe hasta que se le asigne un centro puntual.
 */
export function centrosVisibles(sesion: Sesion, organizacionId: string): "todos" | string[] {
  if (sesion.esSuperAdmin) return "todos";

  const rolesEnOrg = sesion.roles.filter((r) => r.organizacionId === organizacionId);
  const tieneAccesoCompleto = rolesEnOrg.some(
    (r) => r.rol === "admin_organizacion" || r.rol === "prevencionista" || r.rol === "auditor",
  );
  if (tieneAccesoCompleto) return "todos";

  const centros = rolesEnOrg.filter((r) => r.rol === "supervisor_centro").map((r) => r.centroTrabajoId);
  if (centros.length === 0 || centros.some((c) => c === null)) return "todos";
  return centros as string[];
}
