"use client";

import { useState, useTransition } from "react";
import { Plus, Briefcase, Pencil } from "lucide-react";
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
import { crearCargo, actualizarCargo, actualizarActivoCargo } from "./actions";

type Cargo = {
  id: string;
  nombre: string;
  activo: boolean;
  organizacion_id: string;
  organizaciones: { razon_social: string } | null;
};

export function CargosView({
  cargos,
  organizaciones,
}: {
  cargos: Cargo[];
  organizaciones: { id: string; razon_social: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Catálogo por organización
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Cargos</h1>
        </div>
        {organizaciones.length > 0 && <NuevoCargoDialog organizaciones={organizaciones} />}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cargos.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
            No hay cargos registrados. Agrega los cargos que existen en tu organización para que
            aparezcan al dar de alta trabajadores.
          </p>
        )}
        {cargos.map((c) => (
          <CargoCard key={c.id} cargo={c} mostrarOrg={organizaciones.length > 1} />
        ))}
      </div>
    </div>
  );
}

function CargoCard({ cargo, mostrarOrg }: { cargo: Cargo; mostrarOrg: boolean }) {
  const [pending, startTransition] = useTransition();
  const [activo, setActivo] = useState(cargo.activo);
  const [nombre, setNombre] = useState(cargo.nombre);

  function onToggle() {
    const nuevo = !activo;
    startTransition(async () => {
      const resultado = await actualizarActivoCargo({
        cargoId: cargo.id,
        organizacionId: cargo.organizacion_id,
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
    <div className={cn("relative border border-border bg-card p-4 flex flex-col gap-3", !activo && "opacity-60")}>
      <EditarCargoDialog cargo={{ ...cargo, nombre }} onGuardado={setNombre} />
      <div className="flex items-center gap-2.5 min-w-0 pr-8">
        <span className="flex size-8 items-center justify-center bg-secondary shrink-0">
          <Briefcase className="size-4 text-secondary-foreground" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-wrap break-words">{nombre}</p>
          {mostrarOrg && (
            <p className="text-xs text-muted-foreground text-wrap break-words">{cargo.organizaciones?.razon_social}</p>
          )}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onToggle}
        className="self-start"
      >
        {activo ? "Activo" : "Inactivo"}
      </Button>
    </div>
  );
}

function EditarCargoDialog({
  cargo,
  onGuardado,
}: {
  cargo: Cargo;
  onGuardado: (nombre: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(cargo.nombre);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await actualizarCargo({
        cargoId: cargo.id,
        organizacionId: cargo.organizacion_id,
        nombre: nombre.trim(),
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Cargo actualizado.");
      onGuardado(nombre.trim());
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="absolute top-3 right-3" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar cargo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombreCargoEdit">Nombre del cargo</Label>
            <Input id="nombreCargoEdit" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
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

function NuevoCargoDialog({ organizaciones }: { organizaciones: { id: string; razon_social: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ organizacionId: organizaciones[0]?.id ?? "", nombre: "" });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await crearCargo({ organizacionId: form.organizacionId, nombre: form.nombre.trim() });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Cargo agregado.");
      setOpen(false);
      setForm((f) => ({ ...f, nombre: "" }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo cargo
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar cargo al catálogo</DialogTitle>
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
            <Label htmlFor="nombre">Nombre del cargo</Label>
            <Input id="nombre" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Enfermero/a" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar cargo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
