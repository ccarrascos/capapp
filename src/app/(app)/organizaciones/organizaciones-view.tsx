"use client";

import { useState, useTransition } from "react";
import { Plus, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearRutInput } from "@/lib/rut";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { crearOrganizacion } from "./actions";
import { RegionComunaFields } from "@/components/region-comuna-fields";

type Organizacion = {
  id: string;
  rut: string;
  razon_social: string;
  nombre_fantasia: string | null;
  sector_economico: string | null;
  comuna: string | null;
  region: string | null;
  activo: boolean;
};

export function OrganizacionesView({ organizaciones }: { organizaciones: Organizacion[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Alcance super administrador
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Organizaciones
          </h1>
        </div>
        <NuevaOrganizacionDialog />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {organizaciones.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
            Aún no hay organizaciones registradas.
          </p>
        )}
        {organizaciones.map((o) => (
          <div key={o.id} className="border border-border bg-card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center bg-secondary shrink-0">
                <Landmark className="size-4.5 text-secondary-foreground" />
              </span>
              {!o.activo && (
                <span className="text-[10px] uppercase tracking-wide text-alert border border-alert/30 px-1.5 py-0.5">
                  Inactiva
                </span>
              )}
            </div>
            <div>
              <p className="font-medium leading-tight">{o.razon_social}</p>
              {o.nombre_fantasia && (
                <p className="text-sm text-muted-foreground">{o.nombre_fantasia}</p>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{o.rut}</div>
            <div className="text-xs text-muted-foreground">
              {[o.comuna, o.region].filter(Boolean).join(", ") || "Sin ubicación registrada"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevaOrganizacionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    rut: "",
    razonSocial: "",
    nombreFantasia: "",
    sectorEconomico: "",
    direccion: "",
    comuna: "",
    region: "",
    emailContacto: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await crearOrganizacion({
        rut: form.rut.trim(),
        razonSocial: form.razonSocial.trim(),
        nombreFantasia: form.nombreFantasia.trim() || null,
        sectorEconomico: form.sectorEconomico.trim() || null,
        direccion: form.direccion.trim() || null,
        comuna: form.comuna.trim() || null,
        region: form.region.trim() || null,
        emailContacto: form.emailContacto.trim() || null,
      });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Organización creada.");
      setOpen(false);
      setForm({ rut: "", razonSocial: "", nombreFantasia: "", sectorEconomico: "", direccion: "", comuna: "", region: "", emailContacto: "" });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nueva organización
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar entidad empleadora</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rut">RUT</Label>
              <Input
                id="rut"
                required
                value={form.rut}
                onChange={(e) => setForm((f) => ({ ...f, rut: formatearRutInput(e.target.value) }))}
                placeholder="76.123.456-7"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sector">Sector económico</Label>
              <Input id="sector" value={form.sectorEconomico} onChange={(e) => setForm((f) => ({ ...f, sectorEconomico: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="razonSocial">Razón social</Label>
            <Input id="razonSocial" required value={form.razonSocial} onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombreFantasia">Nombre de fantasía</Label>
            <Input id="nombreFantasia" value={form.nombreFantasia} onChange={(e) => setForm((f) => ({ ...f, nombreFantasia: e.target.value }))} />
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailContacto">Correo de contacto</Label>
            <Input id="emailContacto" type="email" value={form.emailContacto} onChange={(e) => setForm((f) => ({ ...f, emailContacto: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Crear organización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
