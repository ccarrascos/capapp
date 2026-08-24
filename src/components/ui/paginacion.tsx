"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPCIONES_TAMANO_PAGINA, type TamanoPagina } from "@/lib/use-paginacion";

export function Paginacion({
  pagina,
  totalPaginas,
  totalItems,
  tamano,
  onTamanoChange,
  onPaginaChange,
  etiqueta = "registro",
}: {
  pagina: number;
  totalPaginas: number;
  totalItems: number;
  tamano: TamanoPagina;
  onTamanoChange: (t: TamanoPagina) => void;
  onPaginaChange: (p: number) => void;
  etiqueta?: string;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline">Mostrar</span>
        <Select
          items={{
            ...Object.fromEntries(OPCIONES_TAMANO_PAGINA.map((n) => [String(n), String(n)])),
            todos: "Todos",
          }}
          value={tamano === "todos" ? "todos" : String(tamano)}
          onValueChange={(v) => onTamanoChange(v === "todos" ? "todos" : Number(v))}
        >
          <SelectTrigger className="w-[4.5rem] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_TAMANO_PAGINA.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <span>por página</span>
      </div>

      <div className="flex items-center gap-4">
        {tamano !== "todos" && totalPaginas > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              disabled={pagina <= 1}
              onClick={() => onPaginaChange(pagina - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm tabular-nums whitespace-nowrap">
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              disabled={pagina >= totalPaginas}
              onClick={() => onPaginaChange(pagina + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {totalItems} {etiqueta}
          {totalItems === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
