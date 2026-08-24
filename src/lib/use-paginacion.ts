"use client";

import { useMemo, useState } from "react";

export type TamanoPagina = number | "todos";

export const OPCIONES_TAMANO_PAGINA: number[] = [10, 25, 50, 100];

/**
 * Pagina un arreglo ya filtrado/ordenado. La búsqueda y los filtros deben
 * aplicarse ANTES de pasar `items` aquí, para que operen sobre el conjunto
 * completo — la paginación sólo decide qué porción de ese resultado se
 * muestra.
 */
export function usePaginacion<T>(items: T[], tamanoInicial: TamanoPagina = 25) {
  const [tamano, setTamanoInterno] = useState<TamanoPagina>(tamanoInicial);
  const [pagina, setPagina] = useState(1);

  // La búsqueda/filtro produce un arreglo nuevo cada vez que cambia — volver
  // a página 1 evita quedar "varado" en una página que ya no tiene datos.
  // Se ajusta durante el render (no en un efecto) siguiendo el patrón de
  // React para derivar estado de un prop que cambió.
  const [itemsPrevios, setItemsPrevios] = useState(items);
  if (items !== itemsPrevios) {
    setItemsPrevios(items);
    if (pagina !== 1) setPagina(1);
  }

  const totalPaginas = tamano === "todos" ? 1 : Math.max(1, Math.ceil(items.length / tamano));
  const paginaActual = Math.min(pagina, totalPaginas);

  const paginaItems = useMemo(() => {
    if (tamano === "todos") return items;
    const inicio = (paginaActual - 1) * tamano;
    return items.slice(inicio, inicio + tamano);
  }, [items, tamano, paginaActual]);

  function setTamano(t: TamanoPagina) {
    setTamanoInterno(t);
    setPagina(1);
  }

  return {
    pagina: paginaActual,
    setPagina,
    tamano,
    setTamano,
    totalPaginas,
    paginaItems,
    totalItems: items.length,
  };
}
