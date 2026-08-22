"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Credencial = {
  nombreCompleto: string;
  runDv: string;
  cargo: string | null;
  centro: string | null;
  qrDataUrl: string;
};

export function CredencialesView({ credenciales }: { credenciales: Credencial[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Credenciales QR</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            {credenciales.length} trabajador{credenciales.length === 1 ? "" : "es"} activo
            {credenciales.length === 1 ? "" : "s"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/trabajadores" />} nativeButton={false} variant="outline">
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir todo
          </Button>
        </div>
      </div>

      {credenciales.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay trabajadores activos para generar credenciales.</p>
      ) : (
        <div id="credenciales-imprimibles" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {credenciales.map((c) => (
            <div
              key={c.runDv}
              className="border border-border bg-card p-4 flex flex-col items-center gap-1 text-center break-inside-avoid"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el servidor */}
              <img src={c.qrDataUrl} alt={`Código QR de ${c.nombreCompleto}`} className="size-28" />
              <p className="font-medium text-sm leading-tight">{c.nombreCompleto}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.runDv}</p>
              {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #credenciales-imprimibles, #credenciales-imprimibles * { visibility: visible; }
          #credenciales-imprimibles {
            position: absolute;
            inset: 0;
            margin: 0;
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
