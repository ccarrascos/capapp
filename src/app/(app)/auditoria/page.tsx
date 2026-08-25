import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AuditoriaView } from "./auditoria-view";

export default async function AuditoriaPage() {
  const sesion = await getSesion();
  if (!sesion) return null;
  if (!sesion.esSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();

  const { data: entradas } = await supabase
    .from("auditoria_log")
    .select("id, accion, tabla, registro_id, datos_anteriores, datos_nuevos, created_at, usuarios(nombres, apellidos, email)")
    .order("created_at", { ascending: false })
    .limit(300);

  return <AuditoriaView entradas={entradas ?? []} />;
}
