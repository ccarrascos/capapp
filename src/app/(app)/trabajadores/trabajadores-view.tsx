"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Plus, ArrowUp, ArrowDown, ArrowUpDown, KeyRound, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignBadge, SignDot, type EstadoVigencia } from "@/components/status/sign-badge";
import { crearTrabajador, crearAccesoTrabajador } from "./actions";
import { formatearRunInput } from "@/lib/rut";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type FilaMatriz = Database["public"]["Views"]["matriz_vigencia_capacitacion"]["Row"] & {
  usuarioId: string | null;
  personaEmail: string | null;
  fechaNacimiento: string | null;
};
type ModalidadContractual = Database["public"]["Enums"]["modalidad_contractual"];

function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

type ColumnaOrdenable = "trabajador" | "run" | "cargo" | "modalidad" | "vence" | "estado";
type Orden = { columna: ColumnaOrdenable; direccion: "asc" | "desc" };

const RANGO_ESTADO: Record<string, number> = {
  vencido: 0,
  por_vencer: 1,
  sin_capacitacion: 2,
  vigente: 3,
};

function valorOrdenable(f: FilaMatriz, columna: ColumnaOrdenable): string | number {
  switch (columna) {
    case "trabajador":
      return `${f.nombres ?? ""} ${f.apellido_paterno ?? ""} ${f.apellido_materno ?? ""}`.toLowerCase();
    case "run":
      return Number(f.run ?? 0);
    case "cargo":
      return (f.cargo ?? "").toLowerCase();
    case "modalidad":
      return (f.modalidad_contractual ?? "").toLowerCase();
    case "vence":
      return f.vigencia_hasta ?? "";
    case "estado":
      return RANGO_ESTADO[f.estado_vigencia ?? ""] ?? 99;
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
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          activo && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !activo && "text-muted-foreground/50")} />
      </button>
    </TableHead>
  );
}

const ESTADOS: { value: EstadoVigencia | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vigente", label: "Vigente" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "vencido", label: "Vencido" },
  { value: "sin_capacitacion", label: "Sin capacitación" },
];

const MODALIDADES: { value: ModalidadContractual; label: string }[] = [
  { value: "indefinido", label: "Indefinido" },
  { value: "plazo_fijo", label: "Plazo fijo" },
  { value: "obra_o_faena", label: "Obra o faena" },
  { value: "aprendiz", label: "Aprendiz" },
  { value: "honorarios", label: "Honorarios" },
  { value: "otro", label: "Otro" },
];

type Cargo = { id: string; nombre: string; organizacion_id: string };

