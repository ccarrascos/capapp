/** Utilidades de RUT/RUN chileno: cálculo de dígito verificador, parseo y formato. */

export function calcularDV(run: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = run.length - 1; i >= 0; i--) {
    suma += Number(run[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/** Acepta "12.345.678-9", "12345678-9" o "123456789K" y separa cuerpo/DV. */
export function parsearRut(input: string): { run: string; dv: string } | null {
  const limpio = input.replace(/[.\s]/g, "").toUpperCase();
  const match = limpio.match(/^(\d{1,8})-?([0-9K])$/);
  if (!match) return null;
  return { run: match[1], dv: match[2] };
}

export function esRutValido(run: string, dv: string): boolean {
  if (!/^\d+$/.test(run)) return false;
  return calcularDV(run) === dv.toUpperCase();
}

export function formatearRut(run: string, dv: string): string {
  const conPuntos = run.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conPuntos}-${dv}`;
}

/** Para inputs de un solo campo "RUT": formatea con puntos y guión a medida que se escribe. */
export function formatearRutInput(value: string): string {
  const limpio = value
    .replace(/[^0-9kK]/g, "")
    .toUpperCase()
    .slice(0, 9);
  if (limpio.length === 0) return "";
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (cuerpo.length === 0) return dv;
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conPuntos}-${dv}`;
}

/** Para inputs de RUN separados del DV: formatea solo el cuerpo con puntos a medida que se escribe. */
export function formatearRunInput(value: string): string {
  const limpio = value.replace(/[^0-9]/g, "").slice(0, 8);
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
