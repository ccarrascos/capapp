"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal, calcularExpiracionPasswordTemporal, DURACION_PASSWORD_TEMPORAL_MS } from "@/lib/password";
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

// Cuánto debe pasar entre dos solicitudes que sí llegan a emitir una
// clave nueva para la misma cuenta. Sin este límite, cualquiera que
// conozca un RUT válido podría invalidar el acceso de ese trabajador una
// y otra vez con solicitudes seguidas (cada una reemplaza la clave
// anterior), o agotar la cuota de envíos de Resend, sin necesitar saber
// nada más sobre la cuenta.
const VENTANA_MINIMA_ENTRE_SOLICITUDES_MS = 5 * 60 * 1000;

export async function solicitarNuevoAcceso(input: { run: string; dv: string }) {
  const run = input.run.trim();
  const dv = input.dv.trim().toUpperCase();

  // El trabajo real (buscar la cuenta, resetear la clave, enviar el
  // correo) se agenda para después de responder — nunca se espera acá.
  // Si se esperara, el tiempo de respuesta sería en sí mismo una forma de
  // distinguir un RUT que existe de uno que no (una solicitud a un RUT
  // inexistente termina de inmediato; una real hace varias llamadas a la
  // base y a Resend y tarda notoriamente más). Al responder siempre lo
  // mismo y de inmediato, no queda ningún canal — ni el contenido de la
  // respuesta ni cuánto demora — para comprobar qué RUT tiene cuenta.
  if (esRutValido(run, dv)) {
    after(() => procesarSolicitudNuevoAcceso(run, dv));
  }

  return { ok: true as const, mensaje: MENSAJE_RECUPERACION };
}

async function procesarSolicitudNuevoAcceso(run: string, dv: string) {
  const admin = createAdminClient();

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, nombres, email, activo, password_temporal_expira_en")
    .eq("run", run)
    .eq("dv", dv)
    .maybeSingle();

  if (!usuario || !usuario.activo) return;

  if (usuario.password_temporal_expira_en) {
    const emitidaEn = new Date(usuario.password_temporal_expira_en).getTime() - DURACION_PASSWORD_TEMPORAL_MS;
    if (Date.now() - emitidaEn < VENTANA_MINIMA_ENTRE_SOLICITUDES_MS) return;
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

  if (errorAuth) return;

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

  // Nadie ve esto de vuelta (ya se respondió el mensaje genérico antes de
  // llegar aquí), pero queda en el log de auditoría — si no, un envío
  // rechazado por el proveedor de correo (ej. dominio no verificado)
  // queda invisible y parece que "sí se envió".
  await registrarAuditoria(admin, {
    usuarioId: usuario.id,
    accion: correo.ok ? "solicitar_nuevo_acceso" : "solicitar_nuevo_acceso_correo_fallido",
    tabla: "usuarios",
    registroId: usuario.id,
    datosNuevos: correo.ok ? undefined : { email: usuario.email, error: correo.mensaje },
  });
}
