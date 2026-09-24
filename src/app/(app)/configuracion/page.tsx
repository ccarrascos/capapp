import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULTS_CONFIGURACION, type ClaveConfiguracion } from "@/lib/configuracion";
import { ConfiguracionView, type ValorActual } from "./configuracion-view";

export default async function ConfiguracionPage() {
  const sesion = await getSesion();
  if (!sesion) return null;
  if (!sesion.esSuperAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: filas }, { data: revocados, error: errorPermisos }] = await Promise.all([
    supabase.from("configuracion_plataforma").select("clave, valor, actualizado_en"),
    supabase.from("permisos_revocados").select("rol, accion"),
  ]);

  const valores = Object.fromEntries(
    (Object.keys(DEFAULTS_CONFIGURACION) as ClaveConfiguracion[]).map((clave) => {
      const fila = (filas ?? []).find((f) => f.clave === clave);
      const valor: ValorActual = {
        valor: typeof fila?.valor === "number" ? fila.valor : DEFAULTS_CONFIGURACION[clave],
        porDefecto: DEFAULTS_CONFIGURACION[clave],
        actualizadoEn: fila?.actualizado_en ?? null,
      };
      return [clave, valor];
    }),
  ) as Record<ClaveConfiguracion, ValorActual>;

  return (
    <ConfiguracionView
      valores={valores}
      revocados={(revocados ?? []).map((r) => `${r.rol}:${r.accion}`)}
      permisosDisponibles={!errorPermisos}
    />
  );
}
