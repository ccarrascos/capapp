import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { CuentaSuspendida } from "@/components/app-shell/cuenta-suspendida";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();

  if (!sesion) {
    redirect("/login");
  }

  if (!sesion.esSuperAdmin && sesion.roles.length === 0) {
    return <CuentaSuspendida />;
  }

  const rolesUsuario = sesion.roles.map((r) => r.rol);
  const rolConOrganizacion = sesion.roles.find((r) => r.organizacionNombre);
  const organizacionActual = rolConOrganizacion?.organizacionNombre ?? null;

  let organizacionLogoUrl: string | null = null;
  if (rolConOrganizacion?.organizacionId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizaciones")
      .select("logo_url")
      .eq("id", rolConOrganizacion.organizacionId)
      .maybeSingle();
    organizacionLogoUrl = data?.logo_url ?? null;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar rolesUsuario={rolesUsuario} esSuperAdmin={sesion.esSuperAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          nombres={sesion.nombres}
          apellidos={sesion.apellidos}
          rolPrincipal={sesion.rolPrincipal}
          organizacionActual={sesion.esSuperAdmin ? "Todas las organizaciones" : organizacionActual}
          organizacionLogoUrl={sesion.esSuperAdmin ? null : organizacionLogoUrl}
          rolesUsuario={rolesUsuario}
          esSuperAdmin={sesion.esSuperAdmin}
          avatarUrl={sesion.avatarUrl}
        />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
