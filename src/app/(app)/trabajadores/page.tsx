import { redirect } from "next/navigation";
import { getSesion, centrosVisibles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { TrabajadoresView } from "./trabajadores-view";

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function TrabajadoresPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVerMatriz =
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]));
  if (!puedeVerMatriz) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: matriz }, { data: cargos }, { data: centros }, { data: subcontratos }, { data: orgsPropias }] =
    await Promise.all([
    supabase.from("matriz_vigencia_capacitacion").select("*").order("nombres"),
    supabase.from("cargos").select("id, nombre, organizacion_id").eq("activo", true).order("nombre"),
    supabase.from("centros_trabajo").select("id, nombre, organizacion_id").eq("activo", true).order("nombre"),
    supabase
      .from("subcontratos")
      .select("id, nombre, organizacion_id, subcontratos_centros(centro_trabajo_id)")
      .eq("activo", true)
      .order("nombre"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({
          data: [
            ...new Map(
              sesion.roles
                .filter((r) => r.organizacionId)
                .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
            ).values(),
          ],
        }),
  ]);

  const runs = [...new Set((matriz ?? []).map((f) => f.persona_run).filter((r): r is string => !!r))];
  const { data: personasAcceso } =
    runs.length > 0
      ? await supabase.from("personas").select("run, usuario_id, email, fecha_nacimiento, sexo").in("run", runs)
      : { data: [] };

  const accesoPorRun = new Map((personasAcceso ?? []).map((p) => [p.run, p]));
  const centroPorId = new Map((centros ?? []).map((c) => [c.id, c.nombre]));
  const filas = (matriz ?? [])
    .filter((f) => {
      if (sesion.esSuperAdmin || !f.organizacion_id) return true;
      const cv = centrosVisibles(sesion, f.organizacion_id);
      return cv === "todos" || (f.centro_trabajo_id != null && cv.includes(f.centro_trabajo_id));
    })
    .map((f) => ({
      ...f,
      usuarioId: (f.persona_run && accesoPorRun.get(f.persona_run)?.usuario_id) ?? null,
      personaEmail: (f.persona_run && accesoPorRun.get(f.persona_run)?.email) ?? null,
      fechaNacimiento: (f.persona_run && accesoPorRun.get(f.persona_run)?.fecha_nacimiento) ?? null,
      sexo: (f.persona_run ? accesoPorRun.get(f.persona_run)?.sexo : null) ?? null,
      centroNombre: (f.centro_trabajo_id && centroPorId.get(f.centro_trabajo_id)) ?? null,
    }));

  const subcontratosPorOrg = (subcontratos ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    organizacion_id: s.organizacion_id,
    centroIds: s.subcontratos_centros.map((sc) => sc.centro_trabajo_id),
  }));

  const [puedeGestionar, puedeDarAcceso, puedeInscribir, puedeVerDetalle] = await Promise.all([
    tienePermisoEnAlgunaOrg(sesion, "trabajadores.gestionar"),
    tienePermisoEnAlgunaOrg(sesion, "trabajadores.dar_acceso"),
    tienePermisoEnAlgunaOrg(sesion, "ediciones.inscribir"),
    tienePermisoEnAlgunaOrg(sesion, "trabajadores.ver_detalle"),
  ]);

  return (
    <TrabajadoresView
      filas={filas}
      organizaciones={orgsPropias ?? []}
      cargos={cargos ?? []}
      centros={centros ?? []}
      subcontratos={subcontratosPorOrg}
      puedeGestionar={puedeGestionar}
      puedeDarAcceso={puedeDarAcceso}
      puedeInscribir={puedeInscribir}
      puedeVerDetalle={puedeVerDetalle}
    />
  );
}
