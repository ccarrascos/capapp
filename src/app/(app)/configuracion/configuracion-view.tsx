"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClaveConfiguracion } from "@/lib/configuracion";
import {
  CAMPOS_CONFIGURACION,
  GRUPOS_CONFIGURACION,
  type CampoConfiguracion,
} from "@/lib/configuracion-campos";
import { actualizarConfiguracion } from "./actions";

export type ValorActual = {
  valor: number;
  porDefecto: number;
  actualizadoEn: string | null;
};

export function ConfiguracionView({ valores }: { valores: Record<ClaveConfiguracion, ValorActual> }) {
  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Alcance super administrador</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Parámetros que aplican a toda la plataforma. Cada cambio queda registrado en Auditoría y puede tardar
          hasta 30 segundos en reflejarse en todas las pantallas.
        </p>
      </div>

      {GRUPOS_CONFIGURACION.map((grupo) => (
        <section key={grupo.id} className="border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide">{grupo.titulo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{grupo.descripcion}</p>
          </div>
          <div className="divide-y divide-border">
            {CAMPOS_CONFIGURACION.filter((c) => c.grupo === grupo.id).map((campo) => (
              <CampoFila key={campo.clave} campo={campo} actual={valores[campo.clave]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CampoFila({ campo, actual }: { campo: CampoConfiguracion; actual: ValorActual }) {
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(actual.valor);
  const [texto, setTexto] = useState(String(actual.valor));

  const numero = Number(texto);
  const valido = texto.trim() !== "" && Number.isInteger(numero) && numero >= campo.min && numero <= campo.max;
  const cambiado = valido && numero !== guardado;
  const idInput = `cfg-${campo.clave}`;

  function guardar(valor: number) {
    startTransition(async () => {
      const resultado = await actualizarConfiguracion({ clave: campo.clave, valor });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setGuardado(valor);
      setTexto(String(valor));
      toast.success(`${campo.etiqueta}: ${valor} ${campo.unidad}.`);
    });
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <Label htmlFor={idInput} className="text-sm font-medium">
          {campo.etiqueta}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">{campo.ayuda}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Por defecto: {actual.porDefecto} {campo.unidad} · Rango {campo.min}–{campo.max}
        </p>
      </div>
      <form
        className="flex items-center gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (cambiado) guardar(numero);
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            id={idInput}
            type="number"
            inputMode="numeric"
            min={campo.min}
            max={campo.max}
            step={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-invalid={!valido}
            className="w-24 font-mono"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground w-14">{campo.unidad}</span>
        </div>
        <Button type="submit" size="sm" disabled={!cambiado || pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Restablecer valor por defecto"
          aria-label="Restablecer valor por defecto"
          disabled={pending || guardado === actual.porDefecto}
          onClick={() => guardar(actual.porDefecto)}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
