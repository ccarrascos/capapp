"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { toast } from "sonner";
import { crearEdicion } from "../actions";

export function NuevaEdicionDialog({
  cursoId,
  organizacionId,
  facilitadores,
  centros,
}: {
  cursoId: string;
  organizacionId: string;
  facilitadores: { id: string; nombres: string; apellidos: string }[];
  centros: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    fechaInicio: new Date().toISOString().slice(0, 10),
    facilitadorId: facilitadores[0]?.id ?? "",
    centroTrabajoId: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await crearEdicion({
        cursoId,
        organizacionId,
        centroTrabajoId: form.centroTrabajoId || null,
        facilitadorId: form.facilitadorId || null,
        fechaInicio: form.fechaInicio,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Edición creada.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Nueva edición
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva edición (cohorte)</DialogTitle>
          <DialogDescription>
            El plazo límite se calcula automáticamente a 3 meses desde el inicio, conforme al
            Anexo Metodológico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fechaInicio">Fecha de inicio</Label>
            <Input
              id="fechaInicio"
              type="date"
              required
              value={form.fechaInicio}
              onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Facilitador</Label>
            <Select
              items={Object.fromEntries(facilitadores.map((f) => [f.id, `${f.nombres} ${f.apellidos}`]))}
              value={form.facilitadorId}
              onValueChange={(v) => setForm((f) => ({ ...f, facilitadorId: v ?? "" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {facilitadores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombres} {f.apellidos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {facilitadores.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay facilitadores registrados — puedes crear la edición sin asignar uno todavía.
              </p>
            )}
          </div>
          {centros.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Centro de trabajo</Label>
              <Select
                items={Object.fromEntries(centros.map((c) => [c.id, c.nombre]))}
                value={form.centroTrabajoId}
                onValueChange={(v) => setForm((f) => ({ ...f, centroTrabajoId: v ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los centros" />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear edición"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
