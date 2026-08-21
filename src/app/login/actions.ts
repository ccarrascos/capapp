"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function iniciarSesionConRut(input: { run: string; dv: string; password: string }) {
  const admin = createAdminClient();

  const { data: usuario } = await admin
    .from("usuarios")
    .select("email, activo")
    .eq("run", input.run)
    .eq("dv", input.dv)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    return { ok: false as const, mensaje: "RUT o contraseña incorrectos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usuario.email,
    password: input.password,
  });

  if (error) {
    return { ok: false as const, mensaje: "RUT o contraseña incorrectos." };
  }

  return { ok: true as const };
}
