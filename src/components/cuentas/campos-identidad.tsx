"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcularDV, formatearRunInput } from "@/lib/rut";
import { buscarIdentidadPorRun, type IdentidadEncontrada } from "@/app/(app)/personas/actions";

export type Identidad = {
  /** RUN con puntos, sin DV (ej. "12.345.678"). */
  run: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
};

export const IDENTIDAD_VACIA: Identidad = { run: "", nombres: "", apellidoPaterno: "", apellidoMaterno: "" };

export function cuerpoRun(run: string): string {
  return run.replace(/\D/g, "");
}

export function dvDe(run: string): string {
  const cuerpo = cuerpoRun(run);
  return cuerpo ? calcularDV(cuerpo) : "";
}

export function apellidosJuntos(i: Identidad): string {
  return `${i.apellidoPaterno.trim()} ${i.apellidoMaterno.trim()}`.trim();
}

/**
 * Bloque de identidad común a los formularios de cuenta, matriz y
 * facilitador: RUN con DV calculado, nombres y apellidos por separado. Al
 * completar el RUN busca a la persona en toda la plataforma y, si existe,
 * completa y bloquea el nombre, para que un mismo RUT no quede con nombres
 * distintos según por dónde se registró.
 */
export function CamposIdentidad({
  valor,
  onChange,
  onEncontrada,
  fija = false,
  buscar = true,
  ocultarEstado = false,
}: {
  valor: Identidad;
  onChange: (identidad: Identidad) => void;
  onEncontrada?: (encontrada: IdentidadEncontrada | null) => void;
  /** Identidad ya conocida (ej. desde la matriz): nada se edita. */
  fija?: boolean;
  buscar?: boolean;
  /** Cuando el formulario ya muestra su propio aviso (ej. "ya está ingresado"). */
  ocultarEstado?: boolean;
}) {
  const [encontrada, setEncontrada] = useState<IdentidadEncontrada | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ultimaBusqueda = useRef("");
  const nombresBloqueados = fija || !!encontrada;
  const estiloBloqueado = nombresBloqueados ? "bg-muted text-muted-foreground cursor-not-allowed" : undefined;
  const dv = dvDe(valor.run);

  async function buscarSiCorresponde(run: string) {
    const cuerpo = cuerpoRun(run);
    if (!buscar || fija || cuerpo.length < 7 || cuerpo === ultimaBusqueda.current) return;
    ultimaBusqueda.current = cuerpo;
    setBuscando(true);
    const resultado = await buscarIdentidadPorRun(cuerpo);
    setBuscando(false);
    if (cuerpoRun(run) !== cuerpo) return;
    setEncontrada(resultado);
    onEncontrada?.(resultado);
    if (resultado) {
      onChange({
        run,
        nombres: resultado.nombres,
        apellidoPaterno: resultado.apellidoPaterno,
        apellidoMaterno: resultado.apellidoMaterno,
      });
    }
  }

  function onRunChange(texto: string) {
    const run = formatearRunInput(texto);
    if (cuerpoRun(run) !== ultimaBusqueda.current && encontrada) {
      setEncontrada(null);
      onEncontrada?.(null);
      ultimaBusqueda.current = "";
      onChange({ ...IDENTIDAD_VACIA, run });
      return;
    }
    onChange({ ...valor, run });
  }

  const estado = encontrada ? descripcionEncontrada(encontrada) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="identidad-run">RUN</Label>
          <Input
            id="identidad-run"
            required
            readOnly={fija}
            value={valor.run}
            onChange={(e) => onRunChange(e.target.value)}
            onBlur={() => buscarSiCorresponde(valor.run)}
            placeholder="12.345.678"
            className={fija ? "font-mono bg-muted text-muted-foreground cursor-not-allowed" : "font-mono"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identidad-dv">DV</Label>
          <Input id="identidad-dv" disabled value={dv} placeholder="-" className="font-mono text-center" />
        </div>
      </div>
      {(buscando || (estado && !ocultarEstado)) && (
        <p className="text-xs text-muted-foreground -mt-2">{buscando ? "Buscando RUN…" : estado}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identidad-nombres">Nombres</Label>
        <Input
          id="identidad-nombres"
          className={estiloBloqueado}
          required
          readOnly={nombresBloqueados}
          value={valor.nombres}
          onChange={(e) => onChange({ ...valor, nombres: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identidad-paterno">Apellido paterno</Label>
          <Input
            id="identidad-paterno"
            className={estiloBloqueado}
            required
            readOnly={nombresBloqueados}
            value={valor.apellidoPaterno}
            onChange={(e) => onChange({ ...valor, apellidoPaterno: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identidad-materno">Apellido materno</Label>
          <Input
            id="identidad-materno"
            className={estiloBloqueado}
            readOnly={nombresBloqueados}
            value={valor.apellidoMaterno}
            onChange={(e) => onChange({ ...valor, apellidoMaterno: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function descripcionEncontrada(e: IdentidadEncontrada): string {
  const partes: string[] = [];
  if (e.enMatrizDe.length > 0) partes.push("en la matriz de vigencia");
  if (e.tieneCuenta) partes.push(e.roles.length > 0 ? `con cuenta (${e.roles.join(", ")})` : "con cuenta de acceso");
  if (e.facilitador) partes.push("como facilitador");
  const donde = partes.length > 0 ? `Ya registrado ${partes.join(", ")}.` : "Ya registrado en otra organización.";
  return `${donde} Nombre tomado de su registro; no se edita aquí.`;
}
