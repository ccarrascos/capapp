import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrganizacionesView } from "./organizaciones-view";

export default async function OrganizacionesPage() {
  const sesion = await getSesion();
  if (!sesion) return null;
  if (!sesion.esSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: organizaciones } = await supabase
    .from("organizaciones")
    .select("id, rut, razon_social, nombre_fantasia, sector_economico, comuna, region, activo")
    .order("razon_social");

  return <OrganizacionesView organizaciones={organizaciones ?? []} />;
}
