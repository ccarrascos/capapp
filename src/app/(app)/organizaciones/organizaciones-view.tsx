"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Landmark, Camera, Pencil, Ban, RotateCcw } from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { crearOrganizacion, subirLogoOrganizacion, actualizarActivoOrganizacion } from "./actions";
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
  logo_url: string | null;
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
          <div key={o.id} className="border border-border bg-card p-5 flex flex-col gap-3 relative">
            <div className="absolute top-3 right-3 flex items-center gap-0.5">
              <EditarLogoDialog organizacionId={o.id} nombre={o.razon_social} logoUrl={o.logo_url} />
              <ToggleActivoOrganizacionDialog organizacionId={o.id} nombre={o.razon_social} activo={o.activo} />
            </div>
            <div className="flex items-start justify-between gap-2">
              {o.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo subido a Storage, no requiere optimización de next/image
                <img src={o.logo_url} alt={o.razon_social} className="h-9 max-w-32 object-contain object-left" />
              ) : (
                <span className="flex size-9 items-center justify-center bg-secondary shrink-0">
                  <Landmark className="size-4.5 text-secondary-foreground" />
                </span>
              )}
              {!o.activo && (
                <span className="text-[10px] uppercase tracking-wide text-alert border border-alert/30 px-1.5 py-0.5 mr-16">
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

function EditarLogoDialog({
  organizacionId,
  nombre,
  logoUrl,
}: {
  organizacionId: string;
  nombre: string;
  logoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [urlActual, setUrlActual] = useState(logoUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const formData = new FormData();
    formData.set("archivo", archivo);

    startTransition(async () => {
      const resultado = await subirLogoOrganizacion(organizacionId, formData);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setUrlActual(resultado.logoUrl);
      toast.success("Logo actualizado.");
    });

    e.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Logo de {nombre}</DialogTitle>
          <DialogDescription>Se muestra en el encabezado de la app y en los certificados. JPG, PNG, WEBP o SVG, máximo 2 MB.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-32 items-center justify-center border border-dashed border-border bg-muted/40">
            {urlActual ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo subido a Storage, no requiere optimización de next/image
              <img src={urlActual} alt={nombre} className="h-full w-full object-contain p-2" />
            ) : (
              <Landmark className="size-6 text-muted-foreground" />
            )}
          </div>
          <Button type="button" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" />
            {pending ? "Subiendo…" : "Cambiar logo"}
          </Button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={onFileChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActivoOrganizacionDialog({
  organizacionId,
  nombre,
  activo,
}: {
  organizacionId: string;
  nombre: string;
  activo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirmar() {
    startTransition(async () => {
      const resultado = await actualizarActivoOrganizacion({ organizacionId, activo: !activo });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(activo ? "Organización desactivada." : "Organización reactivada.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            title={activo ? "Desactivar organización" : "Reactivar organización"}
          />
        }
      >
        {activo ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{activo ? "Desactivar" : "Reactivar"} {nombre}</DialogTitle>
          <DialogDescription>
            {activo
              ? "Todas las cuentas de esta organización (admins, prevencionistas, facilitadores, trabajadores) perderán acceso a la app de inmediato, por ejemplo si no ha efectuado el pago. Los datos no se eliminan y puedes reactivarla cuando quieras."
              : "Todas las cuentas de esta organización recuperarán su acceso normal a la app."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant={activo ? "destructive" : "default"} disabled={pending} onClick={onConfirmar}>
            {pending ? "Guardando…" : activo ? "Desactivar organización" : "Reactivar organización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaOrganizacionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingLogo, startLogoTransition] = useTransition();
  const [organizacionCreada, setOrganizacionCreada] = useState<{ id: string; nombre: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
      setOrganizacionCreada({ id: resultado.organizacionId, nombre: form.razonSocial.trim() });
      setForm({ rut: "", razonSocial: "", nombreFantasia: "", sectorEconomico: "", direccion: "", comuna: "", region: "", emailContacto: "" });
    });
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !organizacionCreada) return;

    const formData = new FormData();
    formData.set("archivo", archivo);

    startLogoTransition(async () => {
      const resultado = await subirLogoOrganizacion(organizacionCreada.id, formData);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Logo cargado.");
      cerrarYLimpiar();
    });
  }

  function cerrarYLimpiar() {
    setOpen(false);
    setOrganizacionCreada(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cerrarYLimpiar())}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nueva organización
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {organizacionCreada ? (
          <>
            <DialogHeader>
              <DialogTitle>Logo de {organizacionCreada.nombre}</DialogTitle>
              <DialogDescription>
                Opcional — se muestra en el encabezado de la app y en los certificados. Puedes agregarlo después desde
                esta misma pantalla.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-32 items-center justify-center border border-dashed border-border bg-muted/40">
                <Landmark className="size-6 text-muted-foreground" />
              </div>
              <Button type="button" variant="outline" disabled={pendingLogo} onClick={() => inputRef.current?.click()}>
                <Camera className="size-4" />
                {pendingLogo ? "Subiendo…" : "Subir logo"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={onLogoChange}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={cerrarYLimpiar}>
                Omitir por ahora
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
