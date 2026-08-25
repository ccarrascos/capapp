"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sincronizarNotificaciones } from "@/lib/notificaciones";

export async function obtenerNotificaciones() {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, notificaciones: [] };

  const supabase = await createClient();
  await sincronizarNotificaciones(supabase, sesion);

  const { data } = await supabase
    .from("notificaciones")
    .select("id, tipo, mensaje, leido, created_at, persona_run")
    .eq("usuario_id", sesion.usuarioId)
    .order("created_at", { ascending: false })
    .limit(30);

  return { ok: true as const, notificaciones: data ?? [] };
}

export async function marcarNotificacionLeida(id: string) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leido: true })
    .eq("id", id)
    .eq("usuario_id", sesion.usuarioId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function marcarTodasLeidas() {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leido: true })
    .eq("usuario_id", sesion.usuarioId)
    .eq("leido", false);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
