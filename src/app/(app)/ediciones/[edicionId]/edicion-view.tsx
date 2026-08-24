"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, FileCheck2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  inscribirTrabajadores,
  registrarAsistenciaModulo,
  registrarEvaluacionFinal,
  emitirCertificado,
  marcarManualEntregado,
} from "../actions";
import { CertificadoDialog } from "../../certificados/certificado-dialog";
import { coincideBusqueda } from "@/lib/busqueda";
import { usePaginacion } from "@/lib/use-paginacion";
import { Paginacion } from "@/components/ui/paginacion";

type Persona = { run: string; dv: string; nombres: string; apellido_paterno: string };

type Inscripcion = {
  id: string;
  estado: string;
  fecha_inscripcion: string;
  fecha_aprobacion: string | null;
  vigencia_hasta: string | null;
  manual_entregado: boolean;
  manual_entregado_fecha: string | null;
  personas: Persona | null;
  asistencias_modulo: { modulo_id: string; presente: boolean }[];
  evaluaciones_resultado: { id: string; puntaje: number | null; aprobado: boolean; modulo_id: string | null }[];
  certificados: { id: string; numero_certificado: string } | null;
};

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  inscrito: { label: "Inscrito", className: "text-steel" },
  en_progreso: { label: "En progreso", className: "text-signal" },
  aprobado: { label: "Aprobado", className: "text-clear" },
  reprobado: { label: "Reprobado", className: "text-alert" },
  desertor: { label: "Desertor", className: "text-alert" },
};

