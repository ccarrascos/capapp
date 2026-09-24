"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal, calcularExpiracionPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import { registrarAuditoria } from "@/lib/auditoria";
import type { RolNombre } from "@/lib/auth";

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

export async function iniciarSesionConRut(input: { run: string; dv: string; password: string }) {
  const admin = createAdminClient();

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, email, activo, password_temporal_expira_en")
    .eq("run", input.run)
    .eq("dv", input.dv)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    return { ok: false as const, mensaje: "RUT o contraseña incorrectos." };
  }

  const expirada =
    usuario.password_temporal_expira_en !== null &&
    new Date(usuario.password_temporal_expira_en).getTime() < Date.now();

  if (expirada) {
    return {
      ok: false as const,
      expirada: true as const,
      mensaje: "Tu contraseña temporal caducó. Solicita un nuevo acceso más abajo.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usuario.email,
    password: input.password,
  });

  if (error) {
    return { ok: false as const, mensaje: "RUT o contraseña incorrectos." };
  }

  if (usuario.password_temporal_expira_en !== null) {
    await admin.from("usuarios").update({ password_temporal_expira_en: null }).eq("id", usuario.id);
  }

  return { ok: true as const };
}

const MENSAJE_RECUPERACION = "Si el RUT está registrado y activo, enviamos un nuevo acceso al correo asociado.";

export async function solicitarNuevoAcceso(input: { run: string; dv: string }) {
  const run = input.run.trim();
  const dv = input.dv.trim().toUpperCase();

  // No se revela si el RUT existe o no: siempre se responde el mismo
  // mensaje genérico, para no convertir este formulario en una forma de
  // comprobar qué RUT tiene cuenta en Capapp.
  if (!esRutValido(run, dv)) {
    return { ok: true as const, mensaje: MENSAJE_RECUPERACION };
  }

  const admin = createAdminClient();

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, nombres, email, activo")
    .eq("run", run)
    .eq("dv", dv)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    return { ok: true as const, mensaje: MENSAJE_RECUPERACION };
  }

  const { data: rolFila } = await admin
    .from("usuario_roles")
    .select("roles(nombre)")
    .eq("usuario_id", usuario.id)
    .limit(1)
    .maybeSingle();

  const rol = (rolFila?.roles?.nombre ?? "trabajador") as RolNombre;

  const passwordTemporal = generarPasswordTemporal();
  const expiraEn = calcularExpiracionPasswordTemporal();

  const { error: errorAuth } = await admin.auth.admin.updateUserById(usuario.id, {
    password: passwordTemporal,
  });

  if (errorAuth) {
    return { ok: true as const, mensaje: MENSAJE_RECUPERACION };
  }

  await admin
    .from("usuarios")
    .update({ password_temporal_expira_en: expiraEn.toISOString() })
    .eq("id", usuario.id);

  const correo = await enviarCorreoBienvenida({
    nombres: usuario.nombres,
    email: usuario.email,
    password: passwordTemporal,
    rolLabel: ROL_LABEL[rol],
    rut: `${run}-${dv}`,
    expiraEn,
    motivo: "nuevo_acceso",
  });

  // No se distingue de cara al usuario si el correo salió o no (para no
  // revelar qué RUT existe), pero queda en el log de auditoría — si no,
  // un envío rechazado por el proveedor de correo (ej. dominio no
  // verificado) queda invisible y parece que "sí se envió".
  await registrarAuditoria(admin, {
    usuarioId: usuario.id,
    accion: correo.ok ? "solicitar_nuevo_acceso" : "solicitar_nuevo_acceso_correo_fallido",
    tabla: "usuarios",
    registroId: usuario.id,
    datosNuevos: correo.ok ? undefined : { email: usuario.email, error: correo.mensaje },
  });

  return { ok: true as const, mensaje: MENSAJE_RECUPERACION };
}
