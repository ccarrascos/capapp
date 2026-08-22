"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { X } from "lucide-react";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type EstadoConfig = { estado: string; label: string; color: string };
type FilaAnalitica = { centro: string; edad: number | null; estado: string };

const RANGOS_EDAD: { label: string; min: number; max: number }[] = [
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55-64", min: 55, max: 64 },
  { label: "65+", min: 65, max: 999 },
];

function rangoDeEdad(edad: number | null): string | null {
  if (edad === null) return null;
  return RANGOS_EDAD.find((r) => edad >= r.min && edad <= r.max)?.label ?? null;
}

function opacidad(seleccionActiva: boolean, esteSeleccionado: boolean) {
  if (!seleccionActiva) return 1;
  return esteSeleccionado ? 1 : 0.3;
}

type Filtros = { centro: string | null; estado: string | null; rango: string | null };

function aplicarFiltros(
  datos: FilaAnalitica[],
  filtros: Filtros,
  opts: { excluirCentro?: boolean; excluirEstado?: boolean; excluirRango?: boolean } = {},
) {
  return datos.filter(
    (f) =>
      (opts.excluirCentro || !filtros.centro || f.centro === filtros.centro) &&
      (opts.excluirEstado || !filtros.estado || f.estado === filtros.estado) &&
      (opts.excluirRango || !filtros.rango || rangoDeEdad(f.edad) === filtros.rango),
  );
}

