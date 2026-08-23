"use client";

import { Printer, ShieldHalf } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CertificadoDatos = {
  qrDataUrl: string;
  numeroCertificado: string;
  fechaEmision: string;
  fechaVigenciaHasta: string;
  entidadEmisora: string;
  nombreCompleto: string;
  rut: string;
  cursoNombre: string;
  cursoHoras: number;
  organizacionNombre: string;
  organizacionLogoUrl: string | null;
};

export function CertificadoCard({
  qrDataUrl,
  numeroCertificado,
  fechaEmision,
  fechaVigenciaHasta,
  entidadEmisora,
  nombreCompleto,
  rut,
  cursoNombre,
  cursoHoras,
  organizacionNombre,
  organizacionLogoUrl,
}: CertificadoDatos) {
  return (
    <div id="certificado-imprimible" className="border-2 border-primary bg-card p-10 sm:p-14 mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldHalf className="size-6" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-xl tracking-wide uppercase">Capapp</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {organizacionLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido a Storage, no requiere optimización de next/image
            <img src={organizacionLogoUrl} alt={organizacionNombre} className="h-8 max-w-40 object-contain object-right" />
          )}
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground text-right">
            DS N.º 44/2023
            <br />
            Artículo 16
          </p>
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground text-center mb-2">
        Certificado de aprobación
      </p>
      <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-center mb-8">
        Capacitación en prevención de riesgos laborales
      </h2>

      <p className="text-center text-sm text-muted-foreground mb-1">Se certifica que</p>
      <p className="font-heading text-3xl font-bold text-center mb-1">{nombreCompleto}</p>
      <p className="font-mono text-sm text-muted-foreground text-center mb-8">RUT {rut}</p>

      <p className="text-center text-sm text-muted-foreground mb-1">aprobó el curso</p>
      <p className="text-xl font-bold text-center mb-1">{cursoNombre}</p>
      <p className="text-sm text-muted-foreground text-center mb-8">
        {cursoHoras} horas · dictado para {organizacionNombre}
      </p>

      <div className="grid grid-cols-3 gap-4 border-t border-border pt-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Emisión</p>
          <p className="font-mono text-sm">{fechaEmision}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Vigente hasta</p>
          <p className="font-mono text-sm">{fechaVigenciaHasta}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Entidad emisora</p>
          <p className="text-sm">{entidadEmisora}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6 mt-8">
        <div>
          <p className="font-mono text-xs text-muted-foreground">N.º {numeroCertificado}</p>
          <p className="text-xs text-muted-foreground mt-1">Escanea el código para validar este certificado</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el servidor, no aplica optimización de next/image */}
        <img src={qrDataUrl} alt="Código QR de validación del certificado" className="size-20" />
      </div>
    </div>
  );
}

export const CERTIFICADO_PRINT_STYLE = `
  @media print {
    .no-print { display: none !important; }
    body * { visibility: hidden; }
    #certificado-imprimible, #certificado-imprimible * { visibility: visible; }
    html, body { height: auto !important; overflow: visible !important; }
    [data-slot="dialog-overlay"] { display: none !important; }
    [data-slot="dialog-content"] {
      position: static !important;
      transform: none !important;
      translate: none !important;
      max-width: none !important;
      width: auto !important;
      max-height: none !important;
      overflow: visible !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
    #certificado-imprimible { position: static; inset: auto; margin: 0 auto; max-width: none; border: none; }
  }
`;

export function CertificadoView(props: CertificadoDatos) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Certificación</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Certificado {props.numeroCertificado}
          </h1>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir / Descargar PDF
        </Button>
      </div>

      <CertificadoCard {...props} />

      <style>{CERTIFICADO_PRINT_STYLE}</style>
    </div>
  );
}
