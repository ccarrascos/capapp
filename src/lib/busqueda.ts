/**
 * Compara ignorando puntos, guiones y espacios, para que buscar un RUT
 * formateado ("20.811.225-2") encuentre resultados aunque el texto
 * indexado guarde el RUN y el DV por separado, sin formato.
 */
function normalizarParaBusqueda(texto: string): string {
  return texto.toLowerCase().replace(/[.\-\s]/g, "");
}

export function coincideBusqueda(textoBuscable: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (textoBuscable.toLowerCase().includes(q.toLowerCase())) return true;
  return normalizarParaBusqueda(textoBuscable).includes(normalizarParaBusqueda(q));
}
