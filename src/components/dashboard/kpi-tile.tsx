import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: "clear" | "hazard" | "alert" | "signal" | "steel";
}) {
  const accentClass = {
    clear: "text-clear",
    hazard: "text-hazard-foreground",
    alert: "text-alert",
    signal: "text-signal",
    steel: "text-steel",
  }[accent ?? "signal"];

  return (
    <div className="border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <p className={cn("font-heading text-5xl font-bold leading-none", accentClass)}>
        {value}
        {suffix && <span className="text-xl font-semibold ml-1 align-top">{suffix}</span>}
      </p>
    </div>
  );
}
