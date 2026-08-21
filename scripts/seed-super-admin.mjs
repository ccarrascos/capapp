import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const nombres = process.argv[3] ?? "Cristian";
const apellidos = process.argv[4] ?? "Carrasco";

if (!url || !serviceKey || !email) {
  console.error("Uso: node scripts/seed-super-admin.mjs <email> [nombres] [apellidos]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = randomBytes(9).toString("base64url");

const { data: created, error: errorAuth } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (errorAuth || !created.user) {
  console.error("Error creando usuario de auth:", errorAuth?.message);
  process.exit(1);
}

const { error: errorPerfil } = await admin.from("usuarios").insert({
  id: created.user.id,
  nombres,
  apellidos,
  email,
});

if (errorPerfil) {
  console.error("Error creando perfil:", errorPerfil.message);
  process.exit(1);
}

const { data: rol } = await admin.from("roles").select("id").eq("nombre", "super_admin").single();

const { error: errorRol } = await admin.from("usuario_roles").insert({
  usuario_id: created.user.id,
  rol_id: rol.id,
  organizacion_id: null,
  centro_trabajo_id: null,
});

if (errorRol) {
  console.error("Error asignando rol:", errorRol.message);
  process.exit(1);
}

console.log("Cuenta super_admin creada:");
console.log("  Correo:", email);
console.log("  Clave temporal:", password);
