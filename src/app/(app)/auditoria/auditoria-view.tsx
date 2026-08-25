"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coincideBusqueda } from "@/lib/busqueda";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";

type Entrada = {
  id: string;
  accion: string;
  tabla: string;
  registro_id: string | null;
  datos_anteriores: unknown;
  datos_nuevos: unknown;
  created_at: string;
  usuarios: { nombres: string; apellidos: string; email: string } | null;
};

const ACCION_LABEL: Record<string, string> = {
  crear_usuario: "Creó la cuenta",
  cambiar_rol: "Cambió el rol",
  reactivar_usuario: "Reactivó la cuenta",
  desactivar_usuario: "Desactivó la cuenta",
  reactivar_organizacion: "Reactivó la organización",
  desactivar_organizacion: "Desactivó la organización",
  dar_acceso_trabajador: "Dio acceso al trabajador",
};

function resumenCambio(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "";
  return Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function textoBuscable(e: Entrada): string {
  return [
    ACCION_LABEL[e.accion] ?? e.accion,
    e.tabla,
    e.usuarios ? `${e.usuarios.nombres} ${e.usuarios.apellidos} ${e.usuarios.email}` : null,
    resumenCambio(e.datos_anteriores),
    resumenCambio(e.datos_nuevos),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function AuditoriaView({ entradas }: { entradas: Entrada[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(
    () => (busqueda.trim() ? entradas.filter((e) => coincideBusqueda(textoBuscable(e), busqueda)) : entradas),
    [entradas, busqueda],
  );

  const { pagina, setPagina, tamano, setTamano, totalPaginas, paginaItems, totalItems } = usePaginacion(filtradas);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Alcance super administrador</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Auditoría</h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {totalItems} evento{totalItems === 1 ? "" : "s"} · últimos 300 registrados
        </p>
        <SearchInput
          className="w-full sm:w-72"
          placeholder="Buscar por acción, persona, tabla…"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Quién</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  {entradas.length === 0
                    ? "Todavía no hay eventos registrados."
                    : "No hay eventos que coincidan con el filtro."}
                </TableCell>
              </TableRow>
            )}
            {paginaItems.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("es-CL")}
                </TableCell>
                <TableCell className="text-sm">
                  {e.usuarios ? `${e.usuarios.nombres} ${e.usuarios.apellidos}` : "—"}
                </TableCell>
                <TableCell className="text-sm font-medium">{ACCION_LABEL[e.accion] ?? e.accion}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md">
                  {Boolean(e.datos_anteriores) && (
                    <div>
                      <span className="text-muted-foreground/70">Antes: </span>
                      {resumenCambio(e.datos_anteriores)}
                    </div>
                  )}
                  {Boolean(e.datos_nuevos) && (
                    <div>
                      <span className="text-muted-foreground/70">Después: </span>
                      {resumenCambio(e.datos_nuevos)}
                    </div>
                  )}
                </TableCell>
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
          etiqueta="evento"
        />
      </div>
    </div>
  );
}
