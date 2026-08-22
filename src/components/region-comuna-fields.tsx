"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIONES_CHILE, COMUNAS_POR_REGION } from "@/lib/chile-geo";

/** Selector de región + comuna enlazados: la comuna se filtra según la región elegida. */
export function RegionComunaFields({
  region,
  comuna,
  onRegionChange,
  onComunaChange,
}: {
  region: string;
  comuna: string;
  onRegionChange: (region: string) => void;
  onComunaChange: (comuna: string) => void;
}) {
  const comunasDisponibles = region ? (COMUNAS_POR_REGION[region] ?? []) : [];

  function handleRegionChange(v: string | null) {
    const nuevaRegion = v ?? "";
    onRegionChange(nuevaRegion);
    const comunasDeNuevaRegion = nuevaRegion ? (COMUNAS_POR_REGION[nuevaRegion] ?? []) : [];
    if (!comunasDeNuevaRegion.includes(comuna)) {
      onComunaChange("");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Región</Label>
        <Select items={Object.fromEntries(REGIONES_CHILE.map((r) => [r, r]))} value={region} onValueChange={handleRegionChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una región" />
          </SelectTrigger>
          <SelectContent>
            {REGIONES_CHILE.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Comuna</Label>
        <Select
          items={Object.fromEntries(comunasDisponibles.map((c) => [c, c]))}
          value={comuna}
          onValueChange={(v) => onComunaChange(v ?? "")}
          disabled={!region}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={region ? "Selecciona una comuna" : "Elige región primero"} />
          </SelectTrigger>
          <SelectContent>
            {comunasDisponibles.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
