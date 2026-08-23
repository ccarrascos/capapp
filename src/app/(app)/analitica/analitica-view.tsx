"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { X, ShieldCheck, Clock, ShieldAlert, CircleHelp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@/components/ui/table";

type EstadoConfig = { estado: string; label: string; color: string };
type FilaAnalitica = {
  centro: string;
  edad: number | null;
  estado: string;
  tipoVinculo: "directo" | "subcontrato";
  subcontrato: string | null;
};

const TIPO_VINCULO_LABEL: Record<"directo" | "subcontrato", string> = {
  directo: "Directo",
  subcontrato: "Subcontrato",
};

const ESTADO_ICONOS: Record<string, LucideIcon> = {
  vigente: ShieldCheck,
  por_vencer: Clock,
  vencido: ShieldAlert,
  sin_capacitacion: CircleHelp,
};

const ESTADO_SUBTITULO: Record<string, string> = {
  vigente: "Al día",
  por_vencer: "Vence en 60 días",
  vencido: "Curso vencido",
  sin_capacitacion: "Nunca capacitado",
};

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

type Filtros = {
  centro: string | null;
  estado: string | null;
  rango: string | null;
  tipoVinculo: "directo" | "subcontrato" | null;
  subcontrato: string | null;
};

function aplicarFiltros(
  datos: FilaAnalitica[],
  filtros: Filtros,
  opts: {
    excluirCentro?: boolean;
    excluirEstado?: boolean;
    excluirRango?: boolean;
    excluirTipoVinculo?: boolean;
    excluirSubcontrato?: boolean;
  } = {},
) {
  return datos.filter(
    (f) =>
      (opts.excluirCentro || !filtros.centro || f.centro === filtros.centro) &&
      (opts.excluirEstado || !filtros.estado || f.estado === filtros.estado) &&
      (opts.excluirRango || !filtros.rango || rangoDeEdad(f.edad) === filtros.rango) &&
      (opts.excluirTipoVinculo || !filtros.tipoVinculo || f.tipoVinculo === filtros.tipoVinculo) &&
      (opts.excluirSubcontrato || !filtros.subcontrato || f.subcontrato === filtros.subcontrato),
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
};

const ETIQUETA_STYLE = { fontSize: 11, fontWeight: 600, fill: "var(--foreground)" };

function TarjetaGrafico({
  titulo,
  subtitulo,
  height = 288,
  children,
}: {
  titulo: string;
  subtitulo: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card p-5 flex flex-col gap-1">
      <h2 className="font-heading text-base font-bold uppercase tracking-wide">{titulo}</h2>
      <p className="text-xs text-muted-foreground mb-3">{subtitulo}</p>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

/** Medidor semicircular — aguja implícita vía un arco de 180°, al estilo "% to target" de un panel ejecutivo. */
function SemiGauge({ pct, color }: { pct: number; color: string }) {
  const valor = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const datos = [
    { nombre: "valor", cantidad: valor },
    { nombre: "resto", cantidad: 100 - valor },
  ];
  return (
    <div className="relative w-full" style={{ height: 92 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={datos}
            dataKey="cantidad"
            nameKey="nombre"
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="94%"
            innerRadius="74%"
            outerRadius="100%"
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <span className="font-heading text-lg font-bold tabular-nums">{valor.toFixed(2)}%</span>
      </div>
      <div className="absolute inset-x-1 bottom-0 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0.00%</span>
        <span>100.00%</span>
      </div>
    </div>
  );
}

function KpiGaugeCard({
  icon: Icon,
  label,
  sublabel,
  valor,
  pct,
  color,
  seleccionado,
  atenuado,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  valor: number;
  pct: number;
  color: string;
  seleccionado: boolean;
  atenuado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border bg-card p-4 flex flex-col gap-2.5 text-left transition-colors",
        seleccionado ? "border-foreground/40" : "border-border",
        atenuado && "opacity-45",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)` }}
        >
          <Icon className="size-4" style={{ color }} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold leading-tight">{label}</p>
          <p className="text-[10.5px] text-muted-foreground leading-tight">{sublabel}</p>
        </div>
      </div>
      <p className="font-heading text-4xl font-bold leading-none tabular-nums" style={{ color }}>
        {valor}
      </p>
      <p className="text-[10.5px] text-muted-foreground -mt-1 leading-tight">% del total en pantalla</p>
      <SemiGauge pct={pct} color={color} />
    </button>
  );
}

function TarjetaVinculo({
  datos,
  filtroTipoVinculo,
  toggleTipoVinculo,
}: {
  datos: { tipo: string; codigo: "directo" | "subcontrato"; cantidad: number }[];
  filtroTipoVinculo: "directo" | "subcontrato" | null;
  toggleTipoVinculo: (t: "directo" | "subcontrato") => void;
}) {
  const total = datos.reduce((s, d) => s + d.cantidad, 0);
  return (
    <div className="border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-[13px] font-semibold">Vínculo laboral</p>
      <p className="text-[11px] text-muted-foreground mb-1">Directo vs. subcontrato</p>
      <div className="relative" style={{ height: 116 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="cantidad"
              nameKey="tipo"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={54}
              paddingAngle={3}
              stroke="none"
              cursor="pointer"
              isAnimationActive={false}
            >
              {datos.map((t, i) => (
                <Cell
                  key={t.codigo}
                  fill={i === 0 ? "var(--chart-1)" : "var(--chart-4)"}
                  fillOpacity={opacidad(!!filtroTipoVinculo, filtroTipoVinculo === t.codigo)}
                  onClick={() => toggleTipoVinculo(t.codigo)}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-heading text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {datos.map((t, i) => (
          <button
            key={t.codigo}
            type="button"
            onClick={() => toggleTipoVinculo(t.codigo)}
            className={cn(
              "flex flex-col gap-0.5 text-xs px-1 py-0.5 -mx-1",
              filtroTipoVinculo && filtroTipoVinculo !== t.codigo && "opacity-40",
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: i === 0 ? "var(--chart-1)" : "var(--chart-4)" }}
              />
              <span>{t.tipo}</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground pl-3.5">
              {t.cantidad} ({total > 0 ? Math.round((t.cantidad / total) * 100) : 0}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AnaliticaView({
  filas,
  estadosConfig,
}: {
  filas: FilaAnalitica[];
  estadosConfig: EstadoConfig[];
}) {
  const centros = useMemo(() => [...new Set(filas.map((f) => f.centro))].sort(), [filas]);
  const subcontratosNombres = useMemo(
    () => [...new Set(filas.map((f) => f.subcontrato).filter((s): s is string => !!s))].sort(),
    [filas],
  );

  const [filtroCentro, setFiltroCentro] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null);
  const [filtroRango, setFiltroRango] = useState<string | null>(null);
  const [filtroTipoVinculo, setFiltroTipoVinculo] = useState<"directo" | "subcontrato" | null>(null);
  const [filtroSubcontrato, setFiltroSubcontrato] = useState<string | null>(null);

  function toggleCentro(c: string) {
    setFiltroCentro((prev) => (prev === c ? null : c));
  }
  function toggleEstado(e: string) {
    setFiltroEstado((prev) => (prev === e ? null : e));
  }
  function toggleRango(r: string) {
    setFiltroRango((prev) => (prev === r ? null : r));
  }
  function toggleTipoVinculo(t: "directo" | "subcontrato") {
    setFiltroTipoVinculo((prev) => (prev === t ? null : t));
    if (t === "directo") setFiltroSubcontrato(null);
  }
  function toggleSubcontrato(s: string) {
    setFiltroSubcontrato((prev) => (prev === s ? null : s));
    setFiltroTipoVinculo("subcontrato");
  }

  const filtros: Filtros = useMemo(
    () => ({
      centro: filtroCentro,
      estado: filtroEstado,
      rango: filtroRango,
      tipoVinculo: filtroTipoVinculo,
      subcontrato: filtroSubcontrato,
    }),
    [filtroCentro, filtroEstado, filtroRango, filtroTipoVinculo, filtroSubcontrato],
  );
  const hayFiltros = !!(filtroCentro || filtroEstado || filtroRango || filtroTipoVinculo || filtroSubcontrato);

  function limpiarFiltros() {
    setFiltroCentro(null);
    setFiltroEstado(null);
    setFiltroRango(null);
    setFiltroTipoVinculo(null);
    setFiltroSubcontrato(null);
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
  const promedioEdadHistograma = useMemo(() => {
    if (histogramaEdad.length === 0) return 0;
    return histogramaEdad.reduce((s, r) => s + r.cantidad, 0) / histogramaEdad.length;
  }, [histogramaEdad]);

  const baseEstado = useMemo(() => aplicarFiltros(filas, filtros, { excluirEstado: true }), [filas, filtros]);
  const totalBaseEstado = baseEstado.length;
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

  const baseCumplimiento = useMemo(() => aplicarFiltros(filas, filtros, { excluirEstado: true }), [filas, filtros]);
  const cumplimientoPorCentro = useMemo(
    () =>
      centros
        .map((centro) => {
          const filasDelCentro = baseCumplimiento.filter((f) => f.centro === centro);
          const porEstado = Object.fromEntries(
            estadosConfig.map((e) => [e.estado, filasDelCentro.filter((f) => f.estado === e.estado).length]),
          );
          const total = filasDelCentro.length;
          const vigente = porEstado["vigente"] ?? 0;
          return { centro, porEstado, total, pctVigente: total > 0 ? Math.round((vigente / total) * 100) : 0 };
        })
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    [baseCumplimiento, centros, estadosConfig],
  );
  const totalGeneral = useMemo(
    () => cumplimientoPorCentro.reduce((s, c) => s + c.total, 0),
    [cumplimientoPorCentro],
  );
  const totalGeneralPorEstado = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of estadosConfig) {
      acc[e.estado] = cumplimientoPorCentro.reduce((s, c) => s + (c.porEstado[e.estado] ?? 0), 0);
    }
    return acc;
  }, [cumplimientoPorCentro, estadosConfig]);
  const maxTotalCentro = useMemo(
    () => Math.max(1, ...cumplimientoPorCentro.map((c) => c.total)),
    [cumplimientoPorCentro],
  );

  const baseTipoVinculo = useMemo(
    () => aplicarFiltros(filas, filtros, { excluirTipoVinculo: true, excluirSubcontrato: true }),
    [filas, filtros],
  );
  const porTipoVinculo = useMemo(
    () =>
      (["directo", "subcontrato"] as const).map((t) => ({
        tipo: TIPO_VINCULO_LABEL[t],
        codigo: t,
        cantidad: baseTipoVinculo.filter((f) => f.tipoVinculo === t).length,
      })),
    [baseTipoVinculo],
  );

  const baseSubcontrato = useMemo(() => aplicarFiltros(filas, filtros, { excluirSubcontrato: true }), [filas, filtros]);
  const trabajadoresPorSubcontrato = useMemo(
    () =>
      subcontratosNombres
        .map((sub) => ({ subcontrato: sub, cantidad: baseSubcontrato.filter((f) => f.subcontrato === sub).length }))
        .filter((s) => s.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad),
    [baseSubcontrato, subcontratosNombres],
  );

  const filasFiltradas = useMemo(() => aplicarFiltros(filas, filtros), [filas, filtros]);
  const totalActivos = filasFiltradas.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Solo visible para roles de gestión · {totalActivos} trabajadores en pantalla
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Analítica</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5 w-full sm:w-48">
            <Label className="text-xs">Centro de trabajo</Label>
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
          <div className="flex flex-col gap-1.5 w-full sm:w-48">
            <Label className="text-xs">Tipo de vínculo</Label>
            <Select
              items={{ todos: "Todos", ...TIPO_VINCULO_LABEL }}
              value={filtroTipoVinculo ?? "todos"}
              onValueChange={(v) => {
                const nuevo = !v || v === "todos" ? null : (v as "directo" | "subcontrato");
                setFiltroTipoVinculo(nuevo);
                if (nuevo !== "subcontrato") setFiltroSubcontrato(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="directo">Directo</SelectItem>
                <SelectItem value="subcontrato">Subcontrato</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          {filtroTipoVinculo && (
            <button
              onClick={() => {
                setFiltroTipoVinculo(null);
                setFiltroSubcontrato(null);
              }}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
            >
              Vínculo: {TIPO_VINCULO_LABEL[filtroTipoVinculo]} <X className="size-3" />
            </button>
          )}
          {filtroSubcontrato && (
            <button
              onClick={() => setFiltroSubcontrato(null)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70"
            >
              Subcontrato: {filtroSubcontrato} <X className="size-3" />
            </button>
          )}
          <Button size="sm" variant="ghost" onClick={limpiarFiltros} className="h-6 text-xs">
            Limpiar todo
          </Button>
        </div>
      )}

      {/* KPI + medidores, al estilo de un panel ejecutivo: ícono, cifra, gauge de % del total */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {estadoCapacitacion.map((e) => (
          <KpiGaugeCard
            key={e.codigo}
            icon={ESTADO_ICONOS[e.codigo] ?? CircleHelp}
            label={e.estado}
            sublabel={ESTADO_SUBTITULO[e.codigo] ?? ""}
            valor={e.cantidad}
            pct={totalBaseEstado > 0 ? (e.cantidad / totalBaseEstado) * 100 : 0}
            color={e.color}
            seleccionado={filtroEstado === e.codigo}
            atenuado={!!filtroEstado && filtroEstado !== e.codigo}
            onClick={() => toggleEstado(e.codigo)}
          />
        ))}
        <TarjetaVinculo
          datos={porTipoVinculo}
          filtroTipoVinculo={filtroTipoVinculo}
          toggleTipoVinculo={toggleTipoVinculo}
        />
      </div>

      {/* Detalle por dimensión: edad, subcontrato, centro y una tabla rankeada */}
      <div className="grid lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <TarjetaGrafico titulo="Distribución etaria" subtitulo="Clic en una barra para filtrar por rango" height={186}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramaEdad} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="rango" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis hide domain={[0, "dataMax + 4"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
                <ReferenceLine y={promedioEdadHistograma} stroke="var(--alert)" strokeDasharray="4 4" strokeWidth={1} />
                <Bar dataKey="cantidad" name="Trabajadores" radius={[3, 3, 0, 0]} cursor="pointer">
                  <LabelList dataKey="cantidad" position="top" style={ETIQUETA_STYLE} />
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

          <TarjetaGrafico
            titulo="Trabajadores por subcontrato"
            subtitulo="Clic en una barra para filtrar por ese subcontrato"
            height={186}
          >
            {trabajadoresPorSubcontrato.length === 0 ? (
              <p className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No hay trabajadores subcontratados con los filtros actuales.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trabajadoresPorSubcontrato}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    dataKey="subcontrato"
                    type="category"
                    width={104}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="cantidad" name="Trabajadores" radius={[0, 3, 3, 0]} cursor="pointer" barSize={16}>
                    <LabelList dataKey="cantidad" position="right" style={ETIQUETA_STYLE} />
                    {trabajadoresPorSubcontrato.map((entry) => (
                      <Cell
                        key={entry.subcontrato}
                        fill="var(--chart-4)"
                        fillOpacity={opacidad(!!filtroSubcontrato, filtroSubcontrato === entry.subcontrato)}
                        onClick={() => toggleSubcontrato(entry.subcontrato)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </TarjetaGrafico>
        </div>

        <div className="lg:col-span-3">
          <TarjetaGrafico titulo="Trabajadores por centro" subtitulo="Clic en una barra para filtrar por centro" height={396}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trabajadoresPorCentro} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  dataKey="centro"
                  type="category"
                  width={88}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="cantidad" name="Trabajadores" radius={[0, 3, 3, 0]} cursor="pointer" barSize={14}>
                  <LabelList dataKey="cantidad" position="right" style={ETIQUETA_STYLE} />
                  {trabajadoresPorCentro.map((entry) => (
                    <Cell
                      key={entry.centro}
                      fill="var(--chart-1)"
                      fillOpacity={opacidad(!!filtroCentro, filtroCentro === entry.centro)}
                      onClick={() => toggleCentro(entry.centro)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafico>
        </div>

        <div className="lg:col-span-4">
          <div className="border border-border bg-card p-5 flex flex-col gap-1 h-full">
            <h2 className="font-heading text-base font-bold uppercase tracking-wide">Cumplimiento por centro</h2>
            <p className="text-xs text-muted-foreground mb-3">Ordenado por total de trabajadores · clic en una fila para filtrar</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro</TableHead>
                    <TableHead className="text-right">Vig.</TableHead>
                    <TableHead className="text-right">P.V.</TableHead>
                    <TableHead className="text-right">Venc.</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cumplimientoPorCentro.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Sin datos para los filtros actuales.
                      </TableCell>
                    </TableRow>
                  )}
                  {cumplimientoPorCentro.map((c) => (
                    <TableRow
                      key={c.centro}
                      className={cn(
                        "cursor-pointer",
                        filtroCentro && filtroCentro !== c.centro && "opacity-40",
                        filtroCentro === c.centro && "bg-accent/40",
                      )}
                      onClick={() => toggleCentro(c.centro)}
                    >
                      <TableCell className="font-medium">{c.centro}</TableCell>
                      <TableCell className="text-right text-clear tabular-nums">{c.porEstado["vigente"] ?? 0}</TableCell>
                      <TableCell className="text-right text-hazard-foreground tabular-nums">
                        {c.porEstado["por_vencer"] ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-alert tabular-nums">{c.porEstado["vencido"] ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-muted flex-1 max-w-14">
                            <div
                              className="h-1.5 bg-primary"
                              style={{ width: `${Math.round((c.total / maxTotalCentro) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums w-6 text-right">{c.total}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {cumplimientoPorCentro.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right text-clear tabular-nums font-semibold">
                        {totalGeneralPorEstado["vigente"] ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-hazard-foreground tabular-nums font-semibold">
                        {totalGeneralPorEstado["por_vencer"] ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-alert tabular-nums font-semibold">
                        {totalGeneralPorEstado["vencido"] ?? 0}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums font-semibold">{totalGeneral}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
