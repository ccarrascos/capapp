"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CertificadoCard, CERTIFICADO_PRINT_STYLE, type CertificadoDatos } from "./[certificadoId]/certificado-view";
import { obtenerCertificado } from "./actions";
import { HazardLoader } from "@/components/ui/hazard-loader";

export function CertificadoDialog({
  certificadoId,
  triggerClassName,
  children,
}: {
  certificadoId: string;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [datos, setDatos] = useState<CertificadoDatos | null>(null);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setDatos(null);
      startTransition(async () => {
        const res = await obtenerCertificado(certificadoId);
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
      <button type="button" onClick={() => onOpenChange(true)} className={triggerClassName}>
        {children}
      </button>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="sr-only">Certificado</DialogTitle>
        {pending || !datos ? (
          <HazardLoader label="Cargando…" className="py-16" />
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
