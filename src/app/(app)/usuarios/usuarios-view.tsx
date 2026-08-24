"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Copy, Check, Ban, RotateCcw, Search, ArrowUp, ArrowDown, ArrowUpDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { crearUsuario, actualizarEstadoUsuario, actualizarRolUsuario } from "./actions";
import { coincideBusqueda } from "@/lib/busqueda";
import type { RolNombre } from "@/lib/auth";
import { parsearRut, esRutValido, formatearRut, formatearRutInput } from "@/lib/rut";
import { cn } from "@/lib/utils";

type Asignacion = {
  id: string;
  organizacion_id: string | null;
  usuarios: {
    id: string;
    nombres: string;
    apellidos: string;
    email: string;
    run: string | null;
    dv: string | null;
    activo: boolean;
  } | null;
  roles: { nombre: RolNombre } | null;
};

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Admin. organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

const ROLES_ASIGNABLES: RolNombre[] = [
  "admin_organizacion",
  "prevencionista",
  "facilitador",
  "supervisor_centro",
  "auditor",
];

function textoBuscable(a: Asignacion): string {
  return [
    a.usuarios?.nombres,
    a.usuarios?.apellidos,
    a.usuarios?.run,
    a.usuarios?.dv,
    a.usuarios?.email,
    a.roles ? ROL_LABEL[a.roles.nombre] : null,
    a.usuarios?.activo ? "activa" : "inactiva",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type ColumnaOrdenable = "nombre" | "rut" | "correo" | "rol" | "estado";
type Orden = { columna: ColumnaOrdenable; direccion: "asc" | "desc" };

function valorOrdenable(a: Asignacion, columna: ColumnaOrdenable): string | number {
  switch (columna) {
    case "nombre":
      return `${a.usuarios?.nombres ?? ""} ${a.usuarios?.apellidos ?? ""}`.trim().toLowerCase();
    case "rut":
      return Number(a.usuarios?.run ?? 0);
    case "correo":
      return (a.usuarios?.email ?? "").toLowerCase();
    case "rol":
      return (a.roles ? ROL_LABEL[a.roles.nombre] : "").toLowerCase();
    case "estado":
      return a.usuarios?.activo ? 0 : 1;
  }
}

function SortableHead({
  label,
  columna,
  orden,
  onSort,
}: {
  label: string;
  columna: ColumnaOrdenable;
  orden: Orden | null;
  onSort: (c: ColumnaOrdenable) => void;
}) {
  const activo = orden?.columna === columna;
  const Icon = activo ? (orden!.direccion === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(columna)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", activo && "text-foreground")}
      >
        {label}
        <Icon className={cn("size-3.5", !activo && "text-muted-foreground/50")} />
      </button>
    </TableHead>
  );
}

export function UsuariosView({
  asignaciones,
  organizaciones,
  esSuperAdmin,
  usuarioActualId,
}: {
  asignaciones: Asignacion[];
  organizaciones: { id: string; razon_social: string }[];
  esSuperAdmin: boolean;
  usuarioActualId: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden | null>(null);

  function onSort(columna: ColumnaOrdenable) {
    setOrden((prev) => {
      if (prev?.columna === columna) {
        return prev.direccion === "asc" ? { columna, direccion: "desc" } : null;
      }
      return { columna, direccion: "asc" };
    });
  }

  const filtradas = useMemo(() => {
    const resultado = busqueda.trim()
      ? asignaciones.filter((a) => coincideBusqueda(textoBuscable(a), busqueda))
      : asignaciones;

    if (!orden) return resultado;

    const conValor = resultado.map((a) => ({ a, v: valorOrdenable(a, orden.columna) }));
    conValor.sort((x, y) => {
      const xVacio = x.v === "" || x.v === null;
      const yVacio = y.v === "" || y.v === null;
      if (xVacio && yVacio) return 0;
      if (xVacio) return 1;
      if (yVacio) return -1;

      const cmp =
        typeof x.v === "string" && typeof y.v === "string"
          ? x.v.localeCompare(y.v, "es", { sensitivity: "base" })
          : x.v < y.v
            ? -1
            : x.v > y.v
              ? 1
              : 0;
      return orden.direccion === "asc" ? cmp : -cmp;
    });
    return conValor.map((x) => x.a);
  }, [asignaciones, busqueda, orden]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Módulo de usuarios
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Cuentas y roles
          </h1>
        </div>
        <NuevaCuentaDialog organizaciones={organizaciones} esSuperAdmin={esSuperAdmin} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtradas.length} cuenta{filtradas.length === 1 ? "" : "s"}
        </p>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, RUT, correo, rol…"
            className="pl-8"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nombre" columna="nombre" orden={orden} onSort={onSort} />
              <SortableHead label="RUT" columna="rut" orden={orden} onSort={onSort} />
              <SortableHead label="Correo" columna="correo" orden={orden} onSort={onSort} />
              <SortableHead label="Rol" columna="rol" orden={orden} onSort={onSort} />
              <SortableHead label="Estado" columna="estado" orden={orden} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {asignaciones.length === 0
                    ? "No hay cuentas registradas todavía."
                    : "No hay cuentas que coincidan con el filtro."}
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {a.usuarios ? `${a.usuarios.nombres} ${a.usuarios.apellidos}` : "—"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {a.usuarios?.run && a.usuarios?.dv ? formatearRut(a.usuarios.run, a.usuarios.dv) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{a.usuarios?.email ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-sm">
                      {a.roles ? ROL_LABEL[a.roles.nombre] : "—"}
                    </Badge>
                    {a.usuarios && a.organizacion_id && a.usuarios.id !== usuarioActualId && (
                      <EditarRolDialog
                        usuarioRolId={a.id}
                        usuarioId={a.usuarios.id}
                        organizacionId={a.organizacion_id}
                        rolActual={a.roles?.nombre ?? null}
                        nombreCompleto={`${a.usuarios.nombres} ${a.usuarios.apellidos}`}
                        esSuperAdmin={esSuperAdmin}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {a.usuarios?.activo ? (
                      <span className="text-xs text-clear">Activa</span>
                    ) : (
                      <span className="text-xs text-alert">Inactiva</span>
                    )}
                    {a.usuarios && a.usuarios.id !== usuarioActualId && (
                      <ToggleActivoButton usuario={a.usuarios} organizacionId={a.organizacion_id} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NuevaCuentaDialog({
  organizaciones,
  esSuperAdmin,
}: {
  organizaciones: { id: string; razon_social: string }[];
  esSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<
    { email: string; rut: string; emailEnviado: boolean; password?: string } | null
  >(null);
  const [copiado, setCopiado] = useState(false);
  const rolesDisponibles = esSuperAdmin ? (["super_admin", ...ROLES_ASIGNABLES] as RolNombre[]) : ROLES_ASIGNABLES;
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    rut: "",
    rol: rolesDisponibles[0],
    organizacionId: organizaciones[0]?.id ?? "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = parsearRut(form.rut);
    if (!parsed) {
      toast.error("Ingresa un RUT válido, por ejemplo 12.345.678-9.");
      return;
    }
    if (!esRutValido(parsed.run, parsed.dv)) {
      toast.error("El dígito verificador del RUT no es correcto.");
      return;
    }

    startTransition(async () => {
      const resultado = await crearUsuario({
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        email: form.email.trim(),
        run: parsed.run,
        dv: parsed.dv,
        rol: form.rol,
        organizacionId: form.rol === "super_admin" ? null : form.organizacionId,
        centroTrabajoId: null,
      });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }

      const rutFormateado = formatearRut(parsed.run, parsed.dv);
      setResultado(
        resultado.emailEnviado
          ? { email: form.email.trim(), rut: rutFormateado, emailEnviado: true }
          : { email: form.email.trim(), rut: rutFormateado, emailEnviado: false, password: resultado.passwordTemporal },
      );
      setForm({ nombres: "", apellidos: "", email: "", rut: "", rol: rolesDisponibles[0], organizacionId: organizaciones[0]?.id ?? "" });
    });
  }

  function cerrarYLimpiar() {
    setOpen(false);
    setResultado(null);
    setCopiado(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cerrarYLimpiar())}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nueva cuenta
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {resultado ? (
          <>
            <DialogHeader>
              <DialogTitle>{resultado.emailEnviado ? "Cuenta creada" : "Cuenta creada — correo no enviado"}</DialogTitle>
              <DialogDescription>
                {resultado.emailEnviado
                  ? `Enviamos las credenciales de acceso directamente a ${resultado.email}.`
                  : "No se pudo enviar el correo de bienvenida. Comparte esta contraseña temporal de forma segura — no volverá a mostrarse."}
              </DialogDescription>
            </DialogHeader>
            {!resultado.emailEnviado && resultado.password && (
              <div className="border border-border bg-muted p-4 font-mono text-sm space-y-2">
                <p>
                  <span className="text-muted-foreground">RUT de acceso: </span>
                  {resultado.rut}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-muted-foreground">Clave temporal: </span>
                    {resultado.password}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(resultado.password!);
                      setCopiado(true);
                    }}
                  >
                    {copiado ? <Check className="size-4 text-clear" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={cerrarYLimpiar}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Crear cuenta de usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nombres">Nombres</Label>
                  <Input id="nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apellidos">Apellidos</Label>
                  <Input id="apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rut">RUT (acceso)</Label>
                  <Input
                    id="rut"
                    required
                    value={form.rut}
                    onChange={(e) => setForm((f) => ({ ...f, rut: formatearRutInput(e.target.value) }))}
                    placeholder="12.345.678-9"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Rol</Label>
                <Select
                  items={Object.fromEntries(rolesDisponibles.map((r) => [r, ROL_LABEL[r]]))}
                  value={form.rol}
                  onValueChange={(v) => setForm((f) => ({ ...f, rol: (v ?? "trabajador") as RolNombre }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesDisponibles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROL_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.rol !== "super_admin" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Organización</Label>
                  <Select
                    items={Object.fromEntries(organizaciones.map((o) => [o.id, o.razon_social]))}
                    value={form.organizacionId}
                    onValueChange={(v) => setForm((f) => ({ ...f, organizacionId: v ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una organización" />
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
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando…" : "Crear cuenta"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditarRolDialog({
  usuarioRolId,
  usuarioId,
  organizacionId,
  rolActual,
  nombreCompleto,
  esSuperAdmin,
}: {
  usuarioRolId: string;
  usuarioId: string;
  organizacionId: string;
  rolActual: RolNombre | null;
  nombreCompleto: string;
  esSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rolesDisponibles = esSuperAdmin ? (["super_admin", ...ROLES_ASIGNABLES] as RolNombre[]) : ROLES_ASIGNABLES;
  const [nuevoRol, setNuevoRol] = useState<RolNombre>(
    rolActual && rolesDisponibles.includes(rolActual) ? rolActual : rolesDisponibles[0],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await actualizarRolUsuario({ usuarioRolId, usuarioId, organizacionId, nuevoRol });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Rol actualizado.");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setNuevoRol(rolActual && rolesDisponibles.includes(rolActual) ? rolActual : rolesDisponibles[0]);
      }}
    >
      <DialogTrigger render={<Button size="icon" variant="ghost" className="size-6" title="Cambiar rol" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar rol</DialogTitle>
          <DialogDescription>{nombreCompleto}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nuevo rol</Label>
            <Select
              items={Object.fromEntries(rolesDisponibles.map((r) => [r, ROL_LABEL[r]]))}
              value={nuevoRol}
              onValueChange={(v) => setNuevoRol((v ?? rolesDisponibles[0]) as RolNombre)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolesDisponibles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROL_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || nuevoRol === rolActual}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActivoButton({
  usuario,
  organizacionId,
}: {
  usuario: { id: string; activo: boolean };
  organizacionId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const resultado = await actualizarEstadoUsuario({
        usuarioId: usuario.id,
        organizacionId,
        activo: !usuario.activo,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(usuario.activo ? "Cuenta desactivada." : "Cuenta reactivada.");
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-6"
      disabled={pending}
      title={usuario.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
      onClick={onClick}
    >
      {usuario.activo ? <Ban className="size-3.5" /> : <RotateCcw className="size-3.5" />}
    </Button>
  );
}
