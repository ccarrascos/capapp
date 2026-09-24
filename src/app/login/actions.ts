"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal, calcularExpiracionPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/configuracion";
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

// Se registra por (run, dv) tal cual se recibe, exista o no la cuenta, y
// el mensaje de vuelta es siempre el mismo genérico de arriba — nunca uno
// distinto tipo "cuenta bloqueada", porque eso delataría que el RUT
// existe. Así el bloqueo por fuerza bruta no abre un canal de enumeración
// nuevo.
async function estaBloqueado(admin: SupabaseClient<Database>, run: string, dv: string) {
  const { data } = await admin.from("intentos_login").select("bloqueado_hasta").eq("run", run).eq("dv", dv).maybeSingle();
  return !!data?.bloqueado_hasta && new Date(data.bloqueado_hasta).getTime() > Date.now();
}

async function registrarIntentoFallido(admin: SupabaseClient<Database>, run: string, dv: string) {
  const { login_max_intentos, login_bloqueo_minutos } = await obtenerConfiguracion();
  const ventanaMs = login_bloqueo_minutos * 60 * 1000;
  const ahora = Date.now();

  // Retención mínima (Ley 21.719): los RUT de intentos fallidos sólo se
  // guardan mientras sirven para el bloqueo.
  await admin
    .from("intentos_login")
    .delete()
    .lt("ultimo_intento", new Date(ahora - 24 * 60 * 60 * 1000).toISOString());

  const { data: actual } = await admin
    .from("intentos_login")
    .select("intentos, ultimo_intento, bloqueado_hasta")
    .eq("run", run)
    .eq("dv", dv)
    .maybeSingle();
  // Fallos viejos o un bloqueo ya cumplido no deben seguir sumando.
  const vigente =
    actual &&
    new Date(actual.ultimo_intento).getTime() > ahora - ventanaMs &&
    !(actual.bloqueado_hasta && new Date(actual.bloqueado_hasta).getTime() <= ahora);
  const intentos = (vigente ? actual.intentos : 0) + 1;
  const bloqueadoHasta =
    intentos >= login_max_intentos ? new Date(ahora + ventanaMs).toISOString() : null;

  await admin
    .from("intentos_login")
    .upsert({ run, dv, intentos, ultimo_intento: new Date(ahora).toISOString(), bloqueado_hasta: bloqueadoHasta });
}

async function limpiarIntentos(admin: SupabaseClient<Database>, run: string, dv: string) {
  await admin.from("intentos_login").delete().eq("run", run).eq("dv", dv);
}

export async function iniciarSesionConRut(input: { run: string; dv: string; password: string }) {
  const admin = createAdminClient();

  if (await estaBloqueado(admin, input.run, input.dv)) {
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, email, activo, password_temporal_expira_en")
    .eq("run", input.run)
    .eq("dv", input.dv)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    await registrarIntentoFallido(admin, input.run, input.dv);
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  const expirada =
    usuario.password_temporal_expira_en !== null &&
    new Date(usuario.password_temporal_expira_en).getTime() < Date.now();

  if (expirada) {
    await registrarIntentoFallido(admin, input.run, input.dv);
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
    await registrarIntentoFallido(admin, input.run, input.dv);
    return { ok: false as const, mensaje: MENSAJE_CREDENCIALES_INCORRECTAS };
  }

  await limpiarIntentos(admin, input.run, input.dv);

  if (usuario.password_temporal_expira_en !== null) {
    await admin.from("usuarios").update({ password_temporal_expira_en: null }).eq("id", usuario.id);
  }

  return { ok: true as const };
}

const MENSAJE_RECUPERACION = "Si el RUT está registrado y activo, enviamos un nuevo acceso al correo asociado.";

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

  const config = await obtenerConfiguracion();

  if (usuario.password_temporal_expira_en) {
    const duracionActualMs = config.password_temporal_horas * 60 * 60 * 1000;
    const emitidaEn = new Date(usuario.password_temporal_expira_en).getTime() - duracionActualMs;
    if (Date.now() - emitidaEn < config.recuperacion_throttle_minutos * 60 * 1000) return;
  }

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
