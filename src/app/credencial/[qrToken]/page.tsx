import { ShieldHalf, CircleX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignBadge, type EstadoVigencia } from "@/components/status/sign-badge";
import { estadoVigenciaDeCurso, peorEstadoVigencia } from "@/lib/vigencia";

export default async function CredencialPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const admin = createAdminClient();

  const { data: vinculo } = await admin
    .from("vinculos_laborales")
    .select(
      "persona_run, organizacion_id, tipo_vinculo, personas(nombres, apellido_paterno, apellido_materno, run, dv), cargos(nombre), centros_trabajo(nombre), subcontratos(nombre), organizaciones(razon_social, logo_url)",
    )
    .eq("qr_token", qrToken)
    .maybeSingle();

  let cursos: { nombre: string; vigenciaHasta: string | null; estado: EstadoVigencia }[] = [];

  if (vinculo) {
    const { data: inscripciones } = await admin
      .from("inscripciones")
      .select("vigencia_hasta, ediciones_curso!inner(organizacion_id, cursos(nombre))")
      .eq("persona_run", vinculo.persona_run)
      .eq("estado", "aprobado")
      .eq("ediciones_curso.organizacion_id", vinculo.organizacion_id)
      .order("vigencia_hasta", { ascending: false });

    cursos = (inscripciones ?? [])
      .filter((i) => i.ediciones_curso?.cursos?.nombre)
      .map((i) => ({
        nombre: i.ediciones_curso!.cursos!.nombre,
        vigenciaHasta: i.vigencia_hasta,
        estado: estadoVigenciaDeCurso(i.vigencia_hasta),
      }));
  }

  const estadoGeneral = peorEstadoVigencia(cursos.map((c) => c.estado));
  const persona = vinculo?.personas;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldHalf className="size-5" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-xl tracking-wide uppercase">Capapp</span>
        </div>

        {vinculo?.organizaciones?.logo_url && (
          <div className="flex items-center justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo subido a Storage, no requiere optimización de next/image */}
            <img
              src={vinculo.organizaciones.logo_url}
              alt={vinculo.organizaciones.razon_social}
              className="h-10 max-w-48 object-contain"
            />
          </div>
        )}

        {!vinculo || !persona ? (
          <div className="border border-alert/30 bg-alert/10 p-6 text-center">
            <CircleX className="size-8 text-alert mx-auto mb-3" />
            <h1 className="font-heading text-lg font-bold uppercase tracking-tight mb-1">
              Credencial no encontrada
            </h1>
            <p className="text-sm text-muted-foreground">
              Este código no corresponde a una credencial válida de Capapp.
            </p>
          </div>
        ) : (
          <div className="border border-border bg-card">
            <div className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-muted/50 border-b border-border">
              <SignBadge estado={estadoGeneral} />
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Trabajador</p>
                <p className="font-medium">
                  {persona.nombres} {persona.apellido_paterno}
                  {persona.apellido_materno ? ` ${persona.apellido_materno}` : ""}
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {persona.run}-{persona.dv}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Cargo</p>
                  <p className="text-sm">{vinculo.cargos?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Centro</p>
                  <p className="text-sm">{vinculo.centros_trabajo?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Vínculo</p>
                  <p className="text-sm">
                    {vinculo.tipo_vinculo === "subcontrato"
                      ? `Subcontrato — ${vinculo.subcontratos?.nombre ?? "—"}`
                      : "Directo"}
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Capacitación{cursos.length > 1 ? "es" : ""}
                </p>
                {cursos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin capacitación aprobada registrada.</p>
                ) : (
                  cursos.map((c, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <p className="text-sm">{c.nombre}</p>
                      <div className="flex items-center gap-2">
                        <SignBadge estado={c.estado} size="sm" />
                        {c.vigenciaHasta && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.estado === "vencido" ? "el" : "hasta"} {c.vigenciaHasta}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                Registro de cumplimiento art. 16, DS N.º 44/2023.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
