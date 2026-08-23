"use client";

import { useState, useTransition } from "react";
import { FileCheck2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CertificadoCard, CERTIFICADO_PRINT_STYLE, type CertificadoDatos } from "../certificados/[certificadoId]/certificado-view";
import { obtenerMiCertificado } from "./actions";

export function CertificadoDialog({ certificadoId }: { certificadoId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [datos, setDatos] = useState<CertificadoDatos | null>(null);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setDatos(null);
      startTransition(async () => {
        const res = await obtenerMiCertificado(certificadoId);
        if (!res.ok) {
          toast.error(res.mensaje);
          setOpen(false);
          return;
        }
        setDatos(res.datos);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex items-center gap-1.5 text-primary hover:underline text-sm border-t border-border pt-3"
      >
        <FileCheck2 className="size-4" />
        Ver certificado
      </button>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="sr-only">Certificado</DialogTitle>
        {pending || !datos ? (
          <p className="text-sm text-muted-foreground py-16 text-center">Cargando…</p>
        ) : (
          <>
            <CertificadoCard {...datos} />
            <Button onClick={() => window.print()} className="no-print self-center">
              <Printer className="size-4" />
              Imprimir / Descargar PDF
            </Button>
            <style>{CERTIFICADO_PRINT_STYLE}</style>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
