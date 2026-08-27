import { cn } from "@/lib/utils";

/** Estado de carga/búsqueda — misma franja de peligro que el acento del sidebar y el login, en movimiento. */
export function HazardLoader({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-8", className)}>
      <div className="hazard-stripe-cargando h-2 w-28 rounded-full" role="status" aria-label={label ?? "Cargando"} />
      {label && <p className="text-sm text-muted-foreground text-center">{label}</p>}
    </div>
  );
}
