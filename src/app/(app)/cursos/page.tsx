import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CursosView } from "./cursos-view";

const ROLES_GESTION = ["super_admin", "admin_organizacion", "prevencionista"] as const;

export default async function CursosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: cursos }, { data: organizaciones }] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, nombre, horas_totales, tipo_proveedor, vigente, modulos(id)")
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

  const puedeGestionar = sesion.roles.some((r) =>
    ROLES_GESTION.includes(r.rol as (typeof ROLES_GESTION)[number]),
  );

  return (
    <CursosView cursos={cursos ?? []} organizaciones={organizaciones ?? []} puedeGestionar={puedeGestionar} />
  );
}
