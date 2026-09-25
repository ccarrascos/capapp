"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { enviarMensaje, type MensajeChat } from "./actions";

const SUGERENCIAS = [
  "¿Cuántos trabajadores están vencidos?",
  "¿Qué trabajadores vencen pronto?",
  "¿Cuántos trabajadores hay por centro?",
  "Dame la distribución por sexo y edad",
];

export function IaView() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  function enviar(pregunta: string) {
    const preguntaLimpia = pregunta.trim();
    if (!preguntaLimpia || pending) return;

    const nuevoHistorial: MensajeChat[] = [...mensajes, { role: "user", content: preguntaLimpia }];
    setMensajes(nuevoHistorial);
    setTexto("");

    startTransition(async () => {
      const resultado = await enviarMensaje(nuevoHistorial);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        setMensajes((prev) => prev.slice(0, -1));
        return;
      }
      setMensajes((prev) => [...prev, { role: "assistant", content: resultado.respuesta }]);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    enviar(texto);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(texto);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl h-[calc(100vh-8rem)]">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Prueba de concepto · respuestas basadas en tus datos actuales
        </p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Asistente IA</h1>
      </div>

      <div className="flex-1 border border-border bg-card overflow-y-auto flex flex-col">
        {mensajes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Pregunta en lenguaje natural sobre la matriz de cumplimiento - el asistente consulta tus datos y
              responde. No inventa cifras: si no puede saberlo, lo dice.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {mensajes.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.role === "user" ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
                </span>
                <p
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {pending && (
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="hazard-stripe-cargando h-2 w-16 rounded-full mt-2.5" role="status" aria-label="Pensando" />
              </div>
            )}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta… (Shift+Enter para bajar de línea)"
          disabled={pending}
          autoFocus
          rows={1}
          className="h-8 max-h-40 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
        />
        <Button type="submit" disabled={pending || !texto.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
