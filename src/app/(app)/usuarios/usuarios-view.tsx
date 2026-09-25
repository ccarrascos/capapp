"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Ban, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { actualizarEstadoUsuario, agregarRolUsuario, quitarRolUsuario } from "./actions";
import {
  CrearCuentaDialog,
  SelectorCentros,
  SelectorRoles,
  type Centro,
} from "@/components/cuentas/crear-cuenta-dialog";
import { ROL_LABEL, ROLES_ASIGNABLES } from "@/lib/roles";
import { coincideBusqueda } from "@/lib/busqueda";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { SearchInput } from "@/components/ui/search-input";
import type { RolNombre } from "@/lib/auth";
import { formatearRut } from "@/lib/rut";
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
        <CrearCuentaDialog
          organizaciones={organizaciones}
          centros={centros}
          rolesDisponibles={[...(esSuperAdmin ? (["super_admin"] as RolNombre[]) : []), ...ROLES_ASIGNABLES, "trabajador"]}
          trigger={
            <Button>
              <Plus className="size-4" />
              Nueva cuenta
            </Button>
          }
        />
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
      ? ["super_admin", ...ROLES_ASIGNABLES, "trabajador"]
      : [...ROLES_ASIGNABLES, "trabajador"];
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
