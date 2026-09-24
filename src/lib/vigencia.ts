import type { EstadoVigencia } from "@/components/status/sign-badge";

/**
 * `ventanaDias` (por defecto 60) es configurable desde /configuracion
 * (super_admin) — el código de servidor debe pasar el valor ya leído de
 * ahí; el default solo aplica donde no se puede leer esa configuración
 * (esta función también se usa desde un componente cliente).
 */
export function estadoVigenciaDeCurso(vigenciaHasta: string | null, ventanaDias = 60): EstadoVigencia {
  if (!vigenciaHasta) return "sin_capacitacion";
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + ventanaDias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (vigenciaHasta < hoy) return "vencido";
  if (vigenciaHasta <= limite) return "por_vencer";
  return "vigente";
}

const PRIORIDAD: Record<EstadoVigencia, number> = {
  vencido: 0,
  por_vencer: 1,
  sin_capacitacion: 2,
  vigente: 3,
};

export function peorEstadoVigencia(estados: EstadoVigencia[]): EstadoVigencia {
  if (estados.length === 0) return "sin_capacitacion";
  return estados.reduce((peor, actual) => (PRIORIDAD[actual] < PRIORIDAD[peor] ? actual : peor));
}

/**
 * Cuando un trabajador aprueba el mismo curso más de una vez (renovación),
 * la aprobación más reciente reemplaza a la anterior — sólo esa cuenta
 * para el estado de vigencia y para la lista de cursos.
 */
export function ultimoAprobadoPorCurso<T extends { cursoId: string; fechaAprobacion: string | null }>(
  aprobados: T[],
): T[] {
  const porCurso = new Map<string, T>();
  for (const i of aprobados) {
    const actual = porCurso.get(i.cursoId);
    if (!actual || (i.fechaAprobacion ?? "") > (actual.fechaAprobacion ?? "")) {
      porCurso.set(i.cursoId, i);
    }
  }
  return [...porCurso.values()];
}
