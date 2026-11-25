/** Validadores de entrada para Server Actions: todo input del cliente es no confiable. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function esUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

export function esEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 320 && EMAIL_RE.test(v);
}

export function esTexto(v: unknown, max: number, min = 1): v is string {
  return typeof v === "string" && v.trim().length >= min && v.length <= max;
}

export function esRunNumerico(v: unknown): v is string {
  return typeof v === "string" && /^[1-9]\d{4,7}$/.test(v);
}

/** Texto para planillas: neutraliza celdas que Excel interpretaría como fórmula. */
export function neutralizarFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
