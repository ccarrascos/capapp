"use client";

import { useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearUsuario } from "@/app/(app)/usuarios/actions";
import type { IdentidadEncontrada } from "@/app/(app)/personas/actions";
import type { RolNombre } from "@/lib/auth";
import { ROL_LABEL } from "@/lib/roles";
import { esRutValido, formatearRut } from "@/lib/rut";
import {
  CamposIdentidad,
  IDENTIDAD_VACIA,
  apellidosJuntos,
  cuerpoRun,
  dvDe,
  type Identidad,
} from "@/components/cuentas/campos-identidad";

export type Centro = { id: string; nombre: string; organizacion_id: string };


export type DatosInicialesCuenta = {
  identidad?: Identidad;
  email?: string;
  organizacionId?: string;
  roles?: RolNombre[];
};

/**
 * Único formulario para crear cuentas o sumar roles, se abra desde Usuarios
 * y roles o desde la matriz ("Dar acceso"). Detrás siempre está crearUsuario,
 * que reutiliza la cuenta si el RUT ya existe y la enlaza con su ficha.
 */
export function CrearCuentaDialog({
  organizaciones,
  centros,
  rolesDisponibles,
  inicial,
  identidadFija = false,
  trigger,
  titulo = "Crear cuenta de usuario",
}: {
  organizaciones: { id: string; razon_social: string }[];
  centros: Centro[];
  rolesDisponibles: RolNombre[];
  inicial?: DatosInicialesCuenta;
  /** RUT y nombre vienen de la ficha del trabajador: no se editan aquí. */
  identidadFija?: boolean;
  trigger: React.ReactElement;
  titulo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<
    { email: string; rut: string; emailEnviado: boolean; password?: string; expiraEn?: Date } | null
  >(null);
  const [copiado, setCopiado] = useState(false);
  const [encontrada, setEncontrada] = useState<IdentidadEncontrada | null>(null);
  const cuentaExistente = !!encontrada?.tieneCuenta;
  const formularioInicial = () => ({
    identidad: inicial?.identidad ?? IDENTIDAD_VACIA,
    email: inicial?.email ?? "",
    roles: (inicial?.roles ?? []).filter((r) => rolesDisponibles.includes(r)),
    organizacionId: inicial?.organizacionId ?? organizaciones[0]?.id ?? "",
    centrosTrabajoIds: [] as string[],
  });
  const [form, setForm] = useState(formularioInicial);
  // Roles que la cuenta ya tiene: se muestran marcados y no se envían de nuevo.
  const rolesActuales = (encontrada?.rolesCuenta ?? [])
    .filter((r) => (r.rol === "super_admin" ? r.organizacionId === null : r.organizacionId === form.organizacionId))
    .map((r) => r.rol);
  const rolesNuevos = form.roles.filter((r) => !rolesActuales.includes(r));
  const requiereOrganizacion = rolesNuevos.length === 0 || rolesNuevos.some((r) => r !== "super_admin");
  const centrosDeOrg = centros.filter((c) => c.organizacion_id === form.organizacionId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const run = cuerpoRun(form.identidad.run);
    const dv = dvDe(form.identidad.run);
    if (!run || !esRutValido(run, dv)) {
      toast.error("Ingresa un RUN válido.");
      return;
    }
    const parsed = { run, dv };

    startTransition(async () => {
      const resultado = await crearUsuario({
        nombres: form.identidad.nombres.trim(),
        apellidos: apellidosJuntos(form.identidad),
        email: cuentaExistente ? "" : form.email.trim(),
        run: parsed.run,
        dv: parsed.dv,
        roles: rolesNuevos,
        organizacionId: requiereOrganizacion ? form.organizacionId : null,
        centrosTrabajoIds: rolesNuevos.includes("supervisor_centro") ? form.centrosTrabajoIds : [],
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
        setForm(formularioInicial());
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
      setForm(formularioInicial());
    });
  }

  function cerrarYLimpiar() {
    setOpen(false);
    setResultado(null);
    setCopiado(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setForm(formularioInicial());
          setEncontrada(null);
          setOpen(true);
        } else {
          cerrarYLimpiar();
        }
      }}
    >
      <DialogTrigger render={trigger} />
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
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription>
                Si el RUN ya está registrado (en la matriz, como facilitador o con cuenta), sus datos se completan
                solos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <CamposIdentidad
                valor={form.identidad}
                fija={identidadFija}
                onChange={(identidad) => setForm((f) => ({ ...f, identidad }))}
                onEncontrada={(resultado) => {
                  setEncontrada(resultado);
                  if (resultado?.email) setForm((f) => ({ ...f, email: f.email || resultado.email! }));
                }}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Correo</Label>
                {cuentaExistente ? (
                  <p className="text-xs text-muted-foreground">
                    Ya tiene cuenta: se le suman los roles marcados y mantiene su correo y contraseña actuales.
                  </p>
                ) : (
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Roles</Label>
                <SelectorRoles
                  disponibles={rolesDisponibles}
                  seleccionados={rolesNuevos}
                  yaAsignados={rolesActuales}
                  onChange={(roles) => setForm((f) => ({ ...f, roles }))}
                />
                <p className="text-xs text-muted-foreground">
                  {rolesActuales.length > 0
                    ? "Los roles en gris ya los tiene; marca los que quieras sumar. Para quitar uno, usa Roles de la cuenta en Usuarios y roles."
                    : rolesDisponibles.length > 1
                      ? "Puedes marcar varios."
                      : "Es el único rol que puedes asignar."}
                  {rolesNuevos.includes("trabajador") && " Trabajador: debe estar en la matriz de vigencia de la organización."}
                </p>
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
              {rolesNuevos.includes("supervisor_centro") && (
                <SelectorCentros
                  centros={centrosDeOrg}
                  seleccionados={form.centrosTrabajoIds}
                  onChange={(ids) => setForm((f) => ({ ...f, centrosTrabajoIds: ids }))}
                />
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending || rolesNuevos.length === 0}>
                  {pending ? "Guardando…" : cuentaExistente ? "Agregar roles" : "Crear cuenta"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SelectorRoles({
  disponibles,
  seleccionados,
  onChange,
  disabled,
  yaAsignados = [],
}: {
  disponibles: RolNombre[];
  seleccionados: RolNombre[];
  onChange: (roles: RolNombre[]) => void;
  disabled?: boolean;
  /** Roles que la cuenta ya tiene: aparecen marcados y no se pueden desmarcar aquí. */
  yaAsignados?: RolNombre[];
}) {
  const visibles = [...disponibles, ...yaAsignados.filter((r) => !disponibles.includes(r))];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-border p-3">
      {visibles.map((r) => {
        const asignado = yaAsignados.includes(r);
        return (
          <label
            key={r}
            className={asignado ? "flex items-center gap-2 text-sm text-muted-foreground" : "flex items-center gap-2 text-sm cursor-pointer"}
            title={asignado ? "Ya tiene este rol" : undefined}
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              disabled={disabled || asignado}
              checked={asignado || seleccionados.includes(r)}
              onChange={(e) =>
                onChange(e.target.checked ? [...seleccionados, r] : seleccionados.filter((x) => x !== r))
              }
            />
            {ROL_LABEL[r]}
          </label>
        );
      })}
    </div>
  );
}

export function SelectorCentros({
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

