"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, UserCog2, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { crearFacilitador, actualizarFacilitador, actualizarEstadoFacilitador, buscarPersonaPorRun } from "./actions";
import { formatearRunInput, esRutValido } from "@/lib/rut";
import type { Database } from "@/lib/database.types";

type TipoProveedor = Database["public"]["Enums"]["tipo_proveedor"];

const TIPO_PROVEEDOR_LABEL: Record<TipoProveedor, string> = {
  interno: "Interno",
  oal: "OAL",
  otec: "OTEC",
};

type Facilitador = {
  id: string;
  run: string;
  dv: string;
  nombres: string;
  apellidos: string;
  titulo_profesional: string | null;
  es_experto_prevencion: boolean;
  tipo_proveedor: string;
  activo: boolean;
  organizacion_id: string | null;
  organizaciones: { razon_social: string } | null;
  organismos_administradores: { nombre: string } | null;
  entidades_acreditadas: { nombre: string } | null;
};

export function FacilitadoresView({
  facilitadores,
  organizaciones,
  esSuperAdmin,
  organizacionesAdmin,
}: {
  facilitadores: Facilitador[];
  organizaciones: { id: string; razon_social: string }[];
  esSuperAdmin: boolean;
  organizacionesAdmin: string[];
}) {
  const adminSet = new Set(organizacionesAdmin);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Relatores del curso art. 16
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Facilitadores
          </h1>
        </div>
        {organizaciones.length > 0 && <NuevoFacilitadorDialog organizaciones={organizaciones} />}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {facilitadores.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
            No hay facilitadores registrados todavía.
          </p>
        )}
        {facilitadores.map((f) => {
          const puedeEditar = esSuperAdmin || (f.organizacion_id !== null && adminSet.has(f.organizacion_id));
          return (
            <div
              key={f.id}
              className={`border border-border bg-card p-5 flex flex-col gap-2 relative ${!f.activo ? "opacity-60" : ""}`}
            >
              {puedeEditar && (
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <EditarFacilitadorDialog facilitador={f} organizaciones={organizaciones} />
                  <ToggleActivoButton facilitador={f} />
                </div>
              )}
              <span className="flex size-9 items-center justify-center bg-secondary">
                <UserCog2 className="size-4.5 text-secondary-foreground" />
              </span>
              <p className="font-medium">
                {f.nombres} {f.apellidos}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {f.run}-{f.dv}
              </p>
              <p className="text-xs text-muted-foreground">{f.titulo_profesional ?? "Sin título registrado"}</p>
              {(f.organismos_administradores || f.entidades_acreditadas) && (
                <p className="text-xs text-muted-foreground">
                  {f.organismos_administradores?.nombre ?? f.entidades_acreditadas?.nombre}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="secondary" className="rounded-sm text-[10px] uppercase">
                  {TIPO_PROVEEDOR_LABEL[f.tipo_proveedor as TipoProveedor] ?? f.tipo_proveedor}
                </Badge>
                {f.es_experto_prevencion && (
                  <Badge className="rounded-sm text-[10px] uppercase bg-signal text-signal-foreground">
                    Experto en prevención
                  </Badge>
                )}
                {!f.activo && (
                  <Badge variant="secondary" className="rounded-sm text-[10px] uppercase bg-alert/10 text-alert">
                    Inactivo
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NuevoFacilitadorDialog({ organizaciones }: { organizaciones: { id: string; razon_social: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [datosBloqueados, setDatosBloqueados] = useState(false);
  const [form, setForm] = useState({
    organizacionId: organizaciones[0]?.id ?? "",
    run: "",
    dv: "",
    nombres: "",
    apellidos: "",
    tituloProfesional: "",
    esExpertoPrevencion: false,
    tipoProveedor: "interno" as TipoProveedor,
    entidadNombre: "",
  });

  async function onRunBlur() {
    if (form.tipoProveedor !== "interno") return;

    const run = form.run.replace(/\./g, "").trim();
    if (!/^\d{6,9}$/.test(run)) return;

    const persona = await buscarPersonaPorRun(run);
    if (persona) {
      setForm((f) => ({
        ...f,
        nombres: persona.nombres,
        apellidos: persona.apellidos,
        tituloProfesional: persona.tituloProfesional ?? f.tituloProfesional,
        esExpertoPrevencion: persona.esExpertoPrevencion ?? f.esExpertoPrevencion,
      }));
      setDatosBloqueados(true);
      toast.success("Datos completados desde el registro existente (puede ser de otra organización). Ya no se pueden editar, para evitar que un mismo RUT quede con nombres distintos.");
    }
  }

  function onRunChange(value: string) {
    setDatosBloqueados(false);
    setForm((f) => ({ ...f, run: formatearRunInput(value) }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const run = form.run.replace(/\./g, "").trim();
    const dv = form.dv.trim().toUpperCase();
    if (!esRutValido(run, dv)) {
      toast.error("El RUT ingresado no es válido.");
      return;
    }

    if (form.tipoProveedor !== "interno" && !form.entidadNombre.trim()) {
      toast.error("Indica el nombre de la entidad externa.");
      return;
    }

    startTransition(async () => {
      const resultado = await crearFacilitador({
        organizacionId: form.organizacionId,
        run,
        dv,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        tituloProfesional: form.tituloProfesional.trim() || null,
        esExpertoPrevencion: form.esExpertoPrevencion,
        tipoProveedor: form.tipoProveedor,
        entidadNombre: form.tipoProveedor === "interno" ? null : form.entidadNombre.trim(),
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Facilitador agregado.");
      setOpen(false);
      setDatosBloqueados(false);
      setForm((f) => ({
        ...f,
        run: "",
        dv: "",
        nombres: "",
        apellidos: "",
        tituloProfesional: "",
        esExpertoPrevencion: false,
        tipoProveedor: "interno",
        entidadNombre: "",
      }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo facilitador
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar facilitador</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de proveedor</Label>
            <Select
              items={TIPO_PROVEEDOR_LABEL}
              value={form.tipoProveedor}
              onValueChange={(v) => setForm((f) => ({ ...f, tipoProveedor: (v ?? "interno") as TipoProveedor }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_PROVEEDOR_LABEL) as TipoProveedor[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_PROVEEDOR_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.tipoProveedor !== "interno" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entidadNombre">
                Nombre {form.tipoProveedor === "oal" ? "del organismo administrador" : "de la OTEC"}
              </Label>
              <Input
                id="entidadNombre"
                required
                value={form.entidadNombre}
                onChange={(e) => setForm((f) => ({ ...f, entidadNombre: e.target.value }))}
                placeholder={form.tipoProveedor === "oal" ? "Ej: Mutual de Seguridad" : "Ej: OTEC Capacita Ltda."}
              />
            </div>
          )}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="run">RUN</Label>
              <Input
                id="run"
                required
                value={form.run}
                onChange={(e) => onRunChange(e.target.value)}
                onBlur={onRunBlur}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dv">DV</Label>
              <Input id="dv" required maxLength={1} value={form.dv} onChange={(e) => setForm((f) => ({ ...f, dv: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombres">Nombres</Label>
              <Input
                id="nombres"
                required
                disabled={datosBloqueados}
                value={form.nombres}
                onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                required
                disabled={datosBloqueados}
                value={form.apellidos}
                onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
              />
            </div>
          </div>
          {datosBloqueados && (
            <p className="text-xs text-muted-foreground -mt-2">
              Nombres y apellidos vienen del registro existente para este RUT y no se pueden editar aquí.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Título profesional</Label>
            <Input id="titulo" value={form.tituloProfesional} onChange={(e) => setForm((f) => ({ ...f, tituloProfesional: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={form.esExpertoPrevencion}
              onChange={(e) => setForm((f) => ({ ...f, esExpertoPrevencion: e.target.checked }))}
            />
            Es experto/a en prevención de riesgos
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar facilitador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarFacilitadorDialog({
  facilitador,
  organizaciones,
}: {
  facilitador: Facilitador;
  organizaciones: { id: string; razon_social: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [datosBloqueados, setDatosBloqueados] = useState(false);
  const [form, setForm] = useState({
    nombres: facilitador.nombres,
    apellidos: facilitador.apellidos,
    tituloProfesional: facilitador.titulo_profesional ?? "",
    esExpertoPrevencion: facilitador.es_experto_prevencion,
    tipoProveedor: facilitador.tipo_proveedor as TipoProveedor,
    entidadNombre: facilitador.organismos_administradores?.nombre ?? facilitador.entidades_acreditadas?.nombre ?? "",
  });

  const organizacionNombre = organizaciones.find((o) => o.id === facilitador.organizacion_id)?.razon_social;

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v || facilitador.tipo_proveedor !== "interno") return;

    buscarPersonaPorRun(facilitador.run).then((persona) => {
      if (persona) {
        // El nombre pertenece a un registro existente (persona o cuenta de
        // usuario) — se bloquea aquí y se refresca con el valor vigente,
        // para que una corrección hecha en el origen (ej. agregar el
        // segundo apellido) se propague en vez de quedar una copia obsoleta.
        setForm((f) => ({ ...f, nombres: persona.nombres, apellidos: persona.apellidos }));
        setDatosBloqueados(true);
      } else {
        setDatosBloqueados(false);
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.tipoProveedor !== "interno" && !form.entidadNombre.trim()) {
      toast.error("Indica el nombre de la entidad externa.");
      return;
    }

    startTransition(async () => {
      const resultado = await actualizarFacilitador({
        facilitadorId: facilitador.id,
        organizacionId: facilitador.organizacion_id!,
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        tituloProfesional: form.tituloProfesional.trim() || null,
        esExpertoPrevencion: form.esExpertoPrevencion,
        tipoProveedor: form.tipoProveedor,
        entidadNombre: form.tipoProveedor === "interno" ? null : form.entidadNombre.trim(),
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Facilitador actualizado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="icon" variant="ghost" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar facilitador</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>RUN</Label>
            <Input value={`${facilitador.run}-${facilitador.dv}`} disabled className="font-mono" />
          </div>
          {organizacionNombre && (
            <div className="flex flex-col gap-1.5">
              <Label>Organización</Label>
              <Input value={organizacionNombre} disabled />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de proveedor</Label>
            <Select
              items={TIPO_PROVEEDOR_LABEL}
              value={form.tipoProveedor}
              onValueChange={(v) => setForm((f) => ({ ...f, tipoProveedor: (v ?? "interno") as TipoProveedor }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_PROVEEDOR_LABEL) as TipoProveedor[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_PROVEEDOR_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.tipoProveedor !== "interno" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entidadNombreEdit">
                Nombre {form.tipoProveedor === "oal" ? "del organismo administrador" : "de la OTEC"}
              </Label>
              <Input
                id="entidadNombreEdit"
                required
                value={form.entidadNombre}
                onChange={(e) => setForm((f) => ({ ...f, entidadNombre: e.target.value }))}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombresEdit">Nombres</Label>
              <Input
                id="nombresEdit"
                required
                disabled={datosBloqueados}
                value={form.nombres}
                onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidosEdit">Apellidos</Label>
              <Input
                id="apellidosEdit"
                required
                disabled={datosBloqueados}
                value={form.apellidos}
                onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
              />
            </div>
          </div>
          {datosBloqueados && (
            <p className="text-xs text-muted-foreground -mt-2">
              Nombres y apellidos vienen del registro existente para este RUT (persona o cuenta de usuario) y no se
              pueden editar aquí — se actualizan automáticamente si cambian en el origen.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tituloEdit">Título profesional</Label>
            <Input
              id="tituloEdit"
              value={form.tituloProfesional}
              onChange={(e) => setForm((f) => ({ ...f, tituloProfesional: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={form.esExpertoPrevencion}
              onChange={(e) => setForm((f) => ({ ...f, esExpertoPrevencion: e.target.checked }))}
            />
            Es experto/a en prevención de riesgos
          </label>
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

function ToggleActivoButton({ facilitador }: { facilitador: Facilitador }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const resultado = await actualizarEstadoFacilitador({
        facilitadorId: facilitador.id,
        organizacionId: facilitador.organizacion_id!,
        activo: !facilitador.activo,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(facilitador.activo ? "Facilitador desactivado." : "Facilitador reactivado.");
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      title={facilitador.activo ? "Desactivar facilitador" : "Reactivar facilitador"}
      onClick={onClick}
    >
      {facilitador.activo ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
    </Button>
  );
}
