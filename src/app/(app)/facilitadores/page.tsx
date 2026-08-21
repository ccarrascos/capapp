import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FacilitadoresView } from "./facilitadores-view";

export default async function FacilitadoresPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: facilitadores }, { data: organizacionesRaw }] = await Promise.all([
    supabase
      .from("facilitadores")
      .select(
        "id, run, dv, nombres, apellidos, titulo_profesional, es_experto_prevencion, tipo_proveedor, activo, organizacion_id, organizaciones(razon_social), organismos_administradores(nombre), entidades_acreditadas(nombre)",
      )
      .order("nombres"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({
          data: [
            ...new Map(
              sesion.roles
                .filter((r) => r.organizacionId)
                .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
            ).values(),
          ],
        }),
  ]);

  const organizacionesAdmin = new Set(
    sesion.roles.filter((r) => r.rol === "admin_organizacion" && r.organizacionId).map((r) => r.organizacionId),
  );

  return (
    <FacilitadoresView
      facilitadores={facilitadores ?? []}
      organizaciones={organizacionesRaw ?? []}
      esSuperAdmin={sesion.esSuperAdmin}
      organizacionesAdmin={[...organizacionesAdmin] as string[]}
    />
  );
}
