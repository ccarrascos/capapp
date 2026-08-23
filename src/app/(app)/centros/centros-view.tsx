"use client";

import { useState, useTransition } from "react";
import { Plus, Building2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { crearCentroTrabajo, actualizarCentroTrabajo, actualizarActivoCentroTrabajo } from "./actions";
import { RegionComunaFields } from "@/components/region-comuna-fields";

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
          <div
            key={c.id}
            className={cn(
              "relative border border-border bg-card p-5 flex flex-col gap-2",
              !c.activo && "opacity-60",
            )}
          >
            <EditarCentroDialog centro={c} />
            <span className="flex size-9 items-center justify-center bg-secondary">
              <Building2 className="size-4.5 text-secondary-foreground" />
            </span>
            <p className="font-medium">{c.nombre}</p>
            <p className="text-xs text-muted-foreground">{c.organizaciones?.razon_social}</p>
            <p className="text-xs text-muted-foreground">
              {[c.direccion, c.comuna, c.region].filter(Boolean).join(", ") || "Sin dirección registrada"}
            </p>
            <ToggleActivoCentroButton centro={c} />
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
            <RegionComunaFields
              region={form.region}
              comuna={form.comuna}
              onRegionChange={(region) => setForm((f) => ({ ...f, region }))}
              onComunaChange={(comuna) => setForm((f) => ({ ...f, comuna }))}
            />
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

function EditarCentroDialog({ centro }: { centro: Centro }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    nombre: centro.nombre,
    direccion: centro.direccion ?? "",
    comuna: centro.comuna ?? "",
    region: centro.region ?? "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await actualizarCentroTrabajo({
        centroId: centro.id,
        organizacionId: centro.organizacion_id,
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        comuna: form.comuna.trim() || null,
        region: form.region.trim() || null,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Centro de trabajo actualizado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="absolute top-3 right-3" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar centro de trabajo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombreEdit">Nombre</Label>
            <Input
              id="nombreEdit"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="direccionEdit">Dirección</Label>
            <Input
              id="direccionEdit"
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RegionComunaFields
              region={form.region}
              comuna={form.comuna}
              onRegionChange={(region) => setForm((f) => ({ ...f, region }))}
              onComunaChange={(comuna) => setForm((f) => ({ ...f, comuna }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActivoCentroButton({ centro }: { centro: Centro }) {
  const [pending, startTransition] = useTransition();
  const [activo, setActivo] = useState(centro.activo);

  function onToggle() {
    const nuevo = !activo;
    startTransition(async () => {
      const resultado = await actualizarActivoCentroTrabajo({
        centroId: centro.id,
        organizacionId: centro.organizacion_id,
        activo: nuevo,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setActivo(nuevo);
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onToggle} className="self-start mt-1">
      {activo ? "Activo" : "Inactivo"}
    </Button>
  );
}
