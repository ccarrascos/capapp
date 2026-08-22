import { ShieldHalf, CircleCheck, CircleX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

const ENTIDAD_EMISORA_LABEL: Record<string, string> = {
  empleador: "Empleador",
  oal: "Organismo Administrador de la Ley",
  otec: "OTEC",
};

export default async function ValidarCertificadoPage({
  params,
}: {
  params: Promise<{ numeroCertificado: string }>;
}) {
  const { numeroCertificado } = await params;
  const admin = createAdminClient();

  const { data: certificado } = await admin
    .from("certificados")
    .select(
      "numero_certificado, fecha_emision, fecha_vigencia_hasta, entidad_emisora_tipo, entidad_emisora_id, cursos(nombre, horas_totales, organizaciones(razon_social, logo_url)), personas(nombres, apellido_paterno, apellido_materno, run, dv)",
    )
    .eq("numero_certificado", numeroCertificado)
    .maybeSingle();

  let nombreEntidadExterna: string | null = null;
  if (certificado?.entidad_emisora_id) {
    if (certificado.entidad_emisora_tipo === "oal") {
      const { data } = await admin
        .from("organismos_administradores")
        .select("nombre")
        .eq("id", certificado.entidad_emisora_id)
        .maybeSingle();
      nombreEntidadExterna = data?.nombre ?? null;
    } else if (certificado.entidad_emisora_tipo === "otec") {
      const { data } = await admin
        .from("entidades_acreditadas")
        .select("nombre")
        .eq("id", certificado.entidad_emisora_id)
        .maybeSingle();
      nombreEntidadExterna = data?.nombre ?? null;
    }
  }

  const vigente = certificado ? certificado.fecha_vigencia_hasta >= new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldHalf className="size-5" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-xl tracking-wide uppercase">Capapp</span>
        </div>

        {certificado?.cursos?.organizaciones?.logo_url && (
          <div className="flex items-center justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo subido a Storage, no requiere optimización de next/image */}
            <img
              src={certificado.cursos.organizaciones.logo_url}
              alt={certificado.cursos.organizaciones.razon_social}
              className="h-10 max-w-48 object-contain"
            />
          </div>
        )}

        {!certificado || !certificado.cursos || !certificado.personas ? (
          <div className="border border-alert/30 bg-alert/10 p-6 text-center">
            <CircleX className="size-8 text-alert mx-auto mb-3" />
            <h1 className="font-heading text-lg font-bold uppercase tracking-tight mb-1">
              Certificado no encontrado
            </h1>
            <p className="text-sm text-muted-foreground">
              El número <span className="font-mono">{numeroCertificado}</span> no corresponde a un certificado
              válido emitido por Capapp.
            </p>
          </div>
        ) : (
          <div className="border border-border bg-card">
            <div
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                vigente ? "bg-clear/10 text-clear" : "bg-alert/10 text-alert"
              }`}
            >
              {vigente ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
              {vigente ? "Certificado vigente" : "Certificado vencido"}
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Titular</p>
                <p className="font-medium">
                  {certificado.personas.nombres} {certificado.personas.apellido_paterno}
                  {certificado.personas.apellido_materno ? ` ${certificado.personas.apellido_materno}` : ""}
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {certificado.personas.run}-{certificado.personas.dv}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Curso</p>
                <p className="font-medium">{certificado.cursos.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {certificado.cursos.horas_totales} horas · {certificado.cursos.organizaciones?.razon_social ?? "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Emisión</p>
                  <p className="font-mono text-sm">{certificado.fecha_emision}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Vigente hasta</p>
                  <p className="font-mono text-sm">{certificado.fecha_vigencia_hasta}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Entidad emisora</p>
                <p className="text-sm">
                  {nombreEntidadExterna
                    ? `${nombreEntidadExterna} (${ENTIDAD_EMISORA_LABEL[certificado.entidad_emisora_tipo]})`
                    : (ENTIDAD_EMISORA_LABEL[certificado.entidad_emisora_tipo] ?? certificado.entidad_emisora_tipo)}
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground border-t border-border pt-4">
                N.º {certificado.numero_certificado}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