export function EdicionView({
  edicionId,
  cursoId,
  modulos,
  inscripciones,
  disponibles,
  puedeInscribir,
  puedeGestionarAsistencia,
}: {
  edicionId: string;
  cursoId: string;
  modulos: { id: string; orden: number; nombre: string }[];
  inscripciones: Inscripcion[];
  disponibles: Persona[];
  puedeInscribir: boolean;
  puedeGestionarAsistencia: boolean;
}) {
  const { pagina, setPagina, tamano, setTamano, totalPaginas, paginaItems, totalItems } =
    usePaginacion(inscripciones);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
          Inscritos ({inscripciones.length})
        </h2>
        {puedeInscribir && <InscribirDialog edicionId={edicionId} disponibles={disponibles} />}
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>RUN</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vigente hasta</TableHead>
              <TableHead>Certificado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalItems === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Aún no hay trabajadores inscritos en esta edición.
                </TableCell>
              </TableRow>
            )}
            {paginaItems.map((i) => {
              const estado = ESTADO_LABEL[i.estado] ?? ESTADO_LABEL.inscrito;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    {i.personas ? `${i.personas.nombres} ${i.personas.apellido_paterno}` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {i.personas ? `${i.personas.run}-${i.personas.dv}` : "—"}
                  </TableCell>
                  <TableCell className={estado.className}>{estado.label}</TableCell>
                  <TableCell className="font-mono text-sm">{i.vigencia_hasta ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {i.certificados?.numero_certificado ?? "—"}
                  </TableCell>
                  <TableCell>
                    {puedeGestionarAsistencia && (
                      <GestionarSheet
                        edicionId={edicionId}
                        cursoId={cursoId}
                        modulos={modulos}
                        inscripcion={i}
                      />
                    )}
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
          etiqueta="inscrito"
        />
      </div>
    </div>
  );
}

function InscribirDialog({ edicionId, disponibles }: { edicionId: string; disponibles: Persona[] }) {
  const [open, setOpen] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit() {
    startTransition(async () => {
      const resultado = await inscribirTrabajadores(edicionId, [...seleccion]);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(`${seleccion.size} trabajador(es) inscrito(s).`);
      setSeleccion(new Set());
      setBusqueda("");
      setOpen(false);
    });
  }

  const disponiblesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return disponibles;
    return disponibles.filter((t) =>
      coincideBusqueda(`${t.nombres} ${t.apellido_paterno} ${t.run} ${t.dv}`, busqueda),
    );
  }, [disponibles, busqueda]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setBusqueda("");
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Inscribir trabajadores
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inscribir trabajadores</DialogTitle>
        </DialogHeader>
        {disponibles.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o RUN…"
              className="pl-8"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        )}
        <div className="max-h-80 overflow-y-auto border border-border divide-y divide-border">
          {disponibles.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No hay nadie para inscribir: ya están en esta edición o tienen este curso vigente.
            </p>
          )}
          {disponibles.length > 0 && disponiblesFiltrados.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Ningún trabajador coincide con &ldquo;{busqueda}&rdquo;.
            </p>
          )}
          {disponiblesFiltrados.map((t) => (
            <label key={t.run} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/40 cursor-pointer">
              <input type="checkbox" className="size-4" checked={seleccion.has(t.run)} onChange={() => toggle(t.run)} />
              <span className="flex-1">
                {t.nombres} {t.apellido_paterno}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {t.run}-{t.dv}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending || seleccion.size === 0}>
            {pending ? "Inscribiendo…" : `Inscribir ${seleccion.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GestionarSheet({
  edicionId,
  cursoId,
  modulos,
  inscripcion,
}: {
  edicionId: string;
  cursoId: string;
  modulos: { id: string; orden: number; nombre: string }[];
  inscripcion: Inscripcion;
}) {
  const [open, setOpen] = useState(false);
  const [pendingAsistencia, startAsistencia] = useTransition();
  const [pendingEval, startEval] = useTransition();
  const [pendingCert, startCert] = useTransition();
  const [pendingManual, startManual] = useTransition();
  const [puntaje, setPuntaje] = useState("70");

  const asistenciaPorModulo = new Map(inscripcion.asistencias_modulo.map((a) => [a.modulo_id, a.presente]));
  const evaluacionFinal = inscripcion.evaluaciones_resultado.find((e) => e.modulo_id === null);
  const yaAprobado = inscripcion.estado === "aprobado";
  const tieneCertificado = inscripcion.certificados !== null;

  function onToggleAsistencia(moduloId: string, presente: boolean) {
    startAsistencia(async () => {
      const resultado = await registrarAsistenciaModulo({
        inscripcionId: inscripcion.id,
        moduloId,
        edicionId,
        fecha: new Date().toISOString().slice(0, 10),
        presente,
      });
      if (!resultado.ok) toast.error(resultado.mensaje);
    });
  }

  function onMarcarTodaAsistencia() {
    startAsistencia(async () => {
      const fecha = new Date().toISOString().slice(0, 10);
      const resultados = await Promise.all(
        modulos.map((m) =>
          registrarAsistenciaModulo({
            inscripcionId: inscripcion.id,
            moduloId: m.id,
            edicionId,
            fecha,
            presente: true,
          }),
        ),
      );
      const conError = resultados.find((r) => !r.ok);
      if (conError && !conError.ok) toast.error(conError.mensaje);
    });
  }

  function onEvaluar(aprobado: boolean) {
    const puntajeNumerico = Number(puntaje);
    if (!Number.isInteger(puntajeNumerico) || puntajeNumerico < 0 || puntajeNumerico > 100) {
      toast.error("El puntaje debe ser un número entero entre 0 y 100.");
      return;
    }

    if (aprobado) {
      const asistenciaCompleta = modulos.every((m) => asistenciaPorModulo.get(m.id));
      if (!asistenciaCompleta) {
        toast.error("Debes registrar la asistencia de todos los módulos antes de aprobar.");
        return;
      }
      if (!inscripcion.manual_entregado) {
        toast.error("Debes registrar la entrega del manual del participante antes de aprobar.");
        return;
      }
    }

    startEval(async () => {
      const resultado = await registrarEvaluacionFinal({
        inscripcionId: inscripcion.id,
        edicionId,
        puntaje: puntajeNumerico,
        aprobado,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(aprobado ? "Trabajador aprobado. Vigencia calculada a 2 años." : "Registrado como reprobado.");
    });
  }

  function onToggleManualEntregado(entregado: boolean) {
    startManual(async () => {
      const resultado = await marcarManualEntregado({
        inscripcionId: inscripcion.id,
        edicionId,
        entregado,
      });
      if (!resultado.ok) toast.error(resultado.mensaje);
    });
  }

  function onEmitirCertificado() {
    if (!inscripcion.vigencia_hasta) return;
    startCert(async () => {
      const resultado = await emitirCertificado({
        inscripcionId: inscripcion.id,
        personaRun: inscripcion.personas!.run,
        cursoId,
        edicionId,
        vigenciaHasta: inscripcion.vigencia_hasta!,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Certificado emitido.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>Gestionar</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {inscripcion.personas?.nombres} {inscripcion.personas?.apellido_paterno}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                Asistencia por módulo
              </h3>
              <button
                type="button"
                disabled={pendingAsistencia}
                onClick={onMarcarTodaAsistencia}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                Marcar todo
              </button>
            </div>
            <div className="border border-border divide-y divide-border">
              {modulos.map((m) => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    disabled={pendingAsistencia}
                    checked={asistenciaPorModulo.get(m.id) ?? false}
                    onChange={(e) => onToggleAsistencia(m.id, e.target.checked)}
                  />
                  <span>
                    {m.orden}. {m.nombre}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Manual del participante
            </h3>
            <label className="flex items-center gap-3 px-3 py-2 text-sm border border-border">
              <input
                type="checkbox"
                className="size-4"
                disabled={pendingManual}
                checked={inscripcion.manual_entregado}
                onChange={(e) => onToggleManualEntregado(e.target.checked)}
              />
              <span>
                Entregado
                {inscripcion.manual_entregado_fecha ? ` el ${inscripcion.manual_entregado_fecha}` : ""}
              </span>
            </label>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Evaluación final
            </h3>
            {evaluacionFinal ? (
              <p className="text-sm text-muted-foreground">
                Puntaje registrado: <span className="font-mono text-foreground">{evaluacionFinal.puntaje}</span> ·{" "}
                {evaluacionFinal.aprobado ? "Aprobado" : "Reprobado"}
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="puntaje">Puntaje (0-100)</Label>
                  <Input
                    id="puntaje"
                    type="number"
                    min={0}
                    max={100}
                    value={puntaje}
                    onChange={(e) => setPuntaje(e.target.value)}
                  />
                </div>
                <Button size="sm" disabled={pendingEval} onClick={() => onEvaluar(true)}>
                  Aprobar
                </Button>
                <Button size="sm" variant="outline" disabled={pendingEval} onClick={() => onEvaluar(false)}>
                  Reprobar
                </Button>
              </div>
            )}
          </div>

          {yaAprobado && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Certificación
              </h3>
              {tieneCertificado ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm text-clear">
                    <FileCheck2 className="size-4" />
                    Certificado emitido: {inscripcion.certificados?.numero_certificado}
                  </p>
                  <CertificadoDialog
                    certificadoId={inscripcion.certificados!.id}
                    triggerClassName="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    Ver certificado
                  </CertificadoDialog>
                </div>
              ) : (
                <Button size="sm" disabled={pendingCert} onClick={onEmitirCertificado}>
                  {pendingCert ? "Emitiendo…" : "Emitir certificado"}
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
