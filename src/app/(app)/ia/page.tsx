import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { IaView } from "./ia-view";

export default async function IaPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer = await tienePermisoEnAlgunaOrg(sesion, "ia.usar");
  if (!puedeVer) redirect("/dashboard");

  return <IaView />;
}
