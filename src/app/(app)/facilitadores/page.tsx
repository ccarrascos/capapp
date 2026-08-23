import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FacilitadoresView } from "./facilitadores-view";

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function FacilitadoresPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer =
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]));
  if (!puedeVer) redirect("/dashboard");

  const supabase = await createClient();

  const orgsPropias = [
    ...new Map(
      sesion.roles
        .filter((r) => r.organizacionId)
        .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
    ).values(),
  ];

  const [{ data: facilitadores }, { data: organizacionesRaw }] = await Promise.all([
    sesion.esSuperAdmin
      ? supabase
          .from("facilitadores")
          .select(
            "id, run, dv, nombres, apellidos, titulo_profesional, es_experto_prevencion, tipo_proveedor, activo, organizacion_id, organizaciones(razon_social), organismos_administradores(nombre), entidades_acreditadas(nombre)",
          )
          .order("nombres")
      : supabase
          .from("facilitadores")
          .select(
            "id, run, dv, nombres, apellidos, titulo_profesional, es_experto_prevencion, tipo_proveedor, activo, organizacion_id, organizaciones(razon_social), organismos_administradores(nombre), entidades_acreditadas(nombre)",
          )
          .in("organizacion_id", orgsPropias.map((o) => o.id))
          .order("nombres"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({ data: orgsPropias }),
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
