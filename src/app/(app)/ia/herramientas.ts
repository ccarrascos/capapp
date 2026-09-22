import "server-only";
import type Groq from "groq-sdk";
import { centrosVisibles, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { buscarAyuda, temasDeAyudaDisponibles } from "./ayuda";

type FilaMatriz = Database["public"]["Views"]["matriz_vigencia_capacitacion"]["Row"];
type Sexo = "masculino" | "femenino" | "otro";

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

async function mapaCentros(filas: FilaMatriz[]): Promise<Map<string, string>> {
  const centroIds = [...new Set(filas.map((f) => f.centro_trabajo_id).filter((id): id is string => !!id))];
  if (centroIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data: centros } = await supabase.from("centros_trabajo").select("id, nombre").in("id", centroIds);
  return new Map((centros ?? []).map((c) => [c.id, c.nombre]));
}

async function mapaPersonas(filas: FilaMatriz[]): Promise<Map<string, { fecha_nacimiento: string | null; sexo: Sexo | null }>> {
  const runs = [...new Set(filas.map((f) => f.persona_run).filter((r): r is string => !!r))];
  if (runs.length === 0) return new Map();
  const supabase = await createClient();
  const { data: personas } = await supabase.from("personas").select("run, fecha_nacimiento, sexo").in("run", runs);
  return new Map((personas ?? []).map((p) => [p.run, p]));
}

async function mapaCursos(filas: FilaMatriz[]): Promise<Map<string, string>> {
  const cursoIds = [...new Set(filas.map((f) => f.curso_id).filter((id): id is string => !!id))];
  if (cursoIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data: cursos } = await supabase.from("cursos").select("id, nombre").in("id", cursoIds);
  return new Map((cursos ?? []).map((c) => [c.id, c.nombre]));
}

function nombreCompleto(f: FilaMatriz): string {
  return `${f.nombres ?? ""} ${f.apellido_paterno ?? ""} ${f.apellido_materno ?? ""}`.replace(/\s+/g, " ").trim();
}

/** El LLM extrae texto de una conversación libre y no siempre respeta tildes — se compara sin acentos. */
function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
  const q = sinAcentos(consulta.trim());
  const runBuscado = q.replace(/[^0-9k]/gi, "");

  const encontrados = filas
    .filter((f) => {
      if (!q) return false;
      if (sinAcentos(nombreCompleto(f)).includes(q)) return true;
      return runBuscado.length >= 4 && (f.run ?? "").includes(runBuscado);
    })
    .slice(0, 10);

  if (encontrados.length === 0) {
    return { encontrados: 0, mensaje: "No se encontró ningún trabajador que coincida con esa búsqueda." };
  }

  const nombreCentroPorId = await mapaCentros(encontrados);

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

async function trabajadoresPorVencer(sesion: Sesion, centro: string | null, estado: string | null) {
  const filas = await filasVisibles(sesion);
  const nombreCentroPorId = await mapaCentros(filas);
  const nombreCursoPorId = await mapaCursos(filas);
  const centroDe = (f: FilaMatriz) => (f.centro_trabajo_id && nombreCentroPorId.get(f.centro_trabajo_id)) ?? "Sin asignar";

  const centroBuscado = centro ? sinAcentos(centro.trim()) : null;
  const estadosValidos = new Set(["vencido", "por_vencer"]);
  const estadoBuscado = estado && estadosValidos.has(estado) ? estado : null;

  const relevantes = filas
    .filter((f) => (estadoBuscado ? f.estado_vigencia === estadoBuscado : f.estado_vigencia === "vencido" || f.estado_vigencia === "por_vencer"))
    .filter((f) => !centroBuscado || sinAcentos(centroDe(f)).includes(centroBuscado))
    .sort((a, b) => (a.vigencia_hasta ?? "").localeCompare(b.vigencia_hasta ?? ""))
    .slice(0, 50);

  return {
    // La ventana "por vencer" es fija en 60 días — la misma que usa la Matriz de vigencia.
    ventanaDias: 60,
    cantidad: relevantes.length,
    trabajadores: relevantes.map((f) => ({
      nombre: nombreCompleto(f),
      run: f.run && f.dv ? `${f.run}-${f.dv}` : null,
      cargo: f.cargo ?? null,
      centro: centroDe(f),
      curso: (f.curso_id && nombreCursoPorId.get(f.curso_id)) ?? "Sin curso aprobado",
      estadoVigencia: f.estado_vigencia,
      vigenciaHasta: f.vigencia_hasta,
    })),
  };
}

type ConteoPorEstado = { total: number; vigentes: number; porVencer: number; vencidos: number; sinCapacitacion: number };

function agruparPorEstado(filas: FilaMatriz[], claveDe: (f: FilaMatriz) => string): (ConteoPorEstado & { clave: string })[] {
  const mapa = new Map<string, ConteoPorEstado>();
  for (const f of filas) {
    const clave = claveDe(f);
    const actual = mapa.get(clave) ?? { total: 0, vigentes: 0, porVencer: 0, vencidos: 0, sinCapacitacion: 0 };
    actual.total += 1;
    if (f.estado_vigencia === "vigente") actual.vigentes += 1;
    else if (f.estado_vigencia === "por_vencer") actual.porVencer += 1;
    else if (f.estado_vigencia === "vencido") actual.vencidos += 1;
    else if (f.estado_vigencia === "sin_capacitacion") actual.sinCapacitacion += 1;
    mapa.set(clave, actual);
  }
  return [...mapa.entries()].map(([clave, c]) => ({ clave, ...c })).sort((a, b) => b.total - a.total);
}

async function distribucionPorCentro(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const nombreCentroPorId = await mapaCentros(filas);
  const agrupado = agruparPorEstado(filas, (f) => (f.centro_trabajo_id && nombreCentroPorId.get(f.centro_trabajo_id)) ?? "Sin asignar");
  return { centros: agrupado.map(({ clave, ...c }) => ({ centro: clave, ...c })) };
}

/**
 * curso_id en la matriz es el último curso APROBADO de cada persona (o null
 * si nunca aprobó uno) — así que esto agrupa por "el curso cuya vigencia
 * está corriendo/vencida para cada trabajador", que es lo que alguien
 * pregunta con "qué cursos tienen gente vencida".
 */
async function distribucionPorCurso(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const nombreCursoPorId = await mapaCursos(filas);
  const agrupado = agruparPorEstado(filas, (f) => (f.curso_id && nombreCursoPorId.get(f.curso_id)) ?? "Sin curso aprobado");
  return { cursos: agrupado.map(({ clave, ...c }) => ({ curso: clave, ...c })) };
}

async function demografiaTrabajadores(sesion: Sesion) {
  const filas = await filasVisibles(sesion);
  const runs = [...new Set(filas.map((f) => f.persona_run).filter((r): r is string => !!r))];
  const porRun = await mapaPersonas(filas);

  const edades = runs
    .map((r) => porRun.get(r)?.fecha_nacimiento)
    .filter((f): f is string => !!f)
    .map(calcularEdad);
  const sexos = runs.map((r) => porRun.get(r)?.sexo).filter((s): s is Sexo => !!s);
  const conteoSexo = (s: Sexo) => sexos.filter((x) => x === s).length;

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

/**
 * Tablas que el asistente puede consultar libremente más allá del dominio
 * de trabajadores. Se restringe a tablas cuyo RLS ya alcanza por sí solo
 * (organizacion_id = any(app_organizaciones_usuario()), sin excepciones) —
 * quedan afuera inscripciones, certificados, asistencias_modulo,
 * evaluaciones_resultado y la propia matriz de trabajadores porque su
 * visibilidad real depende ADEMÁS de centrosVisibles() a nivel de
 * aplicación (un supervisor_centro ve solo su centro en esas pantallas,
 * pero el RLS de esas tablas permite ver toda la organización) — exponerlas
 * aquí sin ese filtro extra sería una fuga entre centros de la misma
 * empresa. También quedan afuera personas/usuarios/auditoria_log por ser
 * datos personales o administrativos que no vienen al caso en este chat.
 */
const TABLAS_PERMITIDAS = [
  "cursos",
  "modulos",
  "ediciones_curso",
  "facilitadores",
  "cargos",
  "centros_trabajo",
  "subcontratos",
  "programas_trabajo_preventivo",
  "organizaciones",
] as const;

const LIMITE_TABLA = 100;

async function consultarTabla(tabla: string, filtros: { columna: string; valor: string; contiene?: boolean }[]) {
  if (!(TABLAS_PERMITIDAS as readonly string[]).includes(tabla)) {
    return {
      error: `Tabla "${tabla}" no disponible. Tablas permitidas: ${TABLAS_PERMITIDAS.join(", ")}. Para trabajadores, usa las herramientas de trabajadores en su lugar.`,
    };
  }

  const supabase = await createClient(); // cliente con RLS de la sesión — nunca el admin client
  // `tabla` ya se validó arriba contra TABLAS_PERMITIDAS; el cast solo evita que
  // TypeScript exija una unión literal para un nombre de tabla que llega en runtime.
  let query = supabase.from(tabla as (typeof TABLAS_PERMITIDAS)[number]).select("*").limit(LIMITE_TABLA);
  for (const f of filtros.slice(0, 5)) {
    if (!f.columna) continue;
    query = f.contiene ? query.ilike(f.columna, `%${f.valor}%`) : query.eq(f.columna, f.valor);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return { tabla, cantidad: data?.length ?? 0, limite: LIMITE_TABLA, filas: data ?? [] };
}

const LIMITE_CONSULTA_COMPLETA = 250;

/**
 * Catch-all: vuelca la lista completa (acotada) de trabajadores visibles con
 * todos sus atributos, para que el asistente pueda responder preguntas que
 * ninguna herramienta específica cubre — cruces, conteos ad hoc, listados
 * por cargo/vínculo/modalidad, etc. — razonando sobre los datos crudos en
 * vez de fallar por falta de una herramienta a medida.
 */
async function consultarTrabajadores(
  sesion: Sesion,
  filtros: { centro?: string; estado?: string; cargo?: string },
) {
  const filas = await filasVisibles(sesion);
  const nombreCentroPorId = await mapaCentros(filas);
  const personaPorRun = await mapaPersonas(filas);
  const nombreCursoPorId = await mapaCursos(filas);
  const centroDe = (f: FilaMatriz) => (f.centro_trabajo_id && nombreCentroPorId.get(f.centro_trabajo_id)) ?? "Sin asignar";

  const centroBuscado = filtros.centro ? sinAcentos(filtros.centro.trim()) : null;
  const cargoBuscado = filtros.cargo ? sinAcentos(filtros.cargo.trim()) : null;
  const estadoBuscado = filtros.estado ? filtros.estado.trim() : null;

  const filtradas = filas
    .filter((f) => !centroBuscado || sinAcentos(centroDe(f)).includes(centroBuscado))
    .filter((f) => !cargoBuscado || sinAcentos(f.cargo ?? "").includes(cargoBuscado))
    .filter((f) => !estadoBuscado || f.estado_vigencia === estadoBuscado);

  const truncado = filtradas.length > LIMITE_CONSULTA_COMPLETA;

  return {
    totalCoincidencias: filtradas.length,
    truncado,
    ...(truncado
      ? { nota: `Se muestran solo los primeros ${LIMITE_CONSULTA_COMPLETA} de ${filtradas.length} — pide un filtro más específico (centro, cargo o estado) si necesitas ver el resto.` }
      : {}),
    trabajadores: filtradas.slice(0, LIMITE_CONSULTA_COMPLETA).map((f) => {
      const persona = f.persona_run ? personaPorRun.get(f.persona_run) : null;
      return {
        nombre: nombreCompleto(f),
        run: f.run && f.dv ? `${f.run}-${f.dv}` : null,
        cargo: f.cargo ?? null,
        centro: centroDe(f),
        unidad: f.unidad ?? null,
        vinculo: f.tipo_vinculo === "subcontrato" ? `Subcontrato (${f.subcontrato_nombre ?? "?"})` : "Directo",
        modalidadContractual: f.modalidad_contractual ?? null,
        edad: persona?.fecha_nacimiento ? calcularEdad(persona.fecha_nacimiento) : null,
        sexo: persona?.sexo ?? null,
        curso: (f.curso_id && nombreCursoPorId.get(f.curso_id)) ?? "Sin curso aprobado",
        estadoVigencia: f.estado_vigencia,
        vigenciaHasta: f.vigencia_hasta,
      };
    }),
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
        "Lista, con nombre, RUN, centro y el curso correspondiente, los trabajadores con capacitación vencida o por vencer (dentro de los próximos 60 días), ordenados por fecha de vencimiento más próxima. Úsala también cuando pregunten quiénes son los vencidos/por vencer de un centro en particular, o qué curso tienen vencido.",
      parameters: {
        type: "object",
        properties: {
          centro: {
            type: ["string", "null"],
            description: "Nombre (o parte de él) del centro de trabajo para filtrar. null para todos los centros.",
          },
          estado: {
            type: ["string", "null"],
            enum: ["vencido", "por_vencer", null],
            description: "Filtra solo por este estado. null para incluir ambos (vencido y por_vencer).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "distribucion_por_centro",
      description:
        "Cuenta cuántos trabajadores hay en cada centro de trabajo, desglosados por estado de capacitación (vigentes, por vencer, vencidos, sin capacitación). Úsala para cualquier pregunta que compare centros entre sí.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "distribucion_por_curso",
      description:
        "Cuenta, por cada curso, cuántos trabajadores tienen ese curso vigente/por vencer/vencido (es el último curso que aprobaron). Úsala para preguntas como qué cursos tienen gente vencida o vigente.",
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
  {
    type: "function",
    function: {
      name: "consultar_trabajadores",
      description:
        "Herramienta general: devuelve la lista completa de trabajadores visibles (nombre, RUN, cargo, centro, unidad, vínculo, modalidad contractual, edad, sexo, estado y fecha de vencimiento), opcionalmente filtrada. " +
        "Úsala SIEMPRE que ninguna otra herramienta responda directamente la pregunta — por ejemplo listados por cargo, cruces entre varias dimensiones, o cualquier cálculo que debas hacer tú mismo sobre los datos crudos.",
      parameters: {
        type: "object",
        properties: {
          centro: { type: ["string", "null"], description: "Filtra por nombre (o parte de él) del centro de trabajo. null para no filtrar." },
          cargo: { type: ["string", "null"], description: "Filtra por nombre (o parte de él) del cargo. null para no filtrar." },
          estado: {
            type: ["string", "null"],
            enum: ["vigente", "por_vencer", "vencido", "sin_capacitacion", null],
            description: "Filtra por estado de vigencia exacto. null para no filtrar.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_tabla",
      description:
        `Consulta directa a otras tablas del sistema, para preguntas fuera del dominio de trabajadores: ${TABLAS_PERMITIDAS.join(", ")}. ` +
        "Úsala para cursos y sus módulos, ediciones/fechas de curso, facilitadores, cargos, centros de trabajo, subcontratos, programas de trabajo preventivo u organizaciones. " +
        "Para cualquier pregunta sobre trabajadores usa siempre las herramientas de trabajadores, nunca esta.",
      parameters: {
        type: "object",
        properties: {
          tabla: { type: "string", enum: [...TABLAS_PERMITIDAS], description: "Nombre exacto de la tabla a consultar." },
          filtros: {
            type: ["array", "null"],
            description: "Filtros opcionales, se combinan con Y. null si no hay filtros.",
            items: {
              type: "object",
              properties: {
                columna: { type: "string", description: "Nombre exacto de la columna." },
                valor: { type: "string" },
                contiene: {
                  type: ["boolean", "null"],
                  description: "true para coincidencia parcial (texto); false/null para igualdad exacta.",
                },
              },
              required: ["columna", "valor"],
            },
          },
        },
        required: ["tabla"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_ayuda",
      description:
        `Explica CÓMO usar la plataforma (en qué pantalla, qué botón) — no datos, sino instrucciones de uso. Temas cubiertos: ${temasDeAyudaDisponibles().join("; ")}.`,
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string", description: "Qué acción de la plataforma quiere hacer el usuario, en sus propias palabras." },
        },
        required: ["consulta"],
      },
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
      return trabajadoresPorVencer(
        sesion,
        argumentos.centro ? String(argumentos.centro) : null,
        argumentos.estado ? String(argumentos.estado) : null,
      );
    case "distribucion_por_centro":
      return distribucionPorCentro(sesion);
    case "distribucion_por_curso":
      return distribucionPorCurso(sesion);
    case "demografia_trabajadores":
      return demografiaTrabajadores(sesion);
    case "consultar_trabajadores":
      return consultarTrabajadores(sesion, {
        centro: argumentos.centro ? String(argumentos.centro) : undefined,
        cargo: argumentos.cargo ? String(argumentos.cargo) : undefined,
        estado: argumentos.estado ? String(argumentos.estado) : undefined,
      });
    case "consultar_tabla": {
      const filtros = Array.isArray(argumentos.filtros)
        ? (argumentos.filtros as { columna?: unknown; valor?: unknown; contiene?: unknown }[])
            .filter((f) => typeof f.columna === "string" && typeof f.valor === "string")
            .map((f) => ({ columna: f.columna as string, valor: f.valor as string, contiene: f.contiene === true }))
        : [];
      return consultarTabla(String(argumentos.tabla ?? ""), filtros);
    }
    case "buscar_ayuda":
      return buscarAyuda(String(argumentos.consulta ?? ""));
    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}