export function TrabajadoresView({
  filas,
  organizaciones,
  cargos,
  puedeGestionar,
}: {
  filas: FilaMatriz[];
  organizaciones: { id: string; razon_social: string }[];
  cargos: Cargo[];
  puedeGestionar: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoVigencia | "todos">("todos");
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
    const q = busqueda.trim().toLowerCase();
    const resultado = filas.filter((f) => {
      const coincideEstado = estado === "todos" || f.estado_vigencia === estado;
      if (!coincideEstado) return false;
      if (!q) return true;
      const nombreCompleto = `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno ?? ""}`.toLowerCase();
      return nombreCompleto.includes(q) || (f.run ?? "").includes(q) || (f.cargo ?? "").toLowerCase().includes(q);
    });

    if (!orden) return resultado;

    const conValor = resultado.map((f) => ({ f, v: valorOrdenable(f, orden.columna) }));
    conValor.sort((a, b) => {
      // Los valores vacíos siempre van al final, sin importar la dirección.
      const aVacio = a.v === "" || a.v === null;
      const bVacio = b.v === "" || b.v === null;
      if (aVacio && bVacio) return 0;
      if (aVacio) return 1;
      if (bVacio) return -1;

      const cmp =
        typeof a.v === "string" && typeof b.v === "string"
          ? a.v.localeCompare(b.v, "es", { sensitivity: "base" })
          : a.v < b.v
            ? -1
            : a.v > b.v
              ? 1
              : 0;
      return orden.direccion === "asc" ? cmp : -cmp;
    });
    return conValor.map((x) => x.f);
  }, [filas, busqueda, estado, orden]);

  const conteos = useMemo(() => {
    const base: Record<string, number> = { todos: filas.length };
    for (const f of filas) {
      base[f.estado_vigencia ?? ""] = (base[f.estado_vigencia ?? ""] ?? 0) + 1;
    }
    return base;
  }, [filas]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Registro de cumplimiento — art. 16 DS 44
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Matriz de vigencia
          </h1>
        </div>
        {puedeGestionar && (
          <NuevoTrabajadorDialog organizaciones={organizaciones} cargos={cargos} />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={estado} onValueChange={(v) => setEstado(v as EstadoVigencia | "todos")}>
          <TabsList>
            {ESTADOS.map((e) => (
              <TabsTrigger key={e.value} value={e.value} className="gap-1.5">
                {e.value !== "todos" && <SignDot estado={e.value} />}
                {e.label}
                <span className="text-muted-foreground">({conteos[e.value === "todos" ? "todos" : e.value] ?? 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, RUN o cargo…"
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
              <SortableHead label="Trabajador" columna="trabajador" orden={orden} onSort={onSort} />
              <SortableHead label="RUN" columna="run" orden={orden} onSort={onSort} />
              <SortableHead label="Cargo" columna="cargo" orden={orden} onSort={onSort} />
              <SortableHead label="Modalidad" columna="modalidad" orden={orden} onSort={onSort} />
              <TableHead>Edad</TableHead>
              <SortableHead label="Vence" columna="vence" orden={orden} onSort={onSort} />
              <SortableHead label="Estado" columna="estado" orden={orden} onSort={onSort} />
              <TableHead>Acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  No hay trabajadores que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((f) => (
              <TableRow key={f.persona_run}>
                <TableCell className="font-medium">
                  {f.nombres} {f.apellido_paterno} {f.apellido_materno}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {f.run}-{f.dv}
                </TableCell>
                <TableCell className="text-muted-foreground">{f.cargo ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {f.modalidad_contractual?.replace(/_/g, " ") ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{calcularEdad(f.fechaNacimiento) ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">{f.vigencia_hasta ?? "—"}</TableCell>
                <TableCell>
                  <SignBadge estado={(f.estado_vigencia ?? "sin_capacitacion") as EstadoVigencia} size="sm" />
                </TableCell>
                <TableCell>
                  {f.usuarioId ? (
                    <span className="text-xs text-clear">Con acceso</span>
                  ) : puedeGestionar && f.persona_run && f.organizacion_id ? (
                    <DarAccesoDialog
                      personaRun={f.persona_run}
                      organizacionId={f.organizacion_id}
                      emailSugerido={f.personaEmail ?? ""}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin acceso</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NuevoTrabajadorDialog({
  organizaciones,
  cargos,
}: {
  organizaciones: { id: string; razon_social: string }[];
  cargos: Cargo[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    organizacionId: organizaciones[0]?.id ?? "",
    run: "",
    dv: "",
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    cargoId: "",
    unidad: "",
    modalidadContractual: "indefinido" as ModalidadContractual,
    email: "",
    fechaNacimiento: "",
  });

  const cargosDeLaOrg = cargos.filter((c) => c.organizacion_id === form.organizacionId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organizacionId) {
      toast.error("Selecciona una organización.");
      return;
    }
    startTransition(async () => {
      const resultado = await crearTrabajador({
        organizacionId: form.organizacionId,
        centroTrabajoId: null,
        run: form.run.replace(/\./g, "").trim(),
        dv: form.dv.trim().toUpperCase(),
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim() || null,
        cargoId: form.cargoId || null,
        unidad: form.unidad.trim() || null,
        modalidadContractual: form.modalidadContractual,
        email: form.email.trim() || null,
        fechaNacimiento: form.fechaNacimiento || null,
      });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }

      toast.success("Trabajador agregado a la matriz.");
      setOpen(false);
      setForm((f) => ({
        ...f,
        run: "",
        dv: "",
        nombres: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        cargoId: "",
        email: "",
        fechaNacimiento: "",
      }));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo trabajador
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar trabajador a la matriz</DialogTitle>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="run">RUN</Label>
              <Input
                id="run"
                required
                value={form.run}
                onChange={(e) => setForm((f) => ({ ...f, run: formatearRunInput(e.target.value) }))}
                placeholder="12.345.678"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dv">DV</Label>
              <Input id="dv" required maxLength={1} value={form.dv} onChange={(e) => setForm((f) => ({ ...f, dv: e.target.value }))} placeholder="K" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombres">Nombres</Label>
            <Input id="nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidoPaterno">Apellido paterno</Label>
              <Input id="apellidoPaterno" required value={form.apellidoPaterno} onChange={(e) => setForm((f) => ({ ...f, apellidoPaterno: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidoMaterno">Apellido materno</Label>
              <Input id="apellidoMaterno" value={form.apellidoMaterno} onChange={(e) => setForm((f) => ({ ...f, apellidoMaterno: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Cargo</Label>
              <Select
                items={Object.fromEntries(cargosDeLaOrg.map((c) => [c.id, c.nombre]))}
                value={form.cargoId}
                onValueChange={(v) => setForm((f) => ({ ...f, cargoId: v ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargosDeLaOrg.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cargosDeLaOrg.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay cargos registrados para esta organización — agrégalos en el módulo Cargos.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Modalidad contractual</Label>
              <Select
                items={Object.fromEntries(MODALIDADES.map((m) => [m.value, m.label]))}
                value={form.modalidadContractual}
                onValueChange={(v) => setForm((f) => ({ ...f, modalidadContractual: (v ?? "indefinido") as ModalidadContractual }))}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo (opcional)</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
              <Input
                id="fechaNacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar trabajador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DarAccesoDialog({
  personaRun,
  organizacionId,
  emailSugerido,
}: {
  personaRun: string;
  organizacionId: string;
  emailSugerido: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(emailSugerido);
  const [resultado, setResultado] = useState<{ emailEnviado: boolean; password?: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearAccesoTrabajador({ personaRun, organizacionId, email: email.trim() });
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      if (res.emailEnviado) {
        toast.success(`Enviamos las credenciales a ${email.trim()}.`);
        setOpen(false);
      } else {
        setResultado({ emailEnviado: false, password: res.passwordTemporal });
      }
    });
  }

  function cerrarYLimpiar() {
    setOpen(false);
    setResultado(null);
    setCopiado(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cerrarYLimpiar())}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <KeyRound className="size-3.5" />
        Dar acceso
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {resultado ? (
          <>
            <DialogHeader>
              <DialogTitle>Acceso creado — correo no enviado</DialogTitle>
              <DialogDescription>
                No se pudo enviar el correo de bienvenida. Comparte esta contraseña temporal de forma segura — no
                volverá a mostrarse.
              </DialogDescription>
            </DialogHeader>
            {resultado.password && (
              <div className="border border-border bg-muted p-4 font-mono text-sm flex items-center justify-between gap-2">
                <span>{resultado.password}</span>
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
            )}
            <DialogFooter>
              <Button onClick={cerrarYLimpiar}>Listo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Dar acceso a la app</DialogTitle>
              <DialogDescription>
                Se creará una cuenta de acceso para que pueda ver su propia capacitación, usando su RUT ya
                registrado en esta matriz.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emailAcceso">Correo</Label>
                <Input
                  id="emailAcceso"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando…" : "Dar acceso"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
