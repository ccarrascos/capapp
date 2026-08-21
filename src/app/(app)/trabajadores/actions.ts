"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import type { Database } from "@/lib/database.types";

type ModalidadContractual = Database["public"]["Enums"]["modalidad_contractual"];

export type CrearTrabajadorInput = {
  organizacionId: string;
  centroTrabajoId: string | null;
  run: string;
  dv: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  cargoId: string | null;
  unidad: string | null;
  modalidadContractual: ModalidadContractual;
  email: string | null;
  fechaNacimiento: string | null;
};

export async function crearTrabajador(input: CrearTrabajadorInput) {
  if (!esRutValido(input.run, input.dv)) {
    return { ok: false as const, mensaje: "El RUT ingresado no es válido." };
  }

  const supabase = await createClient();

  // La persona (identidad, por RUT) es global al sistema — si ya existe
  // porque trabajó en otra organización, reutilizamos su registro y
  // reconocemos su capacitación previa (portabilidad, DS 44 punto 6.4).
  const { error: errorPersona } = await supabase.from("personas").upsert(
    {
      run: input.run,
      dv: input.dv,
      nombres: input.nombres,
      apellido_paterno: input.apellidoPaterno,
      apellido_materno: input.apellidoMaterno,
      email: input.email,
      fecha_nacimiento: input.fechaNacimiento,
    },
    { onConflict: "run" },
  );

  if (errorPersona) {
    return { ok: false as const, mensaje: errorPersona.message };
  }

  const { error: errorVinculo } = await supabase.from("vinculos_laborales").insert({
    persona_run: input.run,
    organizacion_id: input.organizacionId,
    centro_trabajo_id: input.centroTrabajoId,
    cargo_id: input.cargoId,
    unidad: input.unidad,
    modalidad_contractual: input.modalidadContractual,
  });

  if (errorVinculo) {
    const mensaje = errorVinculo.message.includes("duplicate key")
      ? "Esta persona ya está registrada en esta organización."
      : errorVinculo.message;
    return { ok: false as const, mensaje };
  }

  revalidatePath("/trabajadores");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function crearAccesoTrabajador(input: {
  personaRun: string;
  organizacionId: string;
  email: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === input.organizacionId,
    );

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para dar acceso a este trabajador." };
  }

  const email = input.email.trim();
  if (!email) return { ok: false as const, mensaje: "Ingresa un correo para enviar las credenciales." };

  const admin = createAdminClient();

  const { data: persona } = await admin
    .from("personas")
    .select("nombres, apellido_paterno, apellido_materno, run, dv, usuario_id")
    .eq("run", input.personaRun)
    .maybeSingle();

  if (!persona) return { ok: false as const, mensaje: "No se encontró a esta persona." };
  if (persona.usuario_id) return { ok: false as const, mensaje: "Esta persona ya tiene una cuenta de acceso." };

  const passwordTemporal = generarPasswordTemporal();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorAuth || !creado.user) {
    return { ok: false as const, mensaje: errorAuth?.message ?? "No se pudo crear la cuenta." };
  }

  const apellidos = `${persona.apellido_paterno}${persona.apellido_materno ? ` ${persona.apellido_materno}` : ""}`;

  const { error: errorPerfil } = await admin.from("usuarios").insert({
    id: creado.user.id,
    nombres: persona.nombres,
    apellidos,
    email,
    run: persona.run,
    dv: persona.dv,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorPerfil.message };
  }

  const { data: rolRow } = await admin.from("roles").select("id").eq("nombre", "trabajador").single();

  if (!rolRow) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: "Rol inválido." };
  }

  const { error: errorRol } = await admin.from("usuario_roles").insert({
    usuario_id: creado.user.id,
    rol_id: rolRow.id,
    organizacion_id: input.organizacionId,
    centro_trabajo_id: null,
  });

  if (errorRol) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorRol.message };
  }

  const { error: errorPersona } = await admin
    .from("personas")
    .update({ usuario_id: creado.user.id, email })
    .eq("run", persona.run);

  if (errorPersona) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorPersona.message };
  }

  revalidatePath("/trabajadores");
  revalidatePath("/usuarios");

  const correo = await enviarCorreoBienvenida({
    nombres: persona.nombres,
    email,
    password: passwordTemporal,
    rolLabel: "Trabajador",
    rut: `${persona.run}-${persona.dv}`,
  });

  if (!correo.ok) {
    return { ok: true as const, emailEnviado: false as const, passwordTemporal, mensajeCorreo: correo.mensaje };
  }

  return { ok: true as const, emailEnviado: true as const };
}
