import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MisEdicionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: facilitador } = await supabase
    .from("facilitadores")
    .select("id")
    .eq("usuario_id", user!.id)
    .maybeSingle();

  const { data: ediciones } = facilitador
    ? await supabase
        .from("ediciones_curso")
        .select("id, fecha_inicio, fecha_limite, fecha_termino, estado, cursos(nombre)")
        .eq("facilitador_id", facilitador.id)
        .order("fecha_inicio", { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Facilitador</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
          Mis ediciones de curso
        </h1>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Límite (3 meses)</TableHead>
              <TableHead>Término</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(ediciones ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No tienes ediciones de curso asignadas todavía.
                </TableCell>
              </TableRow>
            )}
            {(ediciones ?? []).map((e) => (
              <TableRow key={e.id} className="cursor-pointer hover:bg-accent/40">
                <TableCell className="font-medium">
                  <Link href={`/ediciones/${e.id}`} className="block">
                    {e.cursos?.nombre}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">{e.fecha_inicio}</TableCell>
                <TableCell className="font-mono text-sm">{e.fecha_limite}</TableCell>
                <TableCell className="font-mono text-sm">{e.fecha_termino ?? "—"}</TableCell>
                <TableCell className="capitalize">{e.estado.replace(/_/g, " ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
