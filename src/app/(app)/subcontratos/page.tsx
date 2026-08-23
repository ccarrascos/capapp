import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubcontratosView } from "./subcontratos-view";

export default async function SubcontratosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeGestionar = sesion.esSuperAdmin || sesion.roles.some((r) => r.rol === "admin_organizacion");
  if (!puedeGestionar) redirect("/trabajadores");

  const supabase = await createClient();

  const [{ data: subcontratos }, { data: centros }, { data: organizaciones }] = await Promise.all([
    supabase
      .from("subcontratos")
      .select(
        "id, nombre, rut, activo, organizacion_id, organizaciones(razon_social), subcontratos_centros(centro_trabajo_id, centros_trabajo(nombre))",
      )
      .order("nombre"),
    supabase.from("centros_trabajo").select("id, nombre, organizacion_id").eq("activo", true).order("nombre"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({
          data: [
            ...new Map(
              sesion.roles
                .filter((r) => r.rol === "admin_organizacion" && r.organizacionId)
                .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
            ).values(),
          ],
        }),
  ]);

  return (
    <SubcontratosView
      subcontratos={subcontratos ?? []}
      centros={centros ?? []}
      organizaciones={organizaciones ?? []}
    />
  );
}
