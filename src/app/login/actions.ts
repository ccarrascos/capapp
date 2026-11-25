"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal, calcularExpiracionPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { captchaValido } from "@/lib/captcha";
import type { RolNombre } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

const MENSAJE_CREDENCIALES_INCORRECTAS = "RUT o contraseña incorrectos.";

// Multiplicador del tope por IP respecto del tope por cuenta: una oficina
// detrás de un mismo NAT no debe bloquearse por unos pocos fallos, pero una
// sola IP tampoco puede probar claves contra muchos RUT distintos.
const FACTOR_TOPE_IP = 10;

async function huellaIp(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "desconocida";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

// Contador atómico en BD (app_consumir_intento, migración 0034): se consume
// el intento ANTES de verificar la clave, así una ráfaga paralela no puede
// pasar el chequeo antes de que se grabe el bloqueo. El mensaje de vuelta es
// siempre el genérico - nunca "cuenta bloqueada", que delataría que el RUT
// existe.
async function consumirIntento(
  admin: SupabaseClient<Database>,
  run: string,
  dv: string,
  max: number,
  ventanaMin: number,
) {
  const { data, error } = await admin.rpc("app_consumir_intento", {
    p_run: run,
    p_dv: dv,
    p_max: max,
    p_ventana_min: ventanaMin,
  });
  // Si el contador falla, se rechaza (falla cerrado).
  return !error && data === true;
}

async function limpiarIntentos(admin: SupabaseClient<Database>, run: string, dv: string) {
  await admin.from("intentos_login").delete().eq("run", run).eq("dv", dv);
}

export async function iniciarSesionConRut(input: { run: string; dv: string; password: string; captchaToken?: string }) {
  const run = typeof input?.run === "string" ? input.run.trim() : "";
  const dv = typeof input?.dv === "string" ? input.dv.trim().toUpperCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  // Entrada basura: se rechaza sin tocar la base (evita llenar
  // intentos_login con claves arbitrarias).
  if (!esRutValido(run, dv) || password.length === 0 || password.length > 128) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  if (!(await captchaValido(input.captchaToken))) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  const admin = createAdminClient();
  const { login_max_intentos, login_bloqueo_minutos } = await obtenerConfiguracion();

  const ipOk = await consumirIntento(
    admin,
    "ip",
    await huellaIp(),
    login_max_intentos * FACTOR_TOPE_IP,
    login_bloqueo_minutos,
  );
  const cuentaOk = await consumirIntento(admin, run, dv, login_max_intentos, login_bloqueo_minutos);
  if (!ipOk || !cuentaOk) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, email, activo, password_temporal_expira_en")
    .eq("run", run)
    .eq("dv", dv)
    .maybeSingle();

  // Cuenta inexistente, desactivada o con clave temporal caducada: misma
  // respuesta que una clave incorrecta (sin canal de enumeración).
  const expirada =
    !!usuario &&
    usuario.password_temporal_expira_en !== null &&
    new Date(usuario.password_temporal_expira_en).getTime() < Date.now();
  if (!usuario || !usuario.activo || expirada) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usuario.email,
    password,
  });

  if (error) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  await limpiarIntentos(admin, run, dv);

  if (usuario.password_temporal_expira_en !== null) {
    await admin.from("usuarios").update({ password_temporal_expira_en: null }).eq("id", usuario.id);
  }

  return { ok: true as const };
}

const MENSAJE_RECUPERACION = "Si el RUT está registrado y activo, enviamos un nuevo acceso al correo asociado.";

export async function solicitarNuevoAcceso(input: { run: string; dv: string; captchaToken?: string }) {
  const run = typeof input?.run === "string" ? input.run.trim() : "";
  const dv = typeof input?.dv === "string" ? input.dv.trim().toUpperCase() : "";

  // El trabajo real (buscar la cuenta, resetear la clave, enviar el
  // correo) se agenda para después de responder - nunca se espera acá.
  // Si se esperara, el tiempo de respuesta sería en sí mismo una forma de
  // distinguir un RUT que existe de uno que no. Al responder siempre lo
  // mismo y de inmediato, no queda ningún canal - ni el contenido de la
  // respuesta ni cuánto demora - para comprobar qué RUT tiene cuenta.
  if (esRutValido(run, dv) && (await captchaValido(input?.captchaToken))) {
    // Tope por IP (no depende del RUT, por lo que no filtra nada): 5 por ventana.
    const admin = createAdminClient();
    const { recuperacion_throttle_minutos } = await obtenerConfiguracion();
    const ipOk = await consumirIntento(admin, "rec-ip", await huellaIp(), 5, recuperacion_throttle_minutos);
    if (ipOk) after(() => procesarSolicitudNuevoAcceso(run, dv));
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

  const config = await obtenerConfiguracion();

  // Tope persistente por RUT, independiente de si la clave actual es temporal:
  // una solicitud por ventana (sin esto, quien conozca un RUT podría
  // invalidar la clave de esa persona una y otra vez).
  const permitido = await consumirIntento(admin, `rec:${run}`, dv, 1, config.recuperacion_throttle_minutos);
  if (!permitido) return;

  const { data: rolFila } = await admin
    .from("usuario_roles")
    .select("roles(nombre)")
    .eq("usuario_id", usuario.id)
    .limit(1)
    .maybeSingle();

  const rol = (rolFila?.roles?.nombre ?? "trabajador") as RolNombre;

  const passwordTemporal = generarPasswordTemporal();
  const expiraEn = await calcularExpiracionPasswordTemporal();

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
  // llegar aquí), pero queda en el log de auditoría - si no, un envío
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
