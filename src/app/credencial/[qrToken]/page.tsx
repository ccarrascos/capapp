import { ShieldHalf, CircleX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignBadge, type EstadoVigencia } from "@/components/status/sign-badge";

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
      "persona_run, organizacion_id, personas(nombres, apellido_paterno, apellido_materno, run, dv), cargos(nombre), centros_trabajo(nombre), organizaciones(razon_social, logo_url)",
    )
    .eq("qr_token", qrToken)
    .maybeSingle();

  let cursoNombre: string | null = null;
  let vigenciaHasta: string | null = null;
  let estadoVigencia: EstadoVigencia = "sin_capacitacion";

  if (vinculo) {
    const { data: matriz } = await admin
      .from("matriz_vigencia_capacitacion")
      .select("curso_id, vigencia_hasta, estado_vigencia")
      .eq("persona_run", vinculo.persona_run)
      .eq("organizacion_id", vinculo.organizacion_id)
      .maybeSingle();

    vigenciaHasta = matriz?.vigencia_hasta ?? null;
    estadoVigencia = (matriz?.estado_vigencia as EstadoVigencia | undefined) ?? "sin_capacitacion";

    if (matriz?.curso_id) {
      const { data: curso } = await admin.from("cursos").select("nombre").eq("id", matriz.curso_id).maybeSingle();
      cursoNombre = curso?.nombre ?? null;
    }
  }

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
              <SignBadge estado={estadoVigencia} />
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
              </div>
              {cursoNombre && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Capacitación</p>
                  <p className="text-sm">{cursoNombre}</p>
                  {vigenciaHasta && (
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      {estadoVigencia === "vencido" ? "Vencida el" : "Vigente hasta"} {vigenciaHasta}
                    </p>
                  )}
                </div>
              )}
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
