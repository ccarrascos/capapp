"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { obtenerUrlFirmada } from "@/app/(app)/cursos/[cursoId]/materiales-actions";

/**
 * Sube (o reemplaza) un documento en el bucket privado "materiales" y persiste
 * la ruta mediante un Server Action. La subida ocurre directo desde el
 * navegador con la sesión del usuario, respetando el RLS de storage.objects.
 */
export function FileField({
  label,
  path,
  storagePathPrefix,
  fileName,
  onGuardarPath,
}: {
  label: string;
  path: string | null;
  storagePathPrefix: string;
  fileName: string;
  onGuardarPath: (path: string) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [abriendo, setAbriendo] = useState(false);

  function onElegirArchivo() {
    inputRef.current?.click();
  }

  function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    startTransition(async () => {
      const ext = file.name.split(".").pop() ?? "bin";
      const destino = `${storagePathPrefix}/${fileName}.${ext}`;
      const supabase = createClient();

      const { error: errorSubida } = await supabase.storage
        .from("materiales")
        .upload(destino, file, { upsert: true, contentType: file.type || undefined });

      if (errorSubida) {
        toast.error(errorSubida.message);
        return;
      }

      const resultado = await onGuardarPath(destino);
      if (!resultado.ok) {
        toast.error(resultado.mensaje ?? "No se pudo guardar la referencia del archivo.");
        return;
      }
      toast.success("Documento subido.");
    });
  }

  async function onVer() {
    if (!path) return;
    setAbriendo(true);
    const resultado = await obtenerUrlFirmada(path);
    setAbriendo(false);
    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex items-center justify-between gap-3 border border-border px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {path ? path.split("/").pop() : "Sin documento cargado"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {path && (
          <Button type="button" size="sm" variant="outline" disabled={abriendo} onClick={onVer}>
            <ExternalLink className="size-3.5" />
            Ver
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onElegirArchivo}>
          <Upload className="size-3.5" />
          {pending ? "Subiendo…" : path ? "Reemplazar" : "Subir"}
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={onArchivoSeleccionado} />
      </div>
    </div>
  );
}
