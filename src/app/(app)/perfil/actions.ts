"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createClienteEfimero } from "@supabase/supabase-js";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { mensajeDeError } from "@/lib/errores";
import { tipoImagenReal, EXTENSION_IMAGEN } from "@/lib/imagen";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export async function subirAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, mensaje: "No autenticado." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false as const, mensaje: "Selecciona una imagen." };
  }

  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return { ok: false as const, mensaje: "Formato no permitido. Usa JPG, PNG o WEBP." };
  }

  const { max_mb_avatar_usuario } = await obtenerConfiguracion();
  if (archivo.size > max_mb_avatar_usuario * 1024 * 1024) {
    return { ok: false as const, mensaje: `La imagen no puede superar los ${max_mb_avatar_usuario} MB.` };
  }

  const tipoReal = tipoImagenReal(new Uint8Array(await archivo.arrayBuffer()));
  if (!tipoReal) return { ok: false as const, mensaje: "El archivo no es una imagen válida." };

  const ruta = `${user.id}/avatar.${EXTENSION_IMAGEN[tipoReal]}`;

  const { error: errorSubida } = await supabase.storage.from("avatars").upload(ruta, archivo, {
    upsert: true,
    contentType: tipoReal,
  });

  if (errorSubida) return { ok: false as const, mensaje: mensajeDeError(errorSubida, "subirAvatar") };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(ruta);

  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: errorPerfil } = await supabase.from("usuarios").update({ avatar_url: avatarUrl }).eq("id", user.id);

  if (errorPerfil) return { ok: false as const, mensaje: mensajeDeError(errorPerfil, "subirAvatar.perfil") };

  revalidatePath("/", "layout");
  return { ok: true as const, avatarUrl };
}

export async function actualizarPerfil(input: { nombres: string; apellidos: string; telefono: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, mensaje: "No autenticado." };

  const { error } = await supabase
    .from("usuarios")
    .update({ nombres: input.nombres, apellidos: input.apellidos, telefono: input.telefono })
    .eq("id", user.id);

  if (error) return { ok: false as const, mensaje: mensajeDeError(error, "perfil.actions#1") };

  revalidatePath("/perfil");
  return { ok: true as const };
}

export async function exportarMisDatos() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, mensaje: "No autenticado." };

  const [{ data: usuario }, { data: roles }, { data: persona }] = await Promise.all([
    supabase.from("usuarios").select("nombres, apellidos, email, telefono, run, dv, created_at").eq("id", user.id).single(),
    supabase
      .from("usuario_roles")
      .select("organizacion_id, centro_trabajo_id, roles(nombre), organizaciones(razon_social)")
      .eq("usuario_id", user.id),
    supabase
      .from("personas")
      .select(
        "run, dv, nombres, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento, sexo, created_at",
      )
      .eq("usuario_id", user.id)
      .maybeSingle(),
  ]);

  // Derecho de acceso (Ley 21.719): todo lo que la plataforma guarda de la
  // persona. Se usa el cliente admin, acotado a su propio RUN, porque RLS no
  // le deja leer a un trabajador sus vínculos o su historial de centros.
  let vinculos: unknown = null;
  let capacitacion: unknown = null;
  let historialCentros: unknown = null;
  if (persona) {
    const admin = createAdminClient();
    const [{ data: v }, { data: c }, { data: h }] = await Promise.all([
      admin
        .from("vinculos_laborales")
        .select(
          "fecha_ingreso, activo, modalidad_contractual, unidad, tipo_vinculo, organizaciones(razon_social), cargos(nombre), centros_trabajo(nombre), subcontratos(nombre)",
        )
        .eq("persona_run", persona.run),
      admin
        .from("inscripciones")
        .select(
          "fecha_inscripcion, estado, fecha_aprobacion, vigencia_hasta, manual_entregado, ediciones_curso(fecha_inicio, fecha_limite, cursos(nombre)), asistencias_modulo(fecha, presente, tiempo_permanencia_min, modulos(nombre)), evaluaciones_resultado(fecha, puntaje, aprobado, intento_numero), certificados(numero_certificado, fecha_emision, fecha_vigencia_hasta)",
        )
        .eq("persona_run", persona.run),
      admin
        .from("historial_centro_trabajo")
        .select(
          "cambiado_en, centro_anterior:centros_trabajo!historial_centro_trabajo_centro_anterior_id_fkey(nombre), centro_nuevo:centros_trabajo!historial_centro_trabajo_centro_nuevo_id_fkey(nombre)",
        )
        .eq("persona_run", persona.run),
    ]);
    vinculos = v;
    capacitacion = c;
    historialCentros = h;
  }

  return {
    ok: true as const,
    datos: {
      exportado_en: new Date().toISOString(),
      cuenta: usuario,
      roles,
      identidad: persona,
      vinculos_laborales: vinculos,
      capacitacion,
      historial_centros: historialCentros,
    },
  };
}

