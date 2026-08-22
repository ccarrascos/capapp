import type { EstadoVigencia } from "@/components/status/sign-badge";

export function estadoVigenciaDeCurso(vigenciaHasta: string | null): EstadoVigencia {
  if (!vigenciaHasta) return "sin_capacitacion";
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
