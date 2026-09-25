"use server";

import { getSesion } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { ROL_LABEL } from "@/lib/roles";

export type IdentidadEncontrada = {
  /** "persona" trae los apellidos separados; en cuenta y facilitador vienen juntos y se separan por el primer espacio. */
  fuente: "persona" | "cuenta" | "facilitador";
  dv: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  /** Sólo si la persona pertenece a una organización de quien consulta. */
  email: string | null;
  fechaNacimiento: string | null;
  sexo: "masculino" | "femenino" | "otro" | null;
  tieneCuenta: boolean;
  /** Roles de la cuenta en las organizaciones de quien consulta. */
  roles: string[];
  /** Organizaciones de quien consulta donde ya está en la matriz. */
  enMatrizDe: string[];
  facilitador: { tituloProfesional: string | null; esExpertoPrevencion: boolean } | null;
};

function separarApellidos(apellidos: string): { paterno: string; materno: string } {
  const partes = apellidos.trim().split(/\s+/);
  return { paterno: partes[0] ?? "", materno: partes.slice(1).join(" ") };
}

/**
 * Una sola búsqueda por RUN para los formularios de cuenta, matriz y
 * facilitador: la persona puede existir por cualquiera de esos caminos (y en
 * otra organización). Se usa el cliente admin para encontrarla aunque aún no
 * comparta organización con quien consulta; por eso los datos de contacto y
 * personales sólo se devuelven si sí la comparte.
 */
export async function buscarIdentidadPorRun(run: string): Promise<IdentidadEncontrada | null> {
  const sesion = await getSesion();
  if (!sesion || !(await tienePermisoEnAlgunaOrg(sesion, "personas.buscar_por_run"))) return null;

  const cuerpo = run.replace(/\D/g, "");
  if (cuerpo.length < 6) return null;

  const admin = createAdminClient();
  const [{ data: persona }, { data: usuario }, { data: facilitador }] = await Promise.all([
    admin
      .from("personas")
      .select("dv, nombres, apellido_paterno, apellido_materno, email, fecha_nacimiento, sexo")
      .eq("run", cuerpo)
      .maybeSingle(),
    admin.from("usuarios").select("id, dv, nombres, apellidos, email").eq("run", cuerpo).maybeSingle(),
    admin
      .from("facilitadores")
      .select("dv, nombres, apellidos, titulo_profesional, es_experto_prevencion")
      .eq("run", cuerpo)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!persona && !usuario && !facilitador) return null;

  const misOrgs = sesion.organizacionesIds;
  const [{ data: vinculos }, { data: rolesCuenta }] = await Promise.all([
    persona
      ? admin
          .from("vinculos_laborales")
          .select("organizacion_id, organizaciones(razon_social)")
          .eq("persona_run", cuerpo)
          .eq("activo", true)
      : Promise.resolve({ data: [] }),
    usuario
      ? admin.from("usuario_roles").select("organizacion_id, roles(nombre)").eq("usuario_id", usuario.id)
      : Promise.resolve({ data: [] }),
  ]);

  const vinculosVisibles = (vinculos ?? []).filter((v) => sesion.esSuperAdmin || misOrgs.includes(v.organizacion_id));
  const rolesVisibles = (rolesCuenta ?? []).filter(
    (r) => sesion.esSuperAdmin || (r.organizacion_id && misOrgs.includes(r.organizacion_id)),
  );
  const compartida = sesion.esSuperAdmin || vinculosVisibles.length > 0 || rolesVisibles.length > 0;

  let fuente: IdentidadEncontrada["fuente"];
  let nombres: string;
  let paterno: string;
  let materno: string;
  let dv: string;
  if (persona) {
    fuente = "persona";
    ({ nombres, dv } = persona);
    paterno = persona.apellido_paterno;
    materno = persona.apellido_materno ?? "";
  } else {
    const origen = (usuario ?? facilitador)!;
    fuente = usuario ? "cuenta" : "facilitador";
    nombres = origen.nombres;
    dv = origen.dv ?? "";
    ({ paterno, materno } = separarApellidos(origen.apellidos));
  }

  return {
    fuente,
    dv,
    nombres,
    apellidoPaterno: paterno,
    apellidoMaterno: materno,
    email: compartida ? (usuario?.email ?? persona?.email ?? null) : null,
    fechaNacimiento: compartida ? (persona?.fecha_nacimiento ?? null) : null,
    sexo: compartida ? (persona?.sexo ?? null) : null,
    tieneCuenta: !!usuario,
    roles: [...new Set(rolesVisibles.map((r) => (r.roles ? ROL_LABEL[r.roles.nombre] : null)).filter((r): r is string => !!r))],
    enMatrizDe: vinculosVisibles.map((v) => v.organizacion_id),
    facilitador: facilitador
      ? { tituloProfesional: facilitador.titulo_profesional, esExpertoPrevencion: facilitador.es_experto_prevencion }
      : null,
  };
}
