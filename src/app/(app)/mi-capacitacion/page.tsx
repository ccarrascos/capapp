import { createClient } from "@/lib/supabase/server";
import { SignBadge, type EstadoVigencia } from "@/components/status/sign-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        .select("id, estado, fecha_inscripcion, fecha_aprobacion, vigencia_hasta, ediciones_curso(cursos(nombre))")
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
        <div className="border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Inscripción</TableHead>
                <TableHead>Aprobación</TableHead>
                <TableHead>Vigente hasta</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(historial ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Sin inscripciones registradas.
                  </TableCell>
                </TableRow>
              )}
              {(historial ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">
                    {h.ediciones_curso?.cursos?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{h.fecha_inscripcion}</TableCell>
                  <TableCell className="font-mono text-sm">{h.fecha_aprobacion ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{h.vigencia_hasta ?? "—"}</TableCell>
                  <TableCell className="capitalize">{h.estado.replace(/_/g, " ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
