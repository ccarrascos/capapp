import Link from "next/link";
import { redirect } from "next/navigation";
import { getSesion, centrosVisibles, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { SignBadge, type EstadoVigencia } from "@/components/status/sign-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ORG_ROLES = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function DashboardPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const esRolOrg = sesion.roles.some((r) => ORG_ROLES.includes(r.rol as (typeof ORG_ROLES)[number]));
  const esFacilitador = sesion.roles.some((r) => r.rol === "facilitador");

  if (esRolOrg) return <DashboardOrganizacion nombres={sesion.nombres} sesion={sesion} />;
  if (esFacilitador) return <DashboardFacilitador nombres={sesion.nombres} />;
  // Quien solo tiene el rol trabajador no tiene un panel propio — "Mi capacitación"
  // ya muestra ese mismo resumen más el historial completo, sin duplicar destino.
  redirect("/mi-capacitacion");
}

async function DashboardOrganizacion({ nombres, sesion }: { nombres: string; sesion: Sesion }) {
  const supabase = await createClient();
  const { data: matriz } = await supabase
    .from("matriz_vigencia_capacitacion")
    .select("*")
    .eq("trabajador_activo", true);

  const filas = (matriz ?? []).filter((f) => {
    if (sesion.esSuperAdmin || !f.organizacion_id) return true;
    const cv = centrosVisibles(sesion, f.organizacion_id);
    return cv === "todos" || (f.centro_trabajo_id != null && cv.includes(f.centro_trabajo_id));
  });
  const total = filas.length;
  const conteo = (estado: EstadoVigencia) => filas.filter((f) => f.estado_vigencia === estado).length;
  const vigentes = conteo("vigente");
  const porVencer = conteo("por_vencer");
  const vencidos = conteo("vencido");
  const sinCapacitacion = conteo("sin_capacitacion");
  const cumplimiento = total > 0 ? Math.round((vigentes / total) * 100) : 0;

  // Prioriza lo que aún se puede evitar (por vencer, ordenado por lo más próximo)
  // y solo completa con lo ya vencido si sobra espacio — así el bloque muestra
  // primero lo accionable, no solo lo que ya se pasó.
  const porVencerOrdenados = filas
    .filter((f) => f.estado_vigencia === "por_vencer")
    .sort((a, b) => (a.vigencia_hasta ?? "").localeCompare(b.vigencia_hasta ?? ""));
  const vencidosOrdenados = filas
    .filter((f) => f.estado_vigencia === "vencido")
    .sort((a, b) => (b.vigencia_hasta ?? "").localeCompare(a.vigencia_hasta ?? ""));
  const proximos = [...porVencerOrdenados, ...vencidosOrdenados].slice(0, 8);

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Panel de cumplimiento
        </p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
          Hola, {nombres}
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile label="Trabajadores" value={total} accent="steel" />
        <KpiTile label="Vigentes" value={vigentes} accent="clear" />
        <KpiTile label="Por vencer (60 días)" value={porVencer} accent="hazard" />
        <KpiTile label="Vencidos / sin curso" value={vencidos + sinCapacitacion} accent="alert" />
        <KpiTile label="Cumplimiento" value={cumplimiento} suffix="%" accent="signal" />
      </div>

      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            Por vencer y vencidos
          </h2>
          <Button render={<Link href="/trabajadores" />} nativeButton={false} variant="outline" size="sm">
            Ver matriz completa
          </Button>
        </div>

        {proximos.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            No hay vencimientos próximos ni pendientes. La matriz está al día.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>RUN</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proximos.map((f) => (
                <TableRow key={f.persona_run}>
                  <TableCell className="font-medium">
                    {f.nombres} {f.apellido_paterno}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {f.run}-{f.dv}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.cargo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{f.vigencia_hasta ?? "—"}</TableCell>
                  <TableCell>
                    <SignBadge estado={f.estado_vigencia as EstadoVigencia} size="sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

async function DashboardFacilitador({ nombres }: { nombres: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: facilitador } = await supabase
    .from("facilitadores")
    .select("id")
    .eq("usuario_id", user!.id)
    .maybeSingle();

  const { data: ediciones } = facilitador
    ? await supabase
        .from("ediciones_curso")
        .select("id, fecha_inicio, fecha_limite, estado, cursos(nombre)")
        .eq("facilitador_id", facilitador.id)
        .order("fecha_inicio", { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mis ediciones de curso</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Hola, {nombres}</h1>
      </div>
      <div className="border border-border bg-card divide-y divide-border">
        {(ediciones ?? []).length === 0 && (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            No tienes ediciones de curso asignadas todavía.
          </p>
        )}
        {(ediciones ?? []).map((e) => (
          <div key={e.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">{e.cursos?.nombre ?? "Curso"}</p>
              <p className="text-sm text-muted-foreground">
                Inicio {e.fecha_inicio} · Límite {e.fecha_limite}
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {e.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

