import { cn } from "@/lib/utils";

export type EstadoVigencia = "vigente" | "por_vencer" | "vencido" | "sin_capacitacion";

/**
 * Insignias de estado con la geometría real de la señalética ISO 7010:
 * círculo verde (obligatoria/segura), triángulo amarillo (advertencia),
 * círculo rojo con barra diagonal (prohibición/vencido), cuadrado acero
 * (informativo/sin dato). Es el lenguaje visual que recorre toda la app.
 */

function IconVigente({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" className="fill-clear stroke-clear" strokeWidth="1.5" />
      <path
        d="M7.5 12.5l2.8 2.8 6.2-6.6"
        stroke="var(--clear-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPorVencer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 2.5 22.5 21H1.5L12 2.5z"
        className="fill-hazard stroke-hazard"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect x="11.1" y="9.5" width="1.8" height="5.5" rx="0.9" fill="var(--hazard-foreground)" />
      <circle cx="12" cy="17.3" r="1.05" fill="var(--hazard-foreground)" />
    </svg>
  );
}

function IconVencido({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" className="fill-alert stroke-alert" strokeWidth="1.5" />
      <line
        x1="6.2"
        y1="17.8"
        x2="17.8"
        y2="6.2"
        stroke="var(--alert-foreground)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSinDato({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="3"
        className="fill-muted stroke-steel"
        strokeWidth="1.5"
      />
      <line
        x1="7.5"
        y1="12"
        x2="16.5"
        y2="12"
        stroke="var(--steel)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CONFIG: Record<
  EstadoVigencia,
  { label: string; Icon: typeof IconVigente; textClass: string }
> = {
  vigente: { label: "Vigente", Icon: IconVigente, textClass: "text-clear" },
  por_vencer: { label: "Por vencer", Icon: IconPorVencer, textClass: "text-hazard-foreground" },
  vencido: { label: "Vencido", Icon: IconVencido, textClass: "text-alert" },
  sin_capacitacion: { label: "Sin capacitación", Icon: IconSinDato, textClass: "text-steel" },
};

export function SignBadge({
  estado,
  className,
  size = "md",
}: {
  estado: EstadoVigencia;
  className?: string;
  size?: "sm" | "md";
}) {
  const { label, Icon, textClass } = CONFIG[estado];
  const iconSize = size === "sm" ? "size-4" : "size-5";

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", textClass, className)}>
      <Icon className={iconSize} />
      <span className={size === "sm" ? "text-xs" : "text-sm"}>{label}</span>
    </span>
  );
}

export function SignDot({ estado, className }: { estado: EstadoVigencia; className?: string }) {
  const { Icon } = CONFIG[estado];
  return <Icon className={cn("size-4 shrink-0", className)} />;
}
