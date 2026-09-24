"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerConfiguracion } from "@/lib/configuracion";

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

  const extension = archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
  const ruta = `${user.id}/avatar.${extension}`;

  const { error: errorSubida } = await supabase.storage.from("avatars").upload(ruta, archivo, {
    upsert: true,
    contentType: archivo.type,
  });

  if (errorSubida) return { ok: false as const, mensaje: errorSubida.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(ruta);

  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: errorPerfil } = await supabase.from("usuarios").update({ avatar_url: avatarUrl }).eq("id", user.id);

  if (errorPerfil) return { ok: false as const, mensaje: errorPerfil.message };

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

  if (error) return { ok: false as const, mensaje: error.message };

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

  const { error } = await supabase.from("usuarios").update({ activo: false }).eq("id", user.id);

  if (error) return { ok: false as const, mensaje: error.message };

  await supabase.auth.signOut();

  return { ok: true as const };
}
