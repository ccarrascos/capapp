import { redirect } from "next/navigation";
import { getSesion, centrosVisibles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnaliticaView } from "./analitica-view";

const ROLES_PERMITIDOS = ["super_admin", "admin_organizacion", "prevencionista", "supervisor_centro", "auditor"] as const;

export const ESTADOS = [
  { estado: "vigente", label: "Vigente", color: "var(--clear)" },
  { estado: "por_vencer", label: "Por vencer", color: "var(--hazard)" },
  { estado: "vencido", label: "Vencido", color: "var(--alert)" },
  { estado: "sin_capacitacion", label: "Sin capacitación", color: "var(--steel)" },
] as const;

function calcularEdad(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

export default async function AnaliticaPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeVer =
    sesion.esSuperAdmin || sesion.roles.some((r) => ROLES_PERMITIDOS.includes(r.rol as (typeof ROLES_PERMITIDOS)[number]));
  if (!puedeVer) redirect("/dashboard");

  const supabase = await createClient();

  const { data: matriz } = await supabase
    .from("matriz_vigencia_capacitacion")
    .select("*")
    .eq("trabajador_activo", true);

  const filas = (matriz ?? []).filter((f) => {
    if (sesion.esSuperAdmin || !f.organizacion_id) return true;
    const cv = centrosVisibles(sesion, f.organizacion_id);
    return cv === "todos" || (f.centro_trabajo_id != null && cv.includes(f.centro_trabajo_id));
  });

  const runs = [...new Set(filas.map((f) => f.persona_run).filter((r): r is string => !!r))];
  const { data: personas } =
    runs.length > 0 ? await supabase.from("personas").select("run, fecha_nacimiento").in("run", runs) : { data: [] };
  const fechaNacimientoPorRun = new Map((personas ?? []).map((p) => [p.run, p.fecha_nacimiento]));

  const centroIds = [...new Set(filas.map((f) => f.centro_trabajo_id).filter((id): id is string => !!id))];
  const { data: centros } =
    centroIds.length > 0
      ? await supabase.from("centros_trabajo").select("id, nombre").in("id", centroIds)
      : { data: [] };
  const nombreCentroPorId = new Map((centros ?? []).map((c) => [c.id, c.nombre]));

  const filasAnalitica = filas.map((f) => {
    const fecha = f.persona_run ? fechaNacimientoPorRun.get(f.persona_run) : null;
    return {
      centro: (f.centro_trabajo_id ? nombreCentroPorId.get(f.centro_trabajo_id) : null) ?? "Sin asignar",
      edad: fecha ? calcularEdad(fecha) : null,
      estado: (f.estado_vigencia ?? "sin_capacitacion") as (typeof ESTADOS)[number]["estado"],
      tipoVinculo: (f.tipo_vinculo ?? "directo") as "directo" | "subcontrato",
      subcontrato: f.subcontrato_nombre ?? null,
    };
  });

  return <AnaliticaView filas={filasAnalitica} estadosConfig={[...ESTADOS]} />;
}
