"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, GraduationCap } from "lucide-react";
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
import { crearCursoDS44 } from "./actions";
import type { Database } from "@/lib/database.types";

type ModalidadEjecucion = Database["public"]["Enums"]["modalidad_ejecucion"];

type Curso = {
  id: string;
  nombre: string;
  horas_totales: number;
  tipo_proveedor: string;
  vigente: boolean;
  modulos: { id: string }[];
};

const MODALIDADES: { value: ModalidadEjecucion; label: string }[] = [
  { value: "telematica_asincronica", label: "Telemática asincrónica" },
  { value: "telematica_sincronica", label: "Telemática sincrónica" },
  { value: "presencial", label: "Presencial" },
  { value: "mixta", label: "Mixta" },
];

export function CursosView({
  cursos,
  organizaciones,
  puedeGestionar,
}: {
  cursos: Curso[];
  organizaciones: { id: string; razon_social: string }[];
  puedeGestionar: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Curso art. 16 DS 44 — mínimo 8 horas
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Cursos y ediciones
          </h1>
        </div>
        {puedeGestionar && organizaciones.length > 0 && (
          <NuevoCursoDialog organizaciones={organizaciones} />
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cursos.length === 0 && (
          <div className="col-span-full border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aún no hay cursos definidos.
          </div>
        )}
        {cursos.map((c) => (
          <Link
            key={c.id}
            href={`/cursos/${c.id}`}
            className="border border-border bg-card p-5 flex flex-col gap-2 hover:border-primary transition-colors"
          >
            <span className="flex size-9 items-center justify-center bg-secondary">
              <GraduationCap className="size-4.5 text-secondary-foreground" />
            </span>
            <p className="font-medium">{c.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {c.horas_totales} horas · {c.modulos?.length ?? 0} módulos · {c.tipo_proveedor}
            </p>
            {!c.vigente && (
              <span className="text-[10px] uppercase tracking-wide text-alert w-fit border border-alert/30 px-1.5 py-0.5">
                No vigente
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function NuevoCursoDialog({ organizaciones }: { organizaciones: { id: string; razon_social: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    organizacionId: organizaciones[0]?.id ?? "",
    nombre: "Curso de capacitación en prevención de riesgos laborales",
    modalidad: "telematica_asincronica" as ModalidadEjecucion,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await crearCursoDS44({
        organizacionId: form.organizacionId,
        nombre: form.nombre.trim(),
        modalidad: form.modalidad,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Curso creado con los 7 módulos mínimos del art. 16.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo curso (plantilla DS 44)
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear curso con estructura DS 44</DialogTitle>
          <DialogDescription>
            Genera automáticamente los 7 módulos de contenido mínimo exigidos por el Anexo
            Metodológico (8 horas totales). Podrás editar cada módulo después.
          </DialogDescription>
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
            <Label htmlFor="nombre">Nombre del curso</Label>
            <Input id="nombre" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Modalidad de los módulos</Label>
            <Select
              items={Object.fromEntries(MODALIDADES.map((m) => [m.value, m.label]))}
              value={form.modalidad}
              onValueChange={(v) => setForm((f) => ({ ...f, modalidad: (v ?? "telematica_asincronica") as ModalidadEjecucion }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear curso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
