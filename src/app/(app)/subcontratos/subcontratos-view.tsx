"use client";

import { useState, useTransition } from "react";
import { Plus, Building, Pencil, ChevronDown } from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { crearSubcontrato, actualizarSubcontrato } from "./actions";

type Centro = { id: string; nombre: string; organizacion_id: string };

type Subcontrato = {
  id: string;
  nombre: string;
  rut: string | null;
  organizacion_id: string;
  organizaciones: { razon_social: string } | null;
  subcontratos_centros: { centro_trabajo_id: string; centros_trabajo: { nombre: string } | null }[];
};

export function SubcontratosView({
  subcontratos,
  centros,
  organizaciones,
}: {
  subcontratos: Subcontrato[];
  centros: Centro[];
  organizaciones: { id: string; razon_social: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Empresas contratistas (art. 16, letra d.)
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Subcontratos</h1>
        </div>
        {organizaciones.length > 0 && <NuevoSubcontratoDialog organizaciones={organizaciones} centros={centros} />}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subcontratos.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
            No hay subcontratos registrados.
          </p>
        )}
        {subcontratos.map((s) => (
          <div key={s.id} className="relative border border-border bg-card p-5 flex flex-col gap-2">
            <EditarSubcontratoDialog
              subcontrato={s}
              centrosDeLaOrg={centros.filter((c) => c.organizacion_id === s.organizacion_id)}
            />
            <span className="flex size-9 items-center justify-center bg-secondary">
              <Building className="size-4.5 text-secondary-foreground" />
            </span>
            <p className="font-medium">{s.nombre}</p>
            {s.rut && <p className="text-xs text-muted-foreground font-mono">{s.rut}</p>}
            <p className="text-xs text-muted-foreground">{s.organizaciones?.razon_social}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {s.subcontratos_centros.map((sc) => (
                <span
                  key={sc.centro_trabajo_id}
                  className="text-xs bg-muted px-2 py-0.5 text-muted-foreground"
                >
                  {sc.centros_trabajo?.nombre ?? "—"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoSubcontratoDialog({
  organizaciones,
  centros,
}: {
  organizaciones: { id: string; razon_social: string }[];
  centros: Centro[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    organizacionId: organizaciones[0]?.id ?? "",
    nombre: "",
    rut: "",
    centroTrabajoId: "",
  });

  const centrosDeLaOrg = centros.filter((c) => c.organizacion_id === form.organizacionId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.centroTrabajoId) {
      toast.error("Selecciona el centro de trabajo donde operará este subcontrato.");
      return;
    }
    startTransition(async () => {
      const resultado = await crearSubcontrato({
        organizacionId: form.organizacionId,
        nombre: form.nombre.trim(),
        rut: form.rut.trim() || null,
        centroTrabajoId: form.centroTrabajoId,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Subcontrato agregado.");
      setOpen(false);
      setForm((f) => ({ ...f, nombre: "", rut: "", centroTrabajoId: "" }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo subcontrato
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar subcontrato</DialogTitle>
          <DialogDescription>
            Se crea asociado a un centro. Si más adelante necesita operar en otro centro, se asigna desde su
            tarjeta — no vuelvas a crearlo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {organizaciones.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Organización</Label>
              <Select
                items={Object.fromEntries(organizaciones.map((o) => [o.id, o.razon_social]))}
                value={form.organizacionId}
                onValueChange={(v) => setForm((f) => ({ ...f, organizacionId: v ?? "", centroTrabajoId: "" }))}
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
            <Label htmlFor="nombre">Nombre de la empresa</Label>
            <Input
              id="nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rut">RUT (opcional)</Label>
            <Input id="rut" value={form.rut} onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Centro de trabajo</Label>
            <Select
              items={Object.fromEntries(centrosDeLaOrg.map((c) => [c.id, c.nombre]))}
              value={form.centroTrabajoId}
              onValueChange={(v) => setForm((f) => ({ ...f, centroTrabajoId: v ?? "" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un centro" />
              </SelectTrigger>
              <SelectContent>
                {centrosDeLaOrg.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {centrosDeLaOrg.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay centros registrados para esta organización — agrégalos en Centros de trabajo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar subcontrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarSubcontratoDialog({
  subcontrato,
  centrosDeLaOrg,
}: {
  subcontrato: Subcontrato;
  centrosDeLaOrg: Centro[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    nombre: subcontrato.nombre,
    rut: subcontrato.rut ?? "",
    centroIds: subcontrato.subcontratos_centros.map((sc) => sc.centro_trabajo_id),
  });

  function toggleCentro(centroId: string, marcado: boolean) {
    setForm((f) => ({
      ...f,
      centroIds: marcado ? [...f.centroIds, centroId] : f.centroIds.filter((id) => id !== centroId),
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.centroIds.length === 0) {
      toast.error("Selecciona al menos un centro de trabajo.");
      return;
    }
    startTransition(async () => {
      const resultado = await actualizarSubcontrato({
        subcontratoId: subcontrato.id,
        organizacionId: subcontrato.organizacion_id,
        nombre: form.nombre.trim(),
        rut: form.rut.trim() || null,
        centroIds: form.centroIds,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Subcontrato actualizado.");
      setOpen(false);
    });
  }

  const nombresSeleccionados = centrosDeLaOrg.filter((c) => form.centroIds.includes(c.id)).map((c) => c.nombre);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="absolute top-3 right-3" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar subcontrato</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombreEdit">Nombre de la empresa</Label>
            <Input
              id="nombreEdit"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rutEdit">RUT (opcional)</Label>
            <Input
              id="rutEdit"
              value={form.rut}
              onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Centros de trabajo</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  />
                }
              >
                <span className="truncate text-left">
                  {nombresSeleccionados.length > 0 ? nombresSeleccionados.join(", ") : "Selecciona uno o más centros"}
                </span>
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--anchor-width)">
                {centrosDeLaOrg.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={form.centroIds.includes(c.id)}
                    onCheckedChange={(marcado) => toggleCentro(c.id, marcado)}
                  >
                    {c.nombre}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {centrosDeLaOrg.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay centros registrados para esta organización — agrégalos en Centros de trabajo.
              </p>
            )}
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
