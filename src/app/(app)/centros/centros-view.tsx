"use client";

import { useState, useTransition } from "react";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { crearCentroTrabajo } from "./actions";

type Centro = {
  id: string;
  nombre: string;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
  activo: boolean;
  organizacion_id: string;
  organizaciones: { razon_social: string } | null;
};

export function CentrosView({
  centros,
  organizaciones,
}: {
  centros: Centro[];
  organizaciones: { id: string; razon_social: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Lugares de trabajo (art. 16, letra a.)
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Centros de trabajo
          </h1>
        </div>
        {organizaciones.length > 0 && <NuevoCentroDialog organizaciones={organizaciones} />}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {centros.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
            No hay centros de trabajo registrados.
          </p>
        )}
        {centros.map((c) => (
          <div key={c.id} className="border border-border bg-card p-5 flex flex-col gap-2">
            <span className="flex size-9 items-center justify-center bg-secondary">
              <Building2 className="size-4.5 text-secondary-foreground" />
            </span>
            <p className="font-medium">{c.nombre}</p>
            <p className="text-xs text-muted-foreground">{c.organizaciones?.razon_social}</p>
            <p className="text-xs text-muted-foreground">
              {[c.direccion, c.comuna, c.region].filter(Boolean).join(", ") || "Sin dirección registrada"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoCentroDialog({ organizaciones }: { organizaciones: { id: string; razon_social: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    organizacionId: organizaciones[0]?.id ?? "",
    nombre: "",
    direccion: "",
    comuna: "",
    region: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await crearCentroTrabajo({
        organizacionId: form.organizacionId,
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        comuna: form.comuna.trim() || null,
        region: form.region.trim() || null,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Centro de trabajo agregado.");
      setOpen(false);
      setForm((f) => ({ ...f, nombre: "", direccion: "", comuna: "", region: "" }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo centro
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar centro de trabajo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {organizaciones.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Organización</Label>
              <Select
                items={Object.fromEntries(organizaciones.map((o) => [o.id, o.razon_social]))}
                value={form.organizacionId}
                onValueChange={(v) => setForm((f) => ({ ...f, organizacionId: v ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizaciones.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.razon_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comuna">Comuna</Label>
              <Input id="comuna" value={form.comuna} onChange={(e) => setForm((f) => ({ ...f, comuna: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">Región</Label>
              <Input id="region" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar centro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
