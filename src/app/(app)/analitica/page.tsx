import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnaliticaView } from "./analitica-view";

const ROLES_PERMITIDOS = ["super_admin", "admin_organizacion", "prevencionista", "supervisor_centro", "auditor"] as const;

const RANGOS_EDAD: { label: string; min: number; max: number }[] = [
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55-64", min: 55, max: 64 },
  { label: "65+", min: 65, max: 999 },
];

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

  const filas = matriz ?? [];

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

  // Histograma de edad
  const histogramaEdad = RANGOS_EDAD.map((rango) => ({
    rango: rango.label,
    cantidad: filas.filter((f) => {
      const fecha = f.persona_run ? fechaNacimientoPorRun.get(f.persona_run) : null;
      if (!fecha) return false;
      const edad = calcularEdad(fecha);
      return edad >= rango.min && edad <= rango.max;
    }).length,
  }));

  // Estado de capacitación
  const ESTADOS = [
    { estado: "vigente", label: "Vigente", color: "var(--clear)" },
    { estado: "por_vencer", label: "Por vencer", color: "var(--hazard)" },
    { estado: "vencido", label: "Vencido", color: "var(--alert)" },
    { estado: "sin_capacitacion", label: "Sin capacitación", color: "var(--steel)" },
  ] as const;
  const estadoCapacitacion = ESTADOS.map((e) => ({
    estado: e.label,
    cantidad: filas.filter((f) => (f.estado_vigencia ?? "sin_capacitacion") === e.estado).length,
    color: e.color,
  }));

  // Trabajadores por centro
  function nombreCentroDeFila(f: (typeof filas)[number]): string {
    if (!f.centro_trabajo_id) return "Sin asignar";
    return nombreCentroPorId.get(f.centro_trabajo_id) ?? "Sin asignar";
  }

  const nombresCentro = [...new Set(filas.map(nombreCentroDeFila))];
  const trabajadoresPorCentro = nombresCentro
    .map((nombre) => ({
      centro: nombre,
      cantidad: filas.filter((f) => nombreCentroDeFila(f) === nombre).length,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Cumplimiento por centro (desglose de estado dentro de cada centro)
  const cumplimientoPorCentro = nombresCentro
    .map((nombre) => {
      const filasDelCentro = filas.filter((f) => nombreCentroDeFila(f) === nombre);
      const fila: Record<string, string | number> = { centro: nombre };
      for (const e of ESTADOS) {
        fila[e.label] = filasDelCentro.filter((f) => (f.estado_vigencia ?? "sin_capacitacion") === e.estado).length;
      }
      return fila;
    })
    .sort((a, b) => (b.Vigente as number) - (a.Vigente as number));

  const totalActivos = filas.length;
  const vigentes = filas.filter((f) => f.estado_vigencia === "vigente").length;
  const cumplimientoGlobal = totalActivos > 0 ? Math.round((vigentes / totalActivos) * 100) : 0;

  return (
    <AnaliticaView
      histogramaEdad={histogramaEdad}
      estadoCapacitacion={estadoCapacitacion}
      trabajadoresPorCentro={trabajadoresPorCentro}
      cumplimientoPorCentro={cumplimientoPorCentro}
      estadosLabels={ESTADOS.map((e) => ({ label: e.label, color: e.color }))}
      totalActivos={totalActivos}
      cumplimientoGlobal={cumplimientoGlobal}
    />
  );
}