export async function solicitarBajaCuenta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, mensaje: "No autenticado." };

  // Cliente admin: el trigger de la migración 0034 impide que el dueño
  // cambie `activo` por API directa (para que no pueda reactivarse). Darse
  // de baja sí es un derecho, así que se hace desde el servidor, siempre
  // sobre la cuenta de la sesión.
  const { error } = await createAdminClient().from("usuarios").update({ activo: false }).eq("id", user.id);

  if (error) return { ok: false as const, mensaje: mensajeDeError(error, "perfil.actions#2") };

  await supabase.auth.signOut();

  return { ok: true as const };
}

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 72; // bcrypt ignora lo que pase de 72 bytes

export async function cambiarPassword(input: { actual: string; nueva: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, mensaje: "No autenticado." };

  const actual = typeof input?.actual === "string" ? input.actual : "";
  const nueva = typeof input?.nueva === "string" ? input.nueva : "";
  if (nueva.length < PASSWORD_MIN || nueva.length > PASSWORD_MAX) {
    return { ok: false as const, mensaje: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.` };
  }
  if (nueva === actual) {
    return { ok: false as const, mensaje: "La nueva contraseña debe ser distinta de la actual." };
  }

  const admin = createAdminClient();
  const { login_max_intentos, login_bloqueo_minutos } = await obtenerConfiguracion();
  const { data: permitido } = await admin.rpc("app_consumir_intento", {
    p_run: "pw",
    p_dv: user.id,
    p_max: login_max_intentos,
    p_ventana_min: login_bloqueo_minutos,
  });
  if (permitido !== true) {
    return { ok: false as const, mensaje: "Demasiados intentos. Inténtalo más tarde." };
  }

  // Reautenticación con un cliente efímero: no toca las cookies de la sesión.
  const efimero = createClienteEfimero(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: errorActual } = await efimero.auth.signInWithPassword({ email: user.email, password: actual });
  if (errorActual) return { ok: false as const, mensaje: "La contraseña actual no es correcta." };

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: nueva });
  if (error) return { ok: false as const, mensaje: mensajeDeError(error, "cambiarPassword") };

  await admin.from("usuarios").update({ password_temporal_expira_en: null }).eq("id", user.id);
  await admin.from("intentos_login").delete().eq("run", "pw").eq("dv", user.id);

  // Cierra las demás sesiones (otros dispositivos) conservando la actual.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) await admin.auth.admin.signOut(session.access_token, "others");

  return { ok: true as const };
}

/**
 * Retiro del consentimiento para la foto de perfil (política de privacidad,
 * sección 5): borra el archivo del bucket y deja de mostrarla en la app y en
 * la credencial QR. Con el cliente del usuario: la política del bucket sólo
 * le permite borrar su propia carpeta.
 */
export async function quitarAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, mensaje: "No autenticado." };

  const { data: archivos, error: errorLista } = await supabase.storage.from("avatars").list(user.id);
  if (errorLista) return { ok: false as const, mensaje: "No se pudo quitar la foto. Intenta de nuevo." };

  if (archivos && archivos.length > 0) {
    const { error: errorBorrado } = await supabase.storage
      .from("avatars")
      .remove(archivos.map((a) => `${user.id}/${a.name}`));
    if (errorBorrado) return { ok: false as const, mensaje: "No se pudo quitar la foto. Intenta de nuevo." };
  }

  const { error } = await supabase.from("usuarios").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false as const, mensaje: "No se pudo quitar la foto. Intenta de nuevo." };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
