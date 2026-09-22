import "server-only";
import type Groq from "groq-sdk";
import { centrosVisibles, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type FilaMatriz = Database["public"]["Views"]["matriz_vigencia_capacitacion"]["Row"];

/**
 * Mismo filtro de visibilidad que usan Panel, Matriz de vigencia y Analítica
 * (ver centrosVisibles en src/lib/auth.ts) — el asistente nunca ve datos que
 * el usuario no podría ver navegando la app normalmente.
 */
async function filasVisibles(sesion: Sesion): Promise<FilaMatriz[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("matriz_vigencia_capacitacion").select("*").eq("trabajador_activo", true);
  return (data ?? []).filter((f) => {
    if (sesion.esSuperAdmin || !f.organizacion_id) return true;
    const cv = centrosVisibles(sesion, f.organizacion_id);
    return cv === "todos" || (f.centro_trabajo_id != null && cv.includes(f.centro_trabajo_id));
  });
}

function nombreCompleto(f: FilaMatriz): string {
  return `${f.nombres ?? ""} ${f.apellido_paterno ?? ""} ${f.apellido_materno ?? ""}`.replace(/\s+/g, " ").trim();
}

/** El LLM extrae nombres de una conversación libre y no siempre respeta tildes — se compara sin acentos. */
function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function resumenCumplimiento(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const conteo = (estado: string) => filas.filter((f) => f.estado_vigencia === estado).length;
  const total = filas.length;
  const vigentes = conteo("vigente");
  return {
    totalTrabajadores: total,
    vigentes,
    porVencer: conteo("por_vencer"),
    vencidos: conteo("vencido"),
    sinCapacitacion: conteo("sin_capacitacion"),
    porcentajeCumplimiento: total > 0 ? Math.round((vigentes / total) * 100) : 0,
  };
}

async function buscarTrabajador(sesion: Sesion, consulta: string) {
  const filas = await filasVisibles(sesion);
  const q = sinAcentos(consulta.trim().toLowerCase());
  const runBuscado = q.replace(/[^0-9k]/gi, "");

  const encontrados = filas
    .filter((f) => {
      if (!q) return false;
      if (sinAcentos(nombreCompleto(f).toLowerCase()).includes(q)) return true;
      return runBuscado.length >= 4 && (f.run ?? "").includes(runBuscado);
    })
    .slice(0, 10);

  if (encontrados.length === 0) {
    return { encontrados: 0, mensaje: "No se encontró ningún trabajador que coincida con esa búsqueda." };
  }

  const centroIds = [...new Set(encontrados.map((f) => f.centro_trabajo_id).filter((id): id is string => !!id))];
  const supabase = await createClient();
  const { data: centros } =
    centroIds.length > 0
      ? await supabase.from("centros_trabajo").select("id, nombre").in("id", centroIds)
      : { data: [] };
  const nombreCentroPorId = new Map((centros ?? []).map((c) => [c.id, c.nombre]));

  return {
    encontrados: encontrados.length,
    trabajadores: encontrados.map((f) => ({
      nombre: nombreCompleto(f),
      run: f.run && f.dv ? `${f.run}-${f.dv}` : null,
      cargo: f.cargo ?? null,
      centro: (f.centro_trabajo_id && nombreCentroPorId.get(f.centro_trabajo_id)) ?? "Sin asignar",
      estadoVigencia: f.estado_vigencia,
      vigenciaHasta: f.vigencia_hasta,
      vinculo: f.tipo_vinculo === "subcontrato" ? `Subcontrato (${f.subcontrato_nombre ?? "?"})` : "Directo",
    })),
  };
}

async function trabajadoresPorVencer(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const relevantes = filas
    .filter((f) => f.estado_vigencia === "vencido" || f.estado_vigencia === "por_vencer")
    .sort((a, b) => (a.vigencia_hasta ?? "").localeCompare(b.vigencia_hasta ?? ""))
    .slice(0, 20);

  return {
    // La ventana "por vencer" es fija en 60 días — la misma que usa la Matriz de vigencia.
    ventanaDias: 60,
    cantidad: relevantes.length,
    trabajadores: relevantes.map((f) => ({
      nombre: nombreCompleto(f),
      run: f.run && f.dv ? `${f.run}-${f.dv}` : null,
      cargo: f.cargo ?? null,
      estadoVigencia: f.estado_vigencia,
      vigenciaHasta: f.vigencia_hasta,
    })),
  };
}

async function distribucionPorCentro(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const centroIds = [...new Set(filas.map((f) => f.centro_trabajo_id).filter((id): id is string => !!id))];

  const supabase = await createClient();
  const { data: centros } =
    centroIds.length > 0
      ? await supabase.from("centros_trabajo").select("id, nombre").in("id", centroIds)
      : { data: [] };
  const nombrePorId = new Map((centros ?? []).map((c) => [c.id, c.nombre]));

  const porCentro = new Map<
    string,
    { total: number; vigentes: number; porVencer: number; vencidos: number; sinCapacitacion: number }
  >();
  for (const f of filas) {
    const nombre = (f.centro_trabajo_id && nombrePorId.get(f.centro_trabajo_id)) ?? "Sin asignar";
    const actual = porCentro.get(nombre) ?? { total: 0, vigentes: 0, porVencer: 0, vencidos: 0, sinCapacitacion: 0 };
    actual.total += 1;
    if (f.estado_vigencia === "vigente") actual.vigentes += 1;
    else if (f.estado_vigencia === "por_vencer") actual.porVencer += 1;
    else if (f.estado_vigencia === "vencido") actual.vencidos += 1;
    else if (f.estado_vigencia === "sin_capacitacion") actual.sinCapacitacion += 1;
    porCentro.set(nombre, actual);
  }

  return {
    centros: [...porCentro.entries()]
      .map(([centro, c]) => ({ centro, ...c }))
      .sort((a, b) => b.total - a.total),
  };
}

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

async function demografiaTrabajadores(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const runs = [...new Set(filas.map((f) => f.persona_run).filter((r): r is string => !!r))];

  const supabase = await createClient();
  const { data: personas } =
    runs.length > 0
      ? await supabase.from("personas").select("run, fecha_nacimiento, sexo").in("run", runs)
      : { data: [] };

  const porRun = new Map((personas ?? []).map((p) => [p.run, p]));
  const edades = runs
    .map((r) => porRun.get(r)?.fecha_nacimiento)
    .filter((f): f is string => !!f)
    .map(calcularEdad);
  const sexos = runs.map((r) => porRun.get(r)?.sexo).filter((s): s is "masculino" | "femenino" | "otro" => !!s);

  const conteoSexo = (s: string) => sexos.filter((x) => x === s).length;

  return {
    trabajadoresConFechaNacimiento: edades.length,
    edadPromedio: edades.length > 0 ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
    edadMinima: edades.length > 0 ? Math.min(...edades) : null,
    edadMaxima: edades.length > 0 ? Math.max(...edades) : null,
    trabajadoresConSexoRegistrado: sexos.length,
    masculino: conteoSexo("masculino"),
    femenino: conteoSexo("femenino"),
    otro: conteoSexo("otro"),
  };
}

export const DEFINICIONES_HERRAMIENTAS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "resumen_cumplimiento",
      description:
        "Resumen general de cumplimiento de capacitación: cuántos trabajadores están vigentes, por vencer, vencidos o sin capacitación, y el % de cumplimiento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_trabajador",
      description: "Busca uno o más trabajadores por nombre (parcial) o RUN, y devuelve su estado de capacitación.",
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string", description: "Nombre (o parte de él) o RUN a buscar." },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trabajadores_por_vencer",
      description:
        "Lista los trabajadores con capacitación vencida o por vencer (dentro de los próximos 60 días), ordenados por fecha de vencimiento más próxima.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "distribucion_por_centro",
      description:
        "Cuenta cuántos trabajadores hay en cada centro de trabajo, desglosados por estado de capacitación (vigentes, por vencer, vencidos, sin capacitación). Úsala para cualquier pregunta que compare centros entre sí, incluyendo cuántos están vencidos/vigentes/sin capacitación por centro.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "demografia_trabajadores",
      description:
        "Estadísticas demográficas: edad promedio/mínima/máxima y distribución por sexo (masculino/femenino/otro) de los trabajadores.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export async function ejecutarHerramienta(
  sesion: Sesion,
  nombre: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  switch (nombre) {
    case "resumen_cumplimiento":
      return resumenCumplimiento(sesion);
    case "buscar_trabajador":
      return buscarTrabajador(sesion, String(argumentos.consulta ?? ""));
    case "trabajadores_por_vencer":
      return trabajadoresPorVencer(sesion);
    case "distribucion_por_centro":
      return distribucionPorCentro(sesion);
    case "demografia_trabajadores":
      return demografiaTrabajadores(sesion);
    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}
