import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { organizacionesConPermiso, tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { SubcontratosView } from "./subcontratos-view";

export default async function SubcontratosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeGestionar = await tienePermisoEnAlgunaOrg(sesion, "subcontratos.gestionar");
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
      : organizacionesConPermiso(sesion, "subcontratos.gestionar").then((data) => ({ data })),
  ]);

  return (
    <SubcontratosView
      subcontratos={subcontratos ?? []}
      centros={centros ?? []}
      organizaciones={organizaciones ?? []}
    />
  );
}
