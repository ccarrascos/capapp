const EDAD_MINIMA = 18;

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
