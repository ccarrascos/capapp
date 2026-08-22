const MARCAS_DIACRITICAS = /[\u0300-\u036F]/g;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFD").replace(MARCAS_DIACRITICAS, "");
}
