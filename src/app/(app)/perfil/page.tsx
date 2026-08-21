import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearRut } from "@/lib/rut";
import { PerfilView } from "./perfil-view";

const ROL_LABEL: Record<string, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

export default async function PerfilPage() {
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombres, apellidos, email, telefono, run, dv")
    .eq("id", sesion.usuarioId)
    .single();

  return (
    <PerfilView
      nombres={usuario?.nombres ?? sesion.nombres}
      apellidos={usuario?.apellidos ?? sesion.apellidos}
      email={usuario?.email ?? sesion.email}
      telefono={usuario?.telefono ?? ""}
      rut={usuario?.run && usuario?.dv ? formatearRut(usuario.run, usuario.dv) : null}
      avatarUrl={sesion.avatarUrl}
      roles={sesion.roles.map((r) => ({
        rol: ROL_LABEL[r.rol] ?? r.rol,
        organizacion: r.organizacionNombre,
      }))}
    />
  );
}
