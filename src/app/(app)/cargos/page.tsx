import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CargosView } from "./cargos-view";

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function CargosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer =
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]));
  if (!puedeVer) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: cargos }, { data: organizaciones }] = await Promise.all([
    supabase
      .from("cargos")
      .select("id, nombre, activo, organizacion_id, organizaciones(razon_social)")
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

  return <CargosView cargos={cargos ?? []} organizaciones={organizaciones ?? []} />;
}
