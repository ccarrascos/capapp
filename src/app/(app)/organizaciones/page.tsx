import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { OrganizacionesView } from "./organizaciones-view";

export default async function OrganizacionesPage() {
  const sesion = await getSesion();
  if (!sesion) return null;
  if (!sesion.esSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: organizaciones }, { max_mb_logo_organizacion }] = await Promise.all([
    supabase
      .from("organizaciones")
      .select("id, rut, razon_social, nombre_fantasia, sector_economico, comuna, region, activo, logo_url")
      .order("razon_social"),
    obtenerConfiguracion(),
  ]);

  return <OrganizacionesView organizaciones={organizaciones ?? []} maxMbLogo={max_mb_logo_organizacion} />;
}
