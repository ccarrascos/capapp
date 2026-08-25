const EDAD_MINIMA = 18;

/**
 * Acepta AAAA-MM-DD (ya válido) o DD-MM-AAAA / DD/MM/AAAA (formato chileno,
 * el que suele exportar Excel según la configuración regional) y siempre
 * devuelve AAAA-MM-DD. Devuelve null si el texto no calza con ninguno de
 * los dos formatos — no intenta adivinar formatos ambiguos como AAAA/DD/MM.
 */
export function normalizarFechaNacimiento(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, anio, mes, dia] = iso;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  const diaMesAnio = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (diaMesAnio) {
    const [, dia, mes, anio] = diaMesAnio;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  return null;
}

/** Valida que una fecha de nacimiento (YYYY-MM-DD) no sea hoy, futura, ni corresponda a un menor de edad. */
export function esFechaNacimientoValida(fecha: string): boolean {
  const nacimiento = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (nacimiento >= hoy) return false;

  const limiteEdadMinima = new Date(hoy);
  limiteEdadMinima.setFullYear(hoy.getFullYear() - EDAD_MINIMA);

  return nacimiento <= limiteEdadMinima;
}
