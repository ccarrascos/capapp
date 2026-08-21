"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO = 3 * 1024 * 1024;

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

  if (archivo.size > TAMANO_MAXIMO) {
    return { ok: false as const, mensaje: "La imagen no puede superar los 3 MB." };
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
