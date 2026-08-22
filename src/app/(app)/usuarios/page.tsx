import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsuariosView } from "./usuarios-view";

export default async function UsuariosPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const puedeAdministrar =
    sesion.esSuperAdmin || sesion.roles.some((r) => r.rol === "admin_organizacion");
  if (!puedeAdministrar) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: asignaciones }, { data: organizaciones }] = await Promise.all([
    supabase
      .from("usuario_roles")
      .select("id, organizacion_id, usuarios(id, nombres, apellidos, email, run, dv, activo), roles(nombre)")
      .order("id"),
    sesion.esSuperAdmin
      ? supabase.from("organizaciones").select("id, razon_social").order("razon_social")
      : Promise.resolve({
          data: [
            ...new Map(
              sesion.roles
                .filter((r) => r.rol === "admin_organizacion" && r.organizacionId)
                .map((r) => [r.organizacionId, { id: r.organizacionId!, razon_social: r.organizacionNombre! }]),
            ).values(),
          ],
        }),
  ]);

  return (
    <UsuariosView
      asignaciones={asignaciones ?? []}
      organizaciones={organizaciones ?? []}
      esSuperAdmin={sesion.esSuperAdmin}
      usuarioActualId={sesion.usuarioId}
    />
  );
}
