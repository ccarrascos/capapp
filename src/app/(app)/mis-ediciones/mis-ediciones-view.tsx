"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";

type Edicion = {
  id: string;
  fecha_inicio: string;
  fecha_limite: string;
  fecha_termino: string | null;
  estado: string;
  cursos: { nombre: string } | null;
};

export function MisEdicionesView({ ediciones }: { ediciones: Edicion[] }) {
  const { pagina, setPagina, tamano, setTamano, totalPaginas, paginaItems, totalItems } =
    usePaginacion(ediciones);

  return (
    <div className="border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Curso</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Límite (3 meses)</TableHead>
            <TableHead>Término</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totalItems === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                No tienes ediciones de curso asignadas todavía.
              </TableCell>
            </TableRow>
          )}
          {paginaItems.map((e) => (
            <TableRow key={e.id} className="cursor-pointer hover:bg-accent/40">
              <TableCell className="font-medium">
                <Link href={`/ediciones/${e.id}`} className="block">
                  {e.cursos?.nombre}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm">{e.fecha_inicio}</TableCell>
              <TableCell className="font-mono text-sm">{e.fecha_limite}</TableCell>
              <TableCell className="font-mono text-sm">{e.fecha_termino ?? "—"}</TableCell>
              <TableCell className="capitalize">{e.estado.replace(/_/g, " ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        totalItems={totalItems}
        tamano={tamano}
        onTamanoChange={setTamano}
        onPaginaChange={setPagina}
        etiqueta="edición"
      />
    </div>
  );
}
