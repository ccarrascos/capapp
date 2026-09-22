import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { IaView } from "./ia-view";

const ROLES_PERMITIDOS = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function IaPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer =
    sesion.esSuperAdmin || sesion.roles.some((r) => ROLES_PERMITIDOS.includes(r.rol as (typeof ROLES_PERMITIDOS)[number]));
  if (!puedeVer) redirect("/dashboard");

  return <IaView />;
}
