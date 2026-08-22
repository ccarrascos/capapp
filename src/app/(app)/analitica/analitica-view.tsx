"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiTile } from "@/components/dashboard/kpi-tile";

type BucketEdad = { rango: string; cantidad: number };
type EstadoCapacitacion = { estado: string; cantidad: number; color: string };
type CentroCantidad = { centro: string; cantidad: number };
type CumplimientoCentro = Record<string, string | number>;
type EstadoLabel = { label: string; color: string };

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
  histogramaEdad,
  estadoCapacitacion,
  trabajadoresPorCentro,
  cumplimientoPorCentro,
  estadosLabels,
  totalActivos,
  cumplimientoGlobal,
}: {
  histogramaEdad: BucketEdad[];
  estadoCapacitacion: EstadoCapacitacion[];
  trabajadoresPorCentro: CentroCantidad[];
  cumplimientoPorCentro: CumplimientoCentro[];
  estadosLabels: EstadoLabel[];
  totalActivos: number;
  cumplimientoGlobal: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Solo visible para roles de gestión</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Analítica</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Trabajadores activos" value={totalActivos} accent="steel" />
        <KpiTile label="Cumplimiento global" value={cumplimientoGlobal} suffix="%" accent="signal" />
        <KpiTile label="Centros de trabajo" value={trabajadoresPorCentro.length} accent="clear" />
        <KpiTile
          label="Rango etario más numeroso"
          value={histogramaEdad.reduce((max, b) => (b.cantidad > max.cantidad ? b : max), histogramaEdad[0]).rango}
          accent="hazard"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TarjetaGrafico titulo="Histograma de edad" subtitulo="Trabajadores activos por rango etario">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramaEdad} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="rango" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)" }} />
              <Bar dataKey="cantidad" name="Trabajadores" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Estado de capacitación" subtitulo="Distribución según vigencia del art. 16 DS 44">
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
              >
                {estadoCapacitacion.map((e) => (
                  <Cell key={e.estado} fill={e.color} />
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

        <TarjetaGrafico titulo="Trabajadores por centro" subtitulo="Dotación activa por centro de trabajo">
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
              <Bar dataKey="cantidad" name="Trabajadores" fill="var(--chart-4)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Cumplimiento por centro" subtitulo="Desglose de estado de capacitación en cada centro">
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
              {estadosLabels.map((e, i) => (
                <Bar
                  key={e.label}
                  dataKey={e.label}
                  stackId="estado"
                  fill={e.color}
                  radius={i === estadosLabels.length - 1 ? [0, 3, 3, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafico>
      </div>
    </div>
  );
}
