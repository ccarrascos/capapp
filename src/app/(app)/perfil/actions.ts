"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
