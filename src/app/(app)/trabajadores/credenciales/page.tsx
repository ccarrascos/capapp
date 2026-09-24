import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { generarQrDataUrl } from "@/lib/qr";
import { CredencialesView } from "./credenciales-view";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function CredencialesPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer = await tienePermisoEnAlgunaOrg(sesion, "trabajadores.ver_detalle");
  if (!puedeVer) redirect("/trabajadores");

  const supabase = await createClient();

  const { data: vinculos } = await supabase
    .from("vinculos_laborales")
    .select(
      "qr_token, personas(nombres, apellido_paterno, apellido_materno, run, dv), cargos(nombre), centros_trabajo(nombre)",
    )
    .eq("activo", true);

  const credenciales = await Promise.all(
    (vinculos ?? [])
      .filter((v) => v.personas)
      .map(async (v) => ({
        nombreCompleto: `${v.personas!.nombres} ${v.personas!.apellido_paterno}${
          v.personas!.apellido_materno ? ` ${v.personas!.apellido_materno}` : ""
        }`,
        runDv: `${v.personas!.run}-${v.personas!.dv}`,
        cargo: v.cargos?.nombre ?? null,
        centro: v.centros_trabajo?.nombre ?? null,
        qrDataUrl: await generarQrDataUrl(`${APP_URL}/credencial/${v.qr_token}`),
      })),
  );

  credenciales.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));

  return <CredencialesView credenciales={credenciales} />;
}