function TarjetaGrafico({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-5 flex flex-col gap-1">
      <h2 className="font-heading text-base font-bold uppercase tracking-wide">{titulo}</h2>
      <p className="text-xs text-muted-foreground mb-3">{subtitulo}</p>
      <div className="h-72">{children}</div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
};

export function AnaliticaView({
  filas,
  estadosConfig,
}: {
  filas: FilaAnalitica[];
  estadosConfig: EstadoConfig[];
}) {
  const centros = useMemo(() => [...new Set(filas.map((f) => f.centro))].sort(), [filas]);

  const [filtroCentro, setFiltroCentro] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [filtroRango, setFiltroRango] = useState<string | null>(null);

  function toggleCentro(c: string) {
    setFiltroCentro((prev) => (prev === c ? null : c));
  }
  function toggleEstado(e: string) {
    setFiltroEstado((prev) => (prev === e ? null : e));
  }
  function toggleRango(r: string) {
    setFiltroRango((prev) => (prev === r ? null : r));
  }

  const filtros: Filtros = useMemo(
    () => ({ centro: filtroCentro, estado: filtroEstado, rango: filtroRango }),
    [filtroCentro, filtroEstado, filtroRango],
  );
  const hayFiltros = !!(filtroCentro || filtroEstado || filtroRango);

  function limpiarFiltros() {
    setFiltroCentro(null);
    setFiltroEstado(null);
    setFiltroRango(null);
  }

  // Cada gráfico se calcula excluyendo su propia dimensión de los filtros
  // (para seguir mostrando todas sus categorías) pero aplicando los filtros
  // de las demás dimensiones — así un clic en cualquier gráfico refina a
  // los demás, al estilo de un cross-filter de Power BI.

  const baseEdad = useMemo(() => aplicarFiltros(filas, filtros, { excluirRango: true }), [filas, filtros]);
  const histogramaEdad = useMemo(
    () =>
      RANGOS_EDAD.map((rango) => ({
        rango: rango.label,
        cantidad: baseEdad.filter((f) => f.edad !== null && f.edad >= rango.min && f.edad <= rango.max).length,
      })),
    [baseEdad],
  );

  const baseEstado = useMemo(() => aplicarFiltros(filas, filtros, { excluirEstado: true }), [filas, filtros]);
  const estadoCapacitacion = useMemo(
    () =>
      estadosConfig.map((e) => ({
        estado: e.label,
        codigo: e.estado,
        cantidad: baseEstado.filter((f) => f.estado === e.estado).length,
        color: e.color,
      })),
    [baseEstado, estadosConfig],
  );

  const baseCentro = useMemo(() => aplicarFiltros(filas, filtros, { excluirCentro: true }), [filas, filtros]);
  const trabajadoresPorCentro = useMemo(
    () =>
      centros
        .map((centro) => ({ centro, cantidad: baseCentro.filter((f) => f.centro === centro).length }))
        .filter((c) => c.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad),
    [baseCentro, centros],
  );

  const baseCumplimiento = useMemo(
    () => aplicarFiltros(filas, filtros, { excluirEstado: true }),
    [filas, filtros],
  );
  const cumplimientoPorCentro = useMemo(
    () =>
      centros
        .map((centro) => {
          const filasDelCentro = baseCumplimiento.filter((f) => f.centro === centro);
          const fila: Record<string, string | number> = { centro };
          for (const e of estadosConfig) {
            fila[e.label] = filasDelCentro.filter((f) => f.estado === e.estado).length;
          }
          return fila;
        })
        .filter((c) => estadosConfig.some((e) => (c[e.label] as number) > 0))
        .sort((a, b) => (b.Vigente as number) - (a.Vigente as number)),
    [baseCumplimiento, centros, estadosConfig],
  );

  const filasFiltradas = useMemo(() => aplicarFiltros(filas, filtros), [filas, filtros]);
  const totalActivos = filasFiltradas.length;
  const vigentes = filasFiltradas.filter((f) => f.estado === "vigente").length;
  const cumplimientoGlobal = totalActivos > 0 ? Math.round((vigentes / totalActivos) * 100) : 0;
  const rangoMasNumeroso =
    totalActivos > 0
      ? histogramaEdad.reduce((max, b) => (b.cantidad > max.cantidad ? b : max), histogramaEdad[0]).rango
      : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Solo visible para roles de gestión</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Analítica</h1>
        </div>
        <div className="flex flex-col gap-1.5 w-full sm:w-56">
          <Label>Centro de trabajo</Label>
          <Select
            items={{ todos: "Todos los centros", ...Object.fromEntries(centros.map((c) => [c, c])) }}
            value={filtroCentro ?? "todos"}
            onValueChange={(v) => setFiltroCentro(!v || v === "todos" ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los centros</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <span className="text-xs text-muted-foreground">Filtros activos (clic en un gráfico para cruzar datos):</span>
          {filtroCentro && (
            <button
              onClick={() => setFiltroCentro(null)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
            >
              Centro: {filtroCentro} <X className="size-3" />
            </button>
          )}
          {filtroEstado && (
            <button
              onClick={() => setFiltroEstado(null)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
            >
              Estado: {estadosConfig.find((e) => e.estado === filtroEstado)?.label} <X className="size-3" />
            </button>
          )}
          {filtroRango && (
            <button
              onClick={() => setFiltroRango(null)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
            >
              Edad: {filtroRango} <X className="size-3" />
            </button>
          )}
          <Button size="sm" variant="ghost" onClick={limpiarFiltros} className="h-6 text-xs">
            Limpiar todo
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Trabajadores" value={totalActivos} accent="steel" />
        <KpiTile label="Cumplimiento" value={cumplimientoGlobal} suffix="%" accent="signal" />
        <KpiTile label="Centros" value={trabajadoresPorCentro.length} accent="clear" />
        <KpiTile label="Rango etario más numeroso" value={rangoMasNumeroso} accent="hazard" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TarjetaGrafico titulo="Histograma de edad" subtitulo="Clic en una barra para filtrar por rango etario">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramaEdad} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="rango" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
              <Bar dataKey="cantidad" name="Trabajadores" radius={[3, 3, 0, 0]} cursor="pointer">
                {histogramaEdad.map((entry) => (
                  <Cell
                    key={entry.rango}
                    fill="var(--chart-1)"
                    fillOpacity={opacidad(!!filtroRango, filtroRango === entry.rango)}
                    onClick={() => toggleRango(entry.rango)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Estado de capacitación" subtitulo="Clic en un segmento para filtrar por estado">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={estadoCapacitacion}
                dataKey="cantidad"
                nameKey="estado"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                cursor="pointer"
              >
                {estadoCapacitacion.map((e) => (
                  <Cell
                    key={e.estado}
                    fill={e.color}
                    fillOpacity={opacidad(!!filtroEstado, filtroEstado === e.codigo)}
                    onClick={() => toggleEstado(e.codigo)}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="bottom"
                height={32}
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Trabajadores por centro" subtitulo="Clic en una barra para filtrar por centro">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trabajadoresPorCentro} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="centro"
                type="category"
                width={90}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
              <Bar dataKey="cantidad" name="Trabajadores" radius={[0, 3, 3, 0]} cursor="pointer">
                {trabajadoresPorCentro.map((entry) => (
                  <Cell
                    key={entry.centro}
                    fill="var(--chart-4)"
                    fillOpacity={opacidad(!!filtroCentro, filtroCentro === entry.centro)}
                    onClick={() => toggleCentro(entry.centro)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Cumplimiento por centro" subtitulo="Clic en un color para filtrar por ese estado">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cumplimientoPorCentro} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="centro"
                type="category"
                width={90}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
              {estadosConfig.map((e, i) => (
                <Bar
                  key={e.label}
                  dataKey={e.label}
                  stackId="estado"
                  fill={e.color}
                  fillOpacity={opacidad(!!filtroEstado, filtroEstado === e.estado)}
                  cursor="pointer"
                  onClick={() => toggleEstado(e.estado)}
                  radius={i === estadosConfig.length - 1 ? [0, 3, 3, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>
      </div>
    </div>
  );
}
