import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TrabajadoresView } from "./trabajadores-view";

const ROLES_GESTION = ["super_admin", "admin_organizacion", "prevencionista"] as const;

export default async function TrabajadoresPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: matriz }, { data: cargos }, { data: centros }, { data: orgsPropias }] = await Promise.all([
    supabase.from("matriz_vigencia_capacitacion").select("*").order("nombres"),
    supabase.from("cargos").select("id, nombre, organizacion_id").eq("activo", true).order("nombre"),
    supabase.from("centros_trabajo").select("id, nombre, organizacion_id").eq("activo", true).order("nombre"),
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
      ? await supabase.from("personas").select("run, usuario_id, email, fecha_nacimiento").in("run", runs)
      : { data: [] };

  const accesoPorRun = new Map((personasAcceso ?? []).map((p) => [p.run, p]));
  const centroPorId = new Map((centros ?? []).map((c) => [c.id, c.nombre]));
  const filas = (matriz ?? []).map((f) => ({
    ...f,
    usuarioId: (f.persona_run && accesoPorRun.get(f.persona_run)?.usuario_id) ?? null,
    personaEmail: (f.persona_run && accesoPorRun.get(f.persona_run)?.email) ?? null,
    fechaNacimiento: (f.persona_run && accesoPorRun.get(f.persona_run)?.fecha_nacimiento) ?? null,
    centroNombre: (f.centro_trabajo_id && centroPorId.get(f.centro_trabajo_id)) ?? null,
  }));

  const puedeGestionar = sesion.roles.some((r) =>
    ROLES_GESTION.includes(r.rol as (typeof ROLES_GESTION)[number]),
  );

  return (
    <TrabajadoresView
      filas={filas}
      organizaciones={orgsPropias ?? []}
      cargos={cargos ?? []}
      centros={centros ?? []}
      puedeGestionar={puedeGestionar}
    />
  );
}
