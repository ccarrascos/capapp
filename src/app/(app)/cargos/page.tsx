import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CargosView } from "./cargos-view";

export default async function CargosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: cargos }, { data: organizaciones }] = await Promise.all([
    supabase
      .from("cargos")
      .select("id, nombre, activo, organizacion_id, organizaciones(razon_social)")
      .order("nombre"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({
          data: [
            ...new Map(
              sesion.roles
                .filter((r) => r.organizacionId)
                .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
            ).values(),
          ],
        }),
  ]);

  return <CargosView cargos={cargos ?? []} organizaciones={organizaciones ?? []} />;
}
