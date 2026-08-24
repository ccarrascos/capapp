"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  KeyRound,
  Copy,
  Check,
  QrCode,
  Printer,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
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
import {
  crearTrabajador,
  crearAccesoTrabajador,
  actualizarTrabajador,
  obtenerDetalleTrabajador,
  obtenerCredencialQr,
} from "./actions";
import { formatearRunInput, esRutValido } from "@/lib/rut";
import { esFechaNacimientoValida } from "@/lib/fecha-nacimiento";
import { estadoVigenciaDeCurso, peorEstadoVigencia, ultimoAprobadoPorCurso } from "@/lib/vigencia";
import { coincideBusqueda } from "@/lib/busqueda";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type FilaMatriz = Database["public"]["Views"]["matriz_vigencia_capacitacion"]["Row"] & {
  usuarioId: string | null;
  personaEmail: string | null;
  fechaNacimiento: string | null;
  centroNombre: string | null;
};
type ModalidadContractual = Database["public"]["Enums"]["modalidad_contractual"];

const FECHA_MAXIMA_NACIMIENTO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

function textoBuscable(f: FilaMatriz): string {
  return [
    f.nombres,
    f.apellido_paterno,
    f.apellido_materno,
    f.run,
    f.dv,
    f.cargo,
    f.centroNombre,
    f.unidad,
    f.modalidad_contractual?.replace(/_/g, " "),
    f.estado_vigencia?.replace(/_/g, " "),
    f.vigencia_hasta,
    f.tipo_vinculo,
    f.subcontrato_nombre,
    f.personaEmail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type ColumnaOrdenable =
  | "trabajador"
  | "run"
  | "cargo"
  | "centro"
  | "vinculo"
  | "modalidad"
  | "edad"
  | "vence"
  | "estado";
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
    case "centro":
      return (f.centroNombre ?? "").toLowerCase();
    case "vinculo":
      return f.tipo_vinculo === "subcontrato" ? (f.subcontrato_nombre ?? "").toLowerCase() : "directo";
    case "modalidad":
      return (f.modalidad_contractual ?? "").toLowerCase();
    case "edad":
      return calcularEdad(f.fechaNacimiento) ?? "";
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

const ESTADO_INSCRIPCION_LABEL: Record<string, { label: string; className: string }> = {
  inscrito: { label: "Inscrito", className: "text-steel" },
  en_progreso: { label: "En progreso", className: "text-signal" },
  aprobado: { label: "Aprobado", className: "text-clear" },
  reprobado: { label: "Reprobado", className: "text-alert" },
  desertor: { label: "Desertor", className: "text-alert" },
};

const ESTADOS: { value: EstadoVigencia | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vigente", label: "Vigente" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "vencido", label: "Vencido" },
  { value: "sin_capacitacion", label: "Sin capacitación" },
];

const ESTADO_LABEL_POR_CODIGO = Object.fromEntries(
  ESTADOS.filter((e) => e.value !== "todos").map((e) => [e.value, e.label]),
) as Record<string, string>;

function csvEscapar(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function exportarCsv(filas: FilaMatriz[]) {
  const encabezados = [
    "Trabajador",
    "RUN",
    "Cargo",
    "Centro",
    "Modalidad",
    "Vínculo",
    "Subcontrato",
    "Edad",
    "Vence",
    "Estado",
    "Unidad",
    "Correo",
  ];

  const filasCsv = filas.map((f) => [
    `${f.nombres ?? ""} ${f.apellido_paterno ?? ""} ${f.apellido_materno ?? ""}`.replace(/\s+/g, " ").trim(),
    f.run && f.dv ? `${f.run}-${f.dv}` : "",
    f.cargo ?? "",
    f.centroNombre ?? "",
    f.modalidad_contractual ? (f.modalidad_contractual as string).replace(/_/g, " ") : "",
    f.tipo_vinculo === "subcontrato" ? "Subcontrato" : "Directo",
    f.subcontrato_nombre ?? "",
    calcularEdad(f.fechaNacimiento)?.toString() ?? "",
    f.vigencia_hasta ?? "",
    ESTADO_LABEL_POR_CODIGO[f.estado_vigencia ?? ""] ?? "",
    f.unidad ?? "",
    f.personaEmail ?? "",
  ]);

  const lineas = [encabezados, ...filasCsv].map((fila) => fila.map((v) => csvEscapar(String(v))).join(";"));
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + lineas.join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `matriz-vigencia-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MODALIDADES: { value: ModalidadContractual; label: string }[] = [
  { value: "indefinido", label: "Indefinido" },
  { value: "plazo_fijo", label: "Plazo fijo" },
  { value: "obra_o_faena", label: "Obra o faena" },
  { value: "aprendiz", label: "Aprendiz" },
  { value: "honorarios", label: "Honorarios" },
  { value: "otro", label: "Otro" },
];

type Cargo = { id: string; nombre: string; organizacion_id: string };
type Centro = { id: string; nombre: string; organizacion_id: string };
type Subcontrato = { id: string; nombre: string; organizacion_id: string; centroIds: string[] };
type TipoVinculoLaboral = Database["public"]["Enums"]["tipo_vinculo_laboral"];

const TIPO_VINCULO_LABEL: Record<TipoVinculoLaboral, string> = {
  directo: "Directo",
  subcontrato: "Subcontrato",
};

export function TrabajadoresView({
  filas,
  organizaciones,
  cargos,
  centros,
  subcontratos,
  puedeGestionar,
  puedeVerDetalle,
}: {
  filas: FilaMatriz[];
  organizaciones: { id: string; razon_social: string }[];
  cargos: Cargo[];
  centros: Centro[];
  subcontratos: Subcontrato[];
  puedeGestionar: boolean;
  puedeVerDetalle: boolean;
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
    const resultado = filas.filter((f) => {
      const coincideEstado = estado === "todos" || f.estado_vigencia === estado;
      if (!coincideEstado) return false;
      return coincideBusqueda(textoBuscable(f), busqueda);
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

  const { pagina, setPagina, tamano, setTamano, totalPaginas, paginaItems, totalItems } = usePaginacion(filtradas);

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportarCsv(filtradas)}>
            <FileSpreadsheet className="size-4" />
            Exportar a Excel
          </Button>
          {puedeVerDetalle && (
            <Button render={<Link href="/trabajadores/credenciales" />} nativeButton={false} variant="outline">
              <QrCode className="size-4" />
              Imprimir credenciales
            </Button>
          )}
          {puedeGestionar && (
            <NuevoTrabajadorDialog
              organizaciones={organizaciones}
              cargos={cargos}
              centros={centros}
              subcontratos={subcontratos}
            />
          )}
        </div>
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
            placeholder="Buscar por cualquier dato: nombre, RUN, cargo, centro, subcontrato…"
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
              <SortableHead label="Estado" columna="estado" orden={orden} onSort={onSort} />
              <SortableHead label="Vence" columna="vence" orden={orden} onSort={onSort} />
              <SortableHead label="RUN" columna="run" orden={orden} onSort={onSort} />
              <SortableHead label="Cargo" columna="cargo" orden={orden} onSort={onSort} />
              <SortableHead label="Centro" columna="centro" orden={orden} onSort={onSort} />
              <SortableHead label="Vínculo" columna="vinculo" orden={orden} onSort={onSort} />
              <SortableHead label="Modalidad" columna="modalidad" orden={orden} onSort={onSort} />
              <SortableHead label="Edad" columna="edad" orden={orden} onSort={onSort} />
              <TableHead>Acceso</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                  No hay trabajadores que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {paginaItems.map((f) => (
              <TableRow key={f.persona_run}>
                <TableCell className="font-medium">
                  {puedeVerDetalle && f.persona_run && f.organizacion_id ? (
                    <DetalleTrabajadorDialog
                      personaRun={f.persona_run}
                      organizacionId={f.organizacion_id}
                      nombreCompleto={`${f.nombres} ${f.apellido_paterno} ${f.apellido_materno ?? ""}`}
                    />
                  ) : (
                    <>
                      {f.nombres} {f.apellido_paterno} {f.apellido_materno}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <SignBadge estado={(f.estado_vigencia ?? "sin_capacitacion") as EstadoVigencia} size="sm" />
                </TableCell>
                <TableCell className="font-mono text-sm">{f.vigencia_hasta ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">
                  {f.run}-{f.dv}
                </TableCell>
                <TableCell className="text-muted-foreground">{f.cargo ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{f.centroNombre ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {f.tipo_vinculo === "subcontrato" ? (f.subcontrato_nombre ?? "Subcontrato") : "Directo"}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {f.modalidad_contractual?.replace(/_/g, " ") ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{calcularEdad(f.fechaNacimiento) ?? "—"}</TableCell>
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
                <TableCell>
                  <div className="flex items-center gap-1">
                    {puedeVerDetalle && f.persona_run && f.organizacion_id && (
                      <CredencialQrDialog
                        personaRun={f.persona_run}
                        organizacionId={f.organizacion_id}
                        nombreCompleto={`${f.nombres} ${f.apellido_paterno} ${f.apellido_materno ?? ""}`}
                        runDv={`${f.run}-${f.dv}`}
                      />
                    )}
                    {puedeGestionar && f.persona_run && f.organizacion_id && (
                      <EditarTrabajadorDialog fila={f} cargos={cargos} centros={centros} subcontratos={subcontratos} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalItems}
          tamano={tamano}
          onTamanoChange={setTamano}
          onPaginaChange={setPagina}
          etiqueta="trabajador"
        />
      </div>
    </div>
  );
}

function NuevoTrabajadorDialog({
  organizaciones,
  cargos,
  centros,
  subcontratos,
}: {
  organizaciones: { id: string; razon_social: string }[];
  cargos: Cargo[];
  centros: Centro[];
  subcontratos: Subcontrato[];
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
    centroTrabajoId: "",
    unidad: "",
    modalidadContractual: "indefinido" as ModalidadContractual,
    email: "",
    fechaNacimiento: "",
    tipoVinculo: "directo" as TipoVinculoLaboral,
    subcontratoId: "",
  });

  const cargosDeLaOrg = cargos.filter((c) => c.organizacion_id === form.organizacionId);
  const centrosDeLaOrg = centros.filter((c) => c.organizacion_id === form.organizacionId);
  const subcontratosDelCentro = subcontratos.filter(
    (s) => s.organizacion_id === form.organizacionId && s.centroIds.includes(form.centroTrabajoId),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organizacionId) {
      toast.error("Selecciona una organización.");
      return;
    }

    const run = form.run.replace(/\./g, "").trim();
    const dv = form.dv.trim().toUpperCase();
    if (!esRutValido(run, dv)) {
      toast.error("El RUT ingresado no es válido.");
      return;
    }

    if (form.fechaNacimiento && !esFechaNacimientoValida(form.fechaNacimiento)) {
      toast.error("La fecha de nacimiento no es válida: no puede ser hoy, futura, ni corresponder a un menor de edad.");
      return;
    }

    if (form.tipoVinculo === "subcontrato" && !form.subcontratoId) {
      toast.error("Selecciona el subcontrato.");
      return;
    }

    startTransition(async () => {
      const resultado = await crearTrabajador({
        organizacionId: form.organizacionId,
        centroTrabajoId: form.centroTrabajoId || null,
        run,
        dv,
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim() || null,
        cargoId: form.cargoId || null,
        unidad: form.unidad.trim() || null,
        modalidadContractual: form.modalidadContractual,
        email: form.email.trim() || null,
        fechaNacimiento: form.fechaNacimiento || null,
        tipoVinculo: form.tipoVinculo,
        subcontratoId: form.tipoVinculo === "subcontrato" ? form.subcontratoId : null,
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
        centroTrabajoId: "",
        email: "",
        fechaNacimiento: "",
        tipoVinculo: "directo",
        subcontratoId: "",
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
              <Label>Centro de trabajo</Label>
              <Select
                items={Object.fromEntries(centrosDeLaOrg.map((c) => [c.id, c.nombre]))}
                value={form.centroTrabajoId}
                onValueChange={(v) => setForm((f) => ({ ...f, centroTrabajoId: v ?? "", subcontratoId: "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {centrosDeLaOrg.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {centrosDeLaOrg.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay centros registrados para esta organización — agrégalos en el módulo Centros de trabajo.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unidad">Unidad (opcional)</Label>
              <Input id="unidad" value={form.unidad} onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de vínculo</Label>
              <Select
                items={TIPO_VINCULO_LABEL}
                value={form.tipoVinculo}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    tipoVinculo: (v ?? "directo") as TipoVinculoLaboral,
                    subcontratoId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_VINCULO_LABEL) as TipoVinculoLaboral[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_VINCULO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.tipoVinculo === "subcontrato" && (
              <div className="flex flex-col gap-1.5">
                <Label>Subcontrato</Label>
                <Select
                  items={Object.fromEntries(subcontratosDelCentro.map((s) => [s.id, s.nombre]))}
                  value={form.subcontratoId}
                  onValueChange={(v) => setForm((f) => ({ ...f, subcontratoId: v ?? "" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un subcontrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcontratosDelCentro.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcontratosDelCentro.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {form.centroTrabajoId
                      ? "Ningún subcontrato está asignado a este centro — agrégalo en el módulo Subcontratos."
                      : "Primero selecciona el centro de trabajo."}
                  </p>
                )}
              </div>
            )}
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
                max={FECHA_MAXIMA_NACIMIENTO}
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

function EditarTrabajadorDialog({
  fila,
  cargos,
  centros,
  subcontratos,
}: {
  fila: FilaMatriz;
  cargos: Cargo[];
  centros: Centro[];
  subcontratos: Subcontrato[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const cargoActual = cargos.find((c) => c.organizacion_id === fila.organizacion_id && c.nombre === fila.cargo);
  const [form, setForm] = useState({
    nombres: fila.nombres ?? "",
    apellidoPaterno: fila.apellido_paterno ?? "",
    apellidoMaterno: fila.apellido_materno ?? "",
    email: fila.personaEmail ?? "",
    fechaNacimiento: fila.fechaNacimiento ?? "",
    cargoId: cargoActual?.id ?? "",
    centroTrabajoId: fila.centro_trabajo_id ?? "",
    unidad: fila.unidad ?? "",
    modalidadContractual: (fila.modalidad_contractual ?? "indefinido") as ModalidadContractual,
    tipoVinculo: (fila.tipo_vinculo ?? "directo") as TipoVinculoLaboral,
    subcontratoId: fila.subcontrato_id ?? "",
  });

  const cargosDeLaOrg = cargos.filter((c) => c.organizacion_id === fila.organizacion_id);
  const centrosDeLaOrg = centros.filter((c) => c.organizacion_id === fila.organizacion_id);
  const subcontratosDelCentro = subcontratos.filter(
    (s) => s.organizacion_id === fila.organizacion_id && s.centroIds.includes(form.centroTrabajoId),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.fechaNacimiento && !esFechaNacimientoValida(form.fechaNacimiento)) {
      toast.error("La fecha de nacimiento no es válida: no puede ser hoy, futura, ni corresponder a un menor de edad.");
      return;
    }

    if (form.tipoVinculo === "subcontrato" && !form.subcontratoId) {
      toast.error("Selecciona el subcontrato.");
      return;
    }

    startTransition(async () => {
      const resultado = await actualizarTrabajador({
        personaRun: fila.persona_run!,
        organizacionId: fila.organizacion_id!,
        nombres: form.nombres.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim() || null,
        email: form.email.trim() || null,
        fechaNacimiento: form.fechaNacimiento || null,
        cargoId: form.cargoId || null,
        centroTrabajoId: form.centroTrabajoId || null,
        unidad: form.unidad.trim() || null,
        modalidadContractual: form.modalidadContractual,
        tipoVinculo: form.tipoVinculo,
        subcontratoId: form.tipoVinculo === "subcontrato" ? form.subcontratoId : null,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Trabajador actualizado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar trabajador</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>RUN</Label>
            <Input value={`${fila.run}-${fila.dv}`} disabled className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombresEdit">Nombres</Label>
              <Input
                id="nombresEdit"
                required
                value={form.nombres}
                onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidoPaternoEdit">Apellido paterno</Label>
              <Input
                id="apellidoPaternoEdit"
                required
                value={form.apellidoPaterno}
                onChange={(e) => setForm((f) => ({ ...f, apellidoPaterno: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apellidoMaternoEdit">Apellido materno</Label>
              <Input
                id="apellidoMaternoEdit"
                value={form.apellidoMaterno}
                onChange={(e) => setForm((f) => ({ ...f, apellidoMaterno: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaNacimientoEdit">Fecha de nacimiento</Label>
              <Input
                id="fechaNacimientoEdit"
                type="date"
                max={FECHA_MAXIMA_NACIMIENTO}
                value={form.fechaNacimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
              />
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
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Modalidad contractual</Label>
              <Select
                items={Object.fromEntries(MODALIDADES.map((m) => [m.value, m.label]))}
                value={form.modalidadContractual}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, modalidadContractual: (v ?? "indefinido") as ModalidadContractual }))
                }
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
              <Label>Centro de trabajo</Label>
              <Select
                items={Object.fromEntries(centrosDeLaOrg.map((c) => [c.id, c.nombre]))}
                value={form.centroTrabajoId}
                onValueChange={(v) => setForm((f) => ({ ...f, centroTrabajoId: v ?? "", subcontratoId: "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {centrosDeLaOrg.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unidadEdit">Unidad</Label>
              <Input
                id="unidadEdit"
                value={form.unidad}
                onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de vínculo</Label>
              <Select
                items={TIPO_VINCULO_LABEL}
                value={form.tipoVinculo}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    tipoVinculo: (v ?? "directo") as TipoVinculoLaboral,
                    subcontratoId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_VINCULO_LABEL) as TipoVinculoLaboral[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_VINCULO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.tipoVinculo === "subcontrato" && (
              <div className="flex flex-col gap-1.5">
                <Label>Subcontrato</Label>
                <Select
                  items={Object.fromEntries(subcontratosDelCentro.map((s) => [s.id, s.nombre]))}
                  value={form.subcontratoId}
                  onValueChange={(v) => setForm((f) => ({ ...f, subcontratoId: v ?? "" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un subcontrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcontratosDelCentro.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcontratosDelCentro.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {form.centroTrabajoId
                      ? "Ningún subcontrato está asignado a este centro."
                      : "Primero selecciona el centro de trabajo."}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailEdit">Correo</Label>
            <Input
              id="emailEdit"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
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

type DetalleTrabajador = Extract<Awaited<ReturnType<typeof obtenerDetalleTrabajador>>, { ok: true }>;

function DetalleTrabajadorDialog({
  personaRun,
  organizacionId,
  nombreCompleto,
}: {
  personaRun: string;
  organizacionId: string;
  nombreCompleto: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [detalle, setDetalle] = useState<DetalleTrabajador | null>(null);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setDetalle(null);
      startTransition(async () => {
        const res = await obtenerDetalleTrabajador(personaRun, organizacionId);
        if (!res.ok) {
          toast.error(res.mensaje);
          setOpen(false);
          return;
        }
        setDetalle(res);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<button type="button" className="text-left hover:underline underline-offset-2" />}>
        {nombreCompleto}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{nombreCompleto}</DialogTitle>
          <DialogDescription>Vistazo rápido — capacitación, centros y evaluaciones.</DialogDescription>
        </DialogHeader>
        {pending || !detalle ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
        ) : (
          (() => {
            // Si el mismo curso se aprobó más de una vez (renovación), la
            // aprobación más reciente reemplaza a la anterior — sólo esa
            // cuenta para el estado y aparece en la lista.
            const aprobadosVigentes = ultimoAprobadoPorCurso(
              detalle.inscripciones
                .filter((i) => i.estado === "aprobado")
                .map((i) => ({
                  cursoId: i.ediciones_curso?.curso_id ?? i.id,
                  fechaAprobacion: i.fecha_aprobacion,
                  original: i,
                })),
            ).map((x) => x.original);
            // Agrupa todos los intentos (aprobados o no) por curso, para
            // poder mostrar cuántas veces lo ha tomado sin perder el
            // historial — pero la vigencia mostrada siempre sale de la
            // última aprobación de ese curso.
            const gruposPorCurso = new Map<
              string,
              { cursoNombre: string; intentos: typeof detalle.inscripciones }
            >();
            for (const i of detalle.inscripciones) {
              const cursoId = i.ediciones_curso?.curso_id ?? i.id;
              const grupo = gruposPorCurso.get(cursoId);
              if (grupo) grupo.intentos.push(i);
              else
                gruposPorCurso.set(cursoId, {
                  cursoNombre: i.ediciones_curso?.cursos?.nombre ?? "Curso",
                  intentos: [i],
                });
            }
            const grupos = [...gruposPorCurso.values()].map((g) => ({
              ...g,
              intentos: [...g.intentos].sort((a, b) =>
                (b.fecha_inscripcion ?? "").localeCompare(a.fecha_inscripcion ?? ""),
              ),
            }));

            return (
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Situación actual</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border border-border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <SignBadge
                    estado={peorEstadoVigencia(aprobadosVigentes.map((i) => estadoVigenciaDeCurso(i.vigencia_hasta)))}
                    size="sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RUT</p>
                  <p className="font-mono">
                    {detalle.persona.run}-{detalle.persona.dv}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p>{detalle.vinculo?.cargos?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Centro</p>
                  <p>{detalle.vinculo?.centros_trabajo?.nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modalidad</p>
                  <p className="capitalize">
                    {detalle.vinculo?.modalidad_contractual?.replace(/_/g, " ") ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vínculo</p>
                  <p>
                    {detalle.vinculo?.tipo_vinculo === "subcontrato"
                      ? `Subcontrato - ${detalle.vinculo.subcontratos?.nombre ?? "—"}`
                      : "Directo"}
                  </p>
                </div>
                {detalle.vinculo?.fecha_ingreso && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ingreso</p>
                    <p className="font-mono">{detalle.vinculo.fecha_ingreso}</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Cursos y evaluaciones
              </h3>
              {grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin inscripciones registradas.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {grupos.map((g) => {
                    const aprobados = g.intentos.filter((i) => i.estado === "aprobado");
                    const ultimoAprobado =
                      aprobados.length > 0
                        ? aprobados.reduce((a, b) => ((b.fecha_aprobacion ?? "") > (a.fecha_aprobacion ?? "") ? b : a))
                        : null;
                    const estadoVigencia = ultimoAprobado ? estadoVigenciaDeCurso(ultimoAprobado.vigencia_hasta) : null;
                    return (
                      <div key={g.cursoNombre + g.intentos[0].id} className="border border-border p-3 text-sm flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            {g.cursoNombre}
                            {g.intentos.length > 1 && (
                              <span className="text-xs text-muted-foreground font-normal">
                                {" "}
                                · {g.intentos.length} ediciones tomadas
                              </span>
                            )}
                          </p>
                          {estadoVigencia && (
                            <span className="flex items-center gap-1.5 text-xs shrink-0">
                              <SignBadge estado={estadoVigencia} size="sm" />
                              {ultimoAprobado?.vigencia_hasta && (
                                <span className="text-muted-foreground">
                                  {estadoVigencia === "vencido" ? "el" : "hasta"} {ultimoAprobado.vigencia_hasta}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {g.intentos.map((i) => {
                            const nota = i.evaluaciones_resultado.find((e) => e.modulo_id === null);
                            const estadoInfo = ESTADO_INSCRIPCION_LABEL[i.estado] ?? {
                              label: i.estado,
                              className: "",
                            };
                            return (
                              <div
                                key={i.id}
                                className="flex items-center justify-between gap-3 text-xs border-l-2 border-border pl-2"
                              >
                                <span className="text-muted-foreground">
                                  {i.ediciones_curso?.fecha_inicio ?? "—"}
                                  {i.ediciones_curso?.fecha_termino ? ` – ${i.ediciones_curso.fecha_termino}` : ""}
                                  {i.ediciones_curso?.centros_trabajo?.nombre
                                    ? ` · ${i.ediciones_curso.centros_trabajo.nombre}`
                                    : ""}
                                </span>
                                <span className={cn("font-medium shrink-0", estadoInfo.className)}>
                                  {estadoInfo.label}
                                  {nota?.puntaje != null ? ` (${nota.puntaje})` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cambios de centro</h3>
              {detalle.historialCentro.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detalle.historialCentro.map((h, idx) => (
                    <div key={idx} className="border border-border p-3 text-sm flex flex-col gap-1.5">
                      <p className="font-mono text-xs text-muted-foreground">{h.cambiado_en.slice(0, 10)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">{h.centro_anterior?.nombre ?? "Sin centro"}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{h.centro_nuevo?.nombre ?? "Sin centro"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
            );
          })()
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredencialQrDialog({
  personaRun,
  organizacionId,
  nombreCompleto,
  runDv,
}: {
  personaRun: string;
  organizacionId: string;
  nombreCompleto: string;
  runDv: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [credencial, setCredencial] = useState<{ url: string; qrDataUrl: string } | null>(null);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setCredencial(null);
      startTransition(async () => {
        const res = await obtenerCredencialQr(personaRun, organizacionId);
        if (!res.ok) {
          toast.error(res.mensaje);
          setOpen(false);
          return;
        }
        setCredencial(res);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="icon" variant="ghost" title="Credencial QR" />}>
        <QrCode className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader className="no-print">
          <DialogTitle>Credencial QR</DialogTitle>
          <DialogDescription>
            Para imprimir en la credencial o el casco. Al escanearlo, cualquiera ve el estado de
            capacitación vigente — sin necesidad de iniciar sesión.
          </DialogDescription>
        </DialogHeader>
        {pending || !credencial ? (
          <p className="text-sm text-muted-foreground py-8 text-center no-print">Generando…</p>
        ) : (
          <>
            <div id="credencial-imprimible" className="flex flex-col items-center gap-2 py-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el servidor */}
              <img src={credencial.qrDataUrl} alt="Código QR de la credencial" className="size-40" />
              <p className="font-medium text-sm">{nombreCompleto}</p>
              <p className="font-mono text-xs text-muted-foreground">{runDv}</p>
            </div>
            <DialogFooter className="no-print">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                Imprimir etiqueta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #credencial-imprimible, #credencial-imprimible * { visibility: visible; }
          #credencial-imprimible { position: fixed; inset: 0; margin: auto; height: fit-content; }
        }
      `}</style>
    </Dialog>
  );
}
