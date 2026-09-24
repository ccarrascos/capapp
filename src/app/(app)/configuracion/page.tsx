import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULTS_CONFIGURACION, type ClaveConfiguracion } from "@/lib/configuracion";
import { organizacionesConPermiso, tienePermisoEnAlgunaOrg } from "@/lib/permisos";
import { ConfiguracionView, type OrganizacionConfigurable, type ValorActual } from "./configuracion-view";

export default async function ConfiguracionPage() {
  const sesion = await getSesion();
  if (!sesion) return null;
  if (!(await tienePermisoEnAlgunaOrg(sesion, "organizacion.configurar"))) redirect("/dashboard");

  const supabase = await createClient();

  const idsOrganizaciones = sesion.esSuperAdmin
    ? null
    : (await organizacionesConPermiso(sesion, "organizacion.configurar")).map((o) => o.id);

  const consultaOrgs = supabase
    .from("organizaciones")
    .select("id, razon_social, vigencia_por_vencer_dias, curso_horas_minimas, edicion_plazo_maximo_meses")
    .order("razon_social");

  const [{ data: filas }, { data: revocados, error: errorPermisos }, { data: orgs, error: errorOrgs }] =
    await Promise.all([
      supabase.from("configuracion_plataforma").select("clave, valor, actualizado_en"),
      sesion.esSuperAdmin
        ? supabase.from("permisos_revocados").select("rol, accion")
        : Promise.resolve({ data: [], error: null }),
      idsOrganizaciones ? consultaOrgs.in("id", idsOrganizaciones) : consultaOrgs,
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

  const organizaciones: OrganizacionConfigurable[] = (orgs ?? []).map((o) => ({
    id: o.id,
    razonSocial: o.razon_social,
    valores: {
      vigencia_por_vencer_dias: o.vigencia_por_vencer_dias,
      curso_horas_minimas: o.curso_horas_minimas,
      edicion_plazo_maximo_meses: o.edicion_plazo_maximo_meses,
    },
  }));

  return (
    <ConfiguracionView
      esSuperAdmin={sesion.esSuperAdmin}
      valores={valores}
      revocados={(revocados ?? []).map((r) => `${r.rol}:${r.accion}`)}
      permisosDisponibles={!errorPermisos}
      organizaciones={organizaciones}
      organizacionesDisponibles={!errorOrgs}
    />
  );
}
