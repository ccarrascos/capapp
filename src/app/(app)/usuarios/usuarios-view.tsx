"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Copy, Check, Ban, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Pencil, X } from "lucide-react";
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
import { crearUsuario, actualizarEstadoUsuario, agregarRolUsuario, quitarRolUsuario } from "./actions";
import { coincideBusqueda } from "@/lib/busqueda";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { SearchInput } from "@/components/ui/search-input";
import type { RolNombre } from "@/lib/auth";
import { parsearRut, esRutValido, formatearRut, formatearRutInput } from "@/lib/rut";
import { cn } from "@/lib/utils";

type Asignacion = {
  id: string;
  organizacion_id: string | null;
  centro_trabajo_id: string | null;
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
  centros_trabajo: { nombre: string } | null;
  organizaciones: { razon_social: string } | null;
};

type Usuario = NonNullable<Asignacion["usuarios"]>;
type Cuenta = { usuario: Usuario; asignaciones: Asignacion[] };

function agruparPorCuenta(asignaciones: Asignacion[]): Cuenta[] {
  const porUsuario = new Map<string, Cuenta>();
  for (const a of asignaciones) {
    if (!a.usuarios) continue;
    const cuenta = porUsuario.get(a.usuarios.id) ?? { usuario: a.usuarios, asignaciones: [] };
    cuenta.asignaciones.push(a);
    porUsuario.set(a.usuarios.id, cuenta);
  }
  return [...porUsuario.values()];
}

type Centro = { id: string; nombre: string; organizacion_id: string };

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

