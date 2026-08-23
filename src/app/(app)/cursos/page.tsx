import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CursosView } from "./cursos-view";

const ROLES_GESTION = ["super_admin", "admin_organizacion", "prevencionista"] as const;
const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function CursosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const { data: miFacilitador } = await supabase
    .from("facilitadores")
    .select("organizacion_id")
    .eq("usuario_id", sesion.usuarioId)
    .maybeSingle();

  const puedeVer =
    sesion.esSuperAdmin ||
    miFacilitador?.organizacion_id != null ||
    sesion.roles.some((r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]));
  if (!puedeVer) redirect("/dashboard");

  const orgsPropias = [
    ...new Map(
      sesion.roles
        .filter((r) => r.organizacionId)
        .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
    ).values(),
  ];
  const orgIdsVisibles = miFacilitador?.organizacion_id
    ? [...new Set([...orgsPropias.map((o) => o.id), miFacilitador.organizacion_id])]
    : orgsPropias.map((o) => o.id);

  const [{ data: cursos }, { data: organizaciones }] = await Promise.all([
    sesion.esSuperAdmin
      ? supabase
          .from("cursos")
          .select("id, nombre, horas_totales, tipo_proveedor, vigente, modulos(id)")
          .order("nombre")
      : supabase
          .from("cursos")
          .select("id, nombre, horas_totales, tipo_proveedor, vigente, modulos(id)")
          .in("organizacion_id", orgIdsVisibles)
          .order("nombre"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({ data: orgsPropias }),
  ]);

  const puedeGestionar = sesion.roles.some((r) =>
    ROLES_GESTION.includes(r.rol as (typeof ROLES_GESTION)[number]),
  );

  return (
    <CursosView cursos={cursos ?? []} organizaciones={organizaciones ?? []} puedeGestionar={puedeGestionar} />
  );
}
