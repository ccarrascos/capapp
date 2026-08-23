import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignBadge, type EstadoVigencia } from "@/components/status/sign-badge";
import { cn } from "@/lib/utils";

const ESTADO_INSCRIPCION_LABEL: Record<string, { label: string; className: string }> = {
  inscrito: { label: "Inscrito", className: "text-steel" },
  en_progreso: { label: "En progreso", className: "text-signal" },
  aprobado: { label: "Aprobado", className: "text-clear" },
  reprobado: { label: "Reprobado", className: "text-alert" },
  desertor: { label: "Desertor", className: "text-alert" },
};

export default async function MiCapacitacionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: persona } = await supabase
    .from("personas")
    .select("run")
    .eq("usuario_id", user!.id)
    .maybeSingle();

  const { data: fila } = persona
    ? await supabase
        .from("matriz_vigencia_capacitacion")
        .select("*")
        .eq("persona_run", persona.run)
        .maybeSingle()
    : { data: null };

  const { data: historial } = persona
    ? await supabase
        .from("inscripciones")
        .select(
          "id, estado, fecha_inscripcion, fecha_aprobacion, vigencia_hasta, ediciones_curso(cursos(nombre)), certificados(id, numero_certificado)",
        )
        .eq("persona_run", persona.run)
        .order("fecha_inscripcion", { ascending: false })
    : { data: [] };

  const estado = (fila?.estado_vigencia ?? "sin_capacitacion") as EstadoVigencia;

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Portal del trabajador
        </p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
          Mi capacitación
        </h1>
      </div>

      <div className="border border-border bg-card p-8 flex flex-col items-center text-center gap-3">
        <SignBadge estado={estado} className="text-lg" />
        {fila?.vigencia_hasta ? (
          <p className="text-sm text-muted-foreground">
            Vigente hasta <span className="font-mono text-foreground">{fila.vigencia_hasta}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground max-w-sm">
            Aún no registras una capacitación aprobada del artículo 16 del DS N.º 44/2023.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide mb-3">
          Historial
        </h2>
        {(historial ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border bg-card p-8 text-center">
            Sin inscripciones registradas.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {(historial ?? []).map((h) => {
              const estadoInfo = ESTADO_INSCRIPCION_LABEL[h.estado] ?? { label: h.estado, className: "" };
              return (
                <div key={h.id} className="border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{h.ediciones_curso?.cursos?.nombre ?? "—"}</p>
                    <span className={cn("text-xs font-medium shrink-0", estadoInfo.className)}>
                      {estadoInfo.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                    <div>
                      <p className="text-muted-foreground">Inscripción</p>
                      <p className="font-mono">{h.fecha_inscripcion}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Aprobación</p>
                      <p className="font-mono">{h.fecha_aprobacion ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vigente hasta</p>
                      <p className="font-mono">{h.vigencia_hasta ?? "—"}</p>
                    </div>
                  </div>
                  {h.certificados && (
                    <Link
                      href={`/certificados/${h.certificados.id}`}
                      target="_blank"
                      className="flex items-center gap-1.5 text-primary hover:underline text-sm border-t border-border pt-3"
                    >
                      <FileCheck2 className="size-4" />
                      Ver certificado
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