function textoBuscable(c: Cuenta): string {
  return [
    c.usuario.nombres,
    c.usuario.apellidos,
    c.usuario.run,
    c.usuario.dv,
    c.usuario.email,
    ...c.asignaciones.map((a) => (a.roles ? ROL_LABEL[a.roles.nombre] : null)),
    c.usuario.activo ? "activa" : "inactiva",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type ColumnaOrdenable = "nombre" | "rut" | "correo" | "rol" | "estado";
type Orden = { columna: ColumnaOrdenable; direccion: "asc" | "desc" };

function valorOrdenable(c: Cuenta, columna: ColumnaOrdenable): string | number {
  switch (columna) {
    case "nombre":
      return `${c.usuario.nombres} ${c.usuario.apellidos}`.trim().toLowerCase();
    case "rut":
      return Number(c.usuario.run ?? 0);
    case "correo":
      return c.usuario.email.toLowerCase();
    case "rol":
      return c.asignaciones
        .map((a) => (a.roles ? ROL_LABEL[a.roles.nombre] : ""))
        .sort()
        .join(" ")
        .toLowerCase();
    case "estado":
      return c.usuario.activo ? 0 : 1;
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
  centros,
  esSuperAdmin,
  usuarioActualId,
}: {
  asignaciones: Asignacion[];
  organizaciones: { id: string; razon_social: string }[];
  centros: Centro[];
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

  const cuentas = useMemo(() => agruparPorCuenta(asignaciones), [asignaciones]);
  const idsGestionables = useMemo(() => new Set(organizaciones.map((o) => o.id)), [organizaciones]);
  const mostrarOrganizacion = esSuperAdmin || organizaciones.length > 1;

  const filtradas = useMemo(() => {
    const resultado = busqueda.trim()
      ? cuentas.filter((c) => coincideBusqueda(textoBuscable(c), busqueda))
      : cuentas;

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
  }, [cuentas, busqueda, orden]);

  const { pagina, setPagina, tamano, setTamano, totalPaginas, paginaItems, totalItems } = usePaginacion(filtradas);

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
        <NuevaCuentaDialog organizaciones={organizaciones} centros={centros} esSuperAdmin={esSuperAdmin} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {totalItems} cuenta{totalItems === 1 ? "" : "s"}
        </p>

        <SearchInput
          className="w-full sm:w-72"
          placeholder="Buscar por nombre, RUT, correo, rol…"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nombre" columna="nombre" orden={orden} onSort={onSort} />
              <SortableHead label="RUT" columna="rut" orden={orden} onSort={onSort} />
              <SortableHead label="Correo" columna="correo" orden={orden} onSort={onSort} />
              <SortableHead label="Roles" columna="rol" orden={orden} onSort={onSort} />
              <SortableHead label="Estado" columna="estado" orden={orden} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {cuentas.length === 0
                    ? "No hay cuentas registradas todavía."
                    : "No hay cuentas que coincidan con el filtro."}
                </TableCell>
              </TableRow>
            )}
            {paginaItems.map((c) => {
              const esPropia = c.usuario.id === usuarioActualId;
              const orgParaEstado =
                c.asignaciones.find((a) => a.organizacion_id && idsGestionables.has(a.organizacion_id))
                  ?.organizacion_id ?? null;
              return (
                <TableRow key={c.usuario.id}>
                  <TableCell className="font-medium">
                    {c.usuario.nombres} {c.usuario.apellidos}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {c.usuario.run && c.usuario.dv ? formatearRut(c.usuario.run, c.usuario.dv) : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.usuario.email}</TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5">
                      <div className="flex flex-wrap gap-1">
                        {c.asignaciones.map((a) => (
                          <Badge key={a.id} variant="secondary" className="rounded-sm">
                            {etiquetaAsignacion(a, mostrarOrganizacion)}
                          </Badge>
                        ))}
                      </div>
                      {(!esPropia || idsGestionables.size > 0 || esSuperAdmin) && (
                        <GestionarRolesDialog
                          esPropia={esPropia}
                          cuenta={c}
                          organizaciones={organizaciones}
                          centros={centros}
                          esSuperAdmin={esSuperAdmin}
                          mostrarOrganizacion={mostrarOrganizacion}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {c.usuario.activo ? (
                        <span className="text-xs text-clear">Activa</span>
                      ) : (
                        <span className="text-xs text-alert">Inactiva</span>
                      )}
                      {!esPropia && <ToggleActivoButton usuario={c.usuario} organizacionId={orgParaEstado} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalItems}
          tamano={tamano}
          onTamanoChange={setTamano}
          onPaginaChange={setPagina}
          etiqueta="cuenta"
        />
      </div>
    </div>
  );
}

function NuevaCuentaDialog({
  organizaciones,
  centros,
  esSuperAdmin,
}: {
  organizaciones: { id: string; razon_social: string }[];
  centros: Centro[];
  esSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<
    { email: string; rut: string; emailEnviado: boolean; password?: string; expiraEn?: Date } | null
  >(null);
  const [copiado, setCopiado] = useState(false);
  const rolesDisponibles = esSuperAdmin ? (["super_admin", ...ROLES_ASIGNABLES] as RolNombre[]) : ROLES_ASIGNABLES;
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    rut: "",
    roles: [] as RolNombre[],
    organizacionId: organizaciones[0]?.id ?? "",
    centrosTrabajoIds: [] as string[],
  });
  const requiereOrganizacion = form.roles.length === 0 || form.roles.some((r) => r !== "super_admin");
  const centrosDeOrg = centros.filter((c) => c.organizacion_id === form.organizacionId);

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
        roles: form.roles,
        organizacionId: requiereOrganizacion ? form.organizacionId : null,
        centrosTrabajoIds: form.roles.includes("supervisor_centro") ? form.centrosTrabajoIds : [],
      });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }

      if ("cuentaExistente" in resultado) {
        toast.success(
          `${resultado.nombreExistente} ya tenía una cuenta con ese RUT: se le ${
            (resultado.rolesAgregados ?? []).length > 1 ? "agregaron los roles" : "agregó el rol"
          } ${(resultado.rolesAgregados ?? []).map((r) => ROL_LABEL[r]).join(", ")}. Sigue ingresando con su contraseña actual.`,
          { duration: 10000 },
        );
        if (resultado.avisoFacilitador) toast.warning(resultado.avisoFacilitador, { duration: 10000 });
        setForm({
          nombres: "",
          apellidos: "",
          email: "",
          rut: "",
          roles: [] as RolNombre[],
          organizacionId: organizaciones[0]?.id ?? "",
          centrosTrabajoIds: [] as string[],
        });
        cerrarYLimpiar();
        return;
      }

      if (resultado.avisoFacilitador) toast.warning(resultado.avisoFacilitador, { duration: 10000 });
      const rutFormateado = formatearRut(parsed.run, parsed.dv);
      setResultado(
        resultado.emailEnviado
          ? { email: form.email.trim(), rut: rutFormateado, emailEnviado: true }
          : {
              email: form.email.trim(),
              rut: rutFormateado,
              emailEnviado: false,
              password: resultado.passwordTemporal,
              expiraEn: resultado.expiraEn,
            },
      );
      setForm({
        nombres: "",
        apellidos: "",
        email: "",
        rut: "",
        roles: [] as RolNombre[],
        organizacionId: organizaciones[0]?.id ?? "",
        centrosTrabajoIds: [] as string[],
      });
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
              <DialogTitle>{resultado.emailEnviado ? "Cuenta creada" : "Cuenta creada - correo no enviado"}</DialogTitle>
              <DialogDescription>
                {resultado.emailEnviado
                  ? `Enviamos las credenciales de acceso directamente a ${resultado.email}.`
                  : `No se pudo enviar el correo de bienvenida. Comparte esta contraseña temporal de forma segura - no volverá a mostrarse.${
                      resultado.expiraEn
                        ? ` Caduca el ${resultado.expiraEn.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}.`
                        : ""
                    }`}
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
                <Label>Roles</Label>
                <SelectorRoles
                  disponibles={rolesDisponibles}
                  seleccionados={form.roles}
                  onChange={(roles) => setForm((f) => ({ ...f, roles }))}
                />
                <p className="text-xs text-muted-foreground">Puedes marcar varios.</p>
              </div>
              {requiereOrganizacion && (
                <div className="flex flex-col gap-1.5">
                  <Label>Organización</Label>
                  <Select
                    items={Object.fromEntries(organizaciones.map((o) => [o.id, o.razon_social]))}
                    value={form.organizacionId}
                    onValueChange={(v) => setForm((f) => ({ ...f, organizacionId: v ?? "", centrosTrabajoIds: [] }))}
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
              {form.roles.includes("supervisor_centro") && (
                <SelectorCentros
                  centros={centrosDeOrg}
                  seleccionados={form.centrosTrabajoIds}
                  onChange={(ids) => setForm((f) => ({ ...f, centrosTrabajoIds: ids }))}
                />
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending || form.roles.length === 0}>
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

function SelectorRoles({
  disponibles,
  seleccionados,
  onChange,
  disabled,
}: {
  disponibles: RolNombre[];
  seleccionados: RolNombre[];
  onChange: (roles: RolNombre[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-border p-3">
      {disponibles.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            disabled={disabled}
            checked={seleccionados.includes(r)}
            onChange={(e) =>
              onChange(e.target.checked ? [...seleccionados, r] : seleccionados.filter((x) => x !== r))
            }
          />
          {ROL_LABEL[r]}
        </label>
      ))}
    </div>
  );
}

function SelectorCentros({
  centros,
  seleccionados,
  onChange,
  disabled,
}: {
  centros: Centro[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Centros que supervisa</Label>
      {centros.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay centros disponibles; supervisará toda la organización.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-border p-3">
          {centros.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                disabled={disabled}
                checked={seleccionados.includes(c.id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...seleccionados, c.id] : seleccionados.filter((x) => x !== c.id))
                }
              />
              {c.nombre}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Puedes marcar varios. Si no marcas ninguno, verá el cumplimiento de toda la organización.
      </p>
    </div>
  );
}

function etiquetaAsignacion(a: Asignacion, mostrarOrganizacion: boolean) {
  const partes = [a.roles ? ROL_LABEL[a.roles.nombre] : "-"];
  if (a.roles?.nombre === "supervisor_centro" && a.centros_trabajo) partes.push(a.centros_trabajo.nombre);
  if (mostrarOrganizacion && a.organizaciones) partes.push(a.organizaciones.razon_social);
  return partes.join(" · ");
}

function GestionarRolesDialog({
  esPropia,
  cuenta,
  organizaciones,
  centros,
  esSuperAdmin,
  mostrarOrganizacion,
}: {
  esPropia: boolean;
  cuenta: Cuenta;
  organizaciones: { id: string; razon_social: string }[];
  centros: Centro[];
  esSuperAdmin: boolean;
  mostrarOrganizacion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rolesDisponibles: RolNombre[] = esPropia
    ? ["facilitador"]
    : esSuperAdmin
      ? ["super_admin", ...ROLES_ASIGNABLES]
      : ROLES_ASIGNABLES;
  const orgInicial =
    cuenta.asignaciones.find((a) => a.organizacion_id && organizaciones.some((o) => o.id === a.organizacion_id))
      ?.organizacion_id ??
    organizaciones[0]?.id ??
    "";
  const [organizacionId, setOrganizacionId] = useState(orgInicial);
  const [seleccion, setSeleccion] = useState<RolNombre[]>([]);
  const [centrosSeleccionados, setCentrosSeleccionados] = useState<string[]>([]);
  const centrosDeOrg = centros.filter((c) => c.organizacion_id === organizacionId);

  // supervisor_centro se repite una vez por centro; el resto, una vez por organización.
  const supervisionesEnOrg = cuenta.asignaciones.filter(
    (a) => a.roles?.nombre === "supervisor_centro" && a.organizacion_id === organizacionId,
  );
  const supervisaTodaLaOrg = supervisionesEnOrg.some((a) => !a.centro_trabajo_id);
  const centrosLibres = centrosDeOrg.filter((c) => !supervisionesEnOrg.some((a) => a.centro_trabajo_id === c.id));
  const yaAsignado = (r: RolNombre) =>
    r === "supervisor_centro"
      ? supervisaTodaLaOrg || (centrosDeOrg.length > 0 && centrosLibres.length === 0)
      : cuenta.asignaciones.some(
          (a) => a.roles?.nombre === r && a.organizacion_id === (r === "super_admin" ? null : organizacionId),
        );
  const rolesParaAgregar = rolesDisponibles.filter((r) => !yaAsignado(r));
  const aAgregar = seleccion.filter((r) => rolesParaAgregar.includes(r));
  const requiereOrganizacion = aAgregar.length === 0 || aAgregar.some((r) => r !== "super_admin");

  const puedeGestionar = (a: Asignacion) =>
    a.roles?.nombre !== "trabajador" &&
    (!esPropia || a.roles?.nombre === "facilitador") &&
    (esSuperAdmin || (!!a.organizacion_id && organizaciones.some((o) => o.id === a.organizacion_id)));

  function quitar(a: Asignacion) {
    startTransition(async () => {
      const resultado = await quitarRolUsuario({ usuarioRolId: a.id, usuarioId: cuenta.usuario.id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(`Se quitó el rol ${a.roles ? ROL_LABEL[a.roles.nombre] : ""}.`);
    });
  }

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (aAgregar.length === 0) return;
    startTransition(async () => {
      const agregados: RolNombre[] = [];
      for (const rol of aAgregar) {
        const centrosMarcados = centrosSeleccionados.filter((id) => centrosLibres.some((c) => c.id === id));
        const centrosDelRol: (string | null)[] =
          rol === "supervisor_centro" && centrosMarcados.length > 0 ? centrosMarcados : [null];
        for (const centroTrabajoId of centrosDelRol) {
          const resultado = await agregarRolUsuario({
            usuarioId: cuenta.usuario.id,
            organizacionId: rol === "super_admin" ? null : organizacionId,
            rol,
            centroTrabajoId,
          });
          if (!resultado.ok) {
            toast.error(`${ROL_LABEL[rol]}: ${resultado.mensaje}`);
            continue;
          }
          if (!agregados.includes(rol)) agregados.push(rol);
          if (resultado.avisoFacilitador) toast.warning(resultado.avisoFacilitador, { duration: 10000 });
        }
      }
      if (agregados.length === 0) return;
      toast.success(
        `${agregados.length > 1 ? "Se agregaron los roles" : "Se agregó el rol"} ${agregados.map((r) => ROL_LABEL[r]).join(", ")}.`,
      );
      setSeleccion([]);
      setCentrosSeleccionados([]);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="size-6 shrink-0" title="Gestionar roles" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Roles de la cuenta</DialogTitle>
          <DialogDescription>
            {esPropia
              ? "Tu cuenta. Puedes agregarte el rol de facilitador para impartir cursos; tus demás roles los gestiona otro administrador."
              : `${cuenta.usuario.nombres} ${cuenta.usuario.apellidos}. Una misma cuenta puede tener varios roles; ingresa siempre con su RUT y verá lo que cada rol le permite.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Roles actuales</Label>
          <div className="flex flex-col divide-y divide-border border border-border">
            {cuenta.asignaciones.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{etiquetaAsignacion(a, mostrarOrganizacion)}</span>
                {puedeGestionar(a) && cuenta.asignaciones.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={pending}
                    title="Quitar este rol"
                    aria-label={`Quitar rol ${a.roles ? ROL_LABEL[a.roles.nombre] : ""}`}
                    onClick={() => quitar(a)}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {cuenta.asignaciones.length === 1 && (
            <p className="text-xs text-muted-foreground">
              Es su único rol. Para quitarle el acceso, desactiva la cuenta.
            </p>
          )}
        </div>

        {rolesParaAgregar.length === 0 ? (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {esPropia ? "Ya tienes el rol de facilitador." : "Esta cuenta ya tiene todos los roles que puedes asignarle."}
          </p>
        ) : (
          <form onSubmit={agregar} className="flex flex-col gap-3 border-t border-border pt-4">
            <Label>Agregar roles</Label>
            <SelectorRoles
              disponibles={rolesParaAgregar}
              seleccionados={seleccion}
              onChange={setSeleccion}
              disabled={pending}
            />
            {requiereOrganizacion && organizaciones.length > 1 && (
              <Select
                items={Object.fromEntries(organizaciones.map((o) => [o.id, o.razon_social]))}
                value={organizacionId}
                onValueChange={(v) => {
                  setOrganizacionId(v ?? "");
                  setCentrosSeleccionados([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Organización" />
                </SelectTrigger>
                <SelectContent>
                  {organizaciones.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.razon_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {aAgregar.includes("supervisor_centro") && (
              <SelectorCentros
                centros={centrosLibres}
                seleccionados={centrosSeleccionados.filter((id) => centrosLibres.some((c) => c.id === id))}
                onChange={setCentrosSeleccionados}
                disabled={pending}
              />
            )}
            {aAgregar.includes("facilitador") && (
              <p className="text-xs text-muted-foreground">
                Facilitador: se vincula con su ficha en Facilitadores (mismo RUT) para que vea y gestione sus ediciones.
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending || aAgregar.length === 0 || (requiereOrganizacion && !organizacionId)}>
                {pending ? "Guardando…" : aAgregar.length > 1 ? `Agregar ${aAgregar.length} roles` : "Agregar rol"}
              </Button>
            </DialogFooter>
          </form>
        )}
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
