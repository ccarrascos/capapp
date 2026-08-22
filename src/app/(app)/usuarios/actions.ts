"use server";

import { revalidatePath } from "next/cache";
import { getSesion, type RolNombre } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { esRutValido } from "@/lib/rut";
import { generarPasswordTemporal } from "@/lib/password";
import { normalizarEmail } from "@/lib/normalizar-email";

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

export type CrearUsuarioInput = {
  nombres: string;
  apellidos: string;
  email: string;
  run: string;
  dv: string;
  rol: RolNombre;
  organizacionId: string | null;
  centroTrabajoId: string | null;
};

export async function crearUsuario(input: CrearUsuarioInput) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    (input.rol !== "super_admin" &&
      input.organizacionId &&
      sesion.roles.some(
        (r) => r.rol === "admin_organizacion" && r.organizacionId === input.organizacionId,
      ));

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para crear esta cuenta." };
  }

  if (input.rol !== "super_admin" && !input.organizacionId) {
    return { ok: false as const, mensaje: "Selecciona una organización para este rol." };
  }

  if (input.rol === "trabajador") {
    return {
      ok: false as const,
      mensaje: "El acceso de un trabajador se otorga desde el módulo Trabajadores (botón «Dar acceso»), para que quede vinculado a su registro en la matriz de vigencia.",
    };
  }

  const run = input.run.trim();
  const dv = input.dv.trim().toUpperCase();
  const email = normalizarEmail(input.email);

  if (!esRutValido(run, dv)) {
    return { ok: false as const, mensaje: "El RUT ingresado no es válido." };
  }

  const admin = createAdminClient();

  const { data: rutExistente } = await admin.from("usuarios").select("id").eq("run", run).maybeSingle();
  if (rutExistente) {
    return { ok: false as const, mensaje: "Ya existe una cuenta con ese RUT." };
  }

  const passwordTemporal = generarPasswordTemporal();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorAuth || !creado.user) {
    return { ok: false as const, mensaje: errorAuth?.message ?? "No se pudo crear la cuenta." };
  }

  const supabase = await createClient();

  const { error: errorPerfil } = await admin.from("usuarios").insert({
    id: creado.user.id,
    nombres: input.nombres,
    apellidos: input.apellidos,
    email,
    run,
    dv,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorPerfil.message };
  }

  const { data: rolRow } = await supabase.from("roles").select("id").eq("nombre", input.rol).single();

  if (!rolRow) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: "Rol inválido." };
  }

  const { error: errorRol } = await admin.from("usuario_roles").insert({
    usuario_id: creado.user.id,
    rol_id: rolRow.id,
    organizacion_id: input.organizacionId,
    centro_trabajo_id: input.centroTrabajoId,
  });

  if (errorRol) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorRol.message };
  }

  revalidatePath("/usuarios");

  const correo = await enviarCorreoBienvenida({
    nombres: input.nombres,
    email,
    password: passwordTemporal,
    rolLabel: ROL_LABEL[input.rol],
    rut: `${run}-${dv}`,
  });

  if (!correo.ok) {
    // La cuenta ya existe; si el correo falla, entregamos la clave para respaldo manual.
    return { ok: true as const, emailEnviado: false as const, passwordTemporal, mensajeCorreo: correo.mensaje };
  }

  return { ok: true as const, emailEnviado: true as const };
}

export async function actualizarEstadoUsuario(input: {
  usuarioId: string;
  organizacionId: string | null;
  activo: boolean;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  if (input.usuarioId === sesion.usuarioId) {
    return { ok: false as const, mensaje: "No puedes desactivar tu propia cuenta desde aquí." };
  }

  const autorizado =
    sesion.esSuperAdmin ||
    (!!input.organizacionId &&
      sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === input.organizacionId));

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para modificar esta cuenta." };
  }

  // upd_usuarios_propio (RLS) sólo permite que cada quien edite su propio
  // perfil o que un super_admin edite cualquiera — un admin_organizacion no
  // puede tocar usuarios.activo de terceros con el cliente normal, así que
  // se usa el cliente admin, con la autorización ya validada arriba.
  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update({ activo: input.activo }).eq("id", input.usuarioId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/usuarios");
  return { ok: true as const };
}
