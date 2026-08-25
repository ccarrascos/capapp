"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, TriangleAlert, CircleX, Check, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { obtenerNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "@/app/(app)/notificaciones/actions";

type Notificacion = {
  id: string;
  tipo: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
};

export function NotificacionesBell() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargado, setCargado] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    obtenerNotificaciones().then((r) => {
      if (r.ok) setNotificaciones(r.notificaciones);
      setCargado(true);
    });
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  function onMarcarLeida(id: string) {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)));
    startTransition(async () => {
      await marcarNotificacionLeida(id);
    });
  }

  function onMarcarTodas() {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
    startTransition(async () => {
      await marcarTodasLeidas();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative" title="Notificaciones" />}
      >
        <Bell className="size-5" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-alert text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notificaciones</p>
          {noLeidas > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={onMarcarTodas}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!cargado && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Cargando…</p>}
          {cargado && notificaciones.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones. Aquí verás avisos de vencimientos próximos.
            </p>
          )}
          {notificaciones.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2.5 border-b border-border px-3 py-2.5 last:border-0 ${n.leido ? "" : "bg-accent/40"}`}
            >
              {n.tipo === "vencido" ? (
                <CircleX className="size-4 text-alert mt-0.5 shrink-0" />
              ) : n.tipo === "nueva_inscripcion" ? (
                <GraduationCap className="size-4 text-signal mt-0.5 shrink-0" />
              ) : (
                <TriangleAlert className="size-4 text-hazard-foreground mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">{n.mensaje}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleDateString("es-CL")}
                </p>
              </div>
              {!n.leido && (
                <button
                  type="button"
                  title="Marcar como leída"
                  onClick={() => onMarcarLeida(n.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Check className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
