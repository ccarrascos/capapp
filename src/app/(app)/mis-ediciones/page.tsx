import { createClient } from "@/lib/supabase/server";
import { MisEdicionesView } from "./mis-ediciones-view";

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

      <MisEdicionesView ediciones={ediciones ?? []} />
    </div>
  );
}
