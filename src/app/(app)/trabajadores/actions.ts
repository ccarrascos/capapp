"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import { esFechaNacimientoValida } from "@/lib/fecha-nacimiento";
import { normalizarEmail } from "@/lib/normalizar-email";
import { generarQrDataUrl } from "@/lib/qr";
import type { Database } from "@/lib/database.types";

type ModalidadContractual = Database["public"]["Enums"]["modalidad_contractual"];
type TipoVinculoLaboral = Database["public"]["Enums"]["tipo_vinculo_laboral"];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function validarSubcontrato(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipoVinculo: TipoVinculoLaboral,
  subcontratoId: string | null,
  centroTrabajoId: string | null,
): Promise<string | null> {
  if (tipoVinculo === "directo") return null;
  if (!subcontratoId) return "Selecciona el subcontrato.";
  if (!centroTrabajoId) return "Selecciona el centro de trabajo para validar el subcontrato.";

  const { data } = await supabase
    .from("subcontratos_centros")
    .select("id")
    .eq("subcontrato_id", subcontratoId)
    .eq("centro_trabajo_id", centroTrabajoId)
    .maybeSingle();

  if (!data) return "Ese subcontrato no está asignado a este centro de trabajo.";
  return null;
}

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
  tipoVinculo: TipoVinculoLaboral;
  subcontratoId: string | null;
};

export async function crearTrabajador(input: CrearTrabajadorInput) {
  if (!esRutValido(input.run, input.dv)) {
    return { ok: false as const, mensaje: "El RUT ingresado no es válido." };
  }

  if (input.fechaNacimiento && !esFechaNacimientoValida(input.fechaNacimiento)) {
    return {
      ok: false as const,
      mensaje: "La fecha de nacimiento no es válida: no puede ser hoy, futura, ni corresponder a un menor de edad.",
    };
  }

  const supabase = await createClient();

  const errorSubcontrato = await validarSubcontrato(
    supabase,
    input.tipoVinculo,
    input.subcontratoId,
    input.centroTrabajoId,
  );
  if (errorSubcontrato) return { ok: false as const, mensaje: errorSubcontrato };

  // La persona (identidad, por RUT) es global al sistema — si ya existe
  // porque trabajó en otra organización, reutilizamos su registro y
  // reconocemos su capacitación previa (portabilidad, DS 44 punto 6.4).
  // Nota: se hace un select + insert/update explícito en vez de upsert,
  // porque Postgres exige que un INSERT ... ON CONFLICT DO UPDATE cumpla
  // simultáneamente las políticas RLS de INSERT y UPDATE incluso cuando
  // no hay conflicto real, lo que rechazaba altas de personas nuevas.
  const datosPersona = {
    run: input.run,
    dv: input.dv,
    nombres: input.nombres,
    apellido_paterno: input.apellidoPaterno,
    apellido_materno: input.apellidoMaterno,
    email: input.email ? normalizarEmail(input.email) : null,
    fecha_nacimiento: input.fechaNacimiento,
  };

  const { data: personaExistente } = await supabase.from("personas").select("run").eq("run", input.run).maybeSingle();

  const { error: errorPersona } = personaExistente
    ? await supabase.from("personas").update(datosPersona).eq("run", input.run)
    : await supabase.from("personas").insert(datosPersona);

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
    tipo_vinculo: input.tipoVinculo,
    subcontrato_id: input.subcontratoId,
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

export async function actualizarTrabajador(input: {
  personaRun: string;
  organizacionId: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  cargoId: string | null;
  centroTrabajoId: string | null;
  unidad: string | null;
  modalidadContractual: ModalidadContractual;
  tipoVinculo: TipoVinculoLaboral;
  subcontratoId: string | null;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) =>
        (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === input.organizacionId,
    );

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para editar a este trabajador." };
  }

  if (input.fechaNacimiento && !esFechaNacimientoValida(input.fechaNacimiento)) {
    return {
      ok: false as const,
      mensaje: "La fecha de nacimiento no es válida: no puede ser hoy, futura, ni corresponder a un menor de edad.",
    };
  }

  const supabase = await createClient();

  const errorSubcontrato = await validarSubcontrato(
    supabase,
    input.tipoVinculo,
    input.subcontratoId,
    input.centroTrabajoId,
  );
  if (errorSubcontrato) return { ok: false as const, mensaje: errorSubcontrato };

  const { error: errorPersona } = await supabase
    .from("personas")
    .update({
      nombres: input.nombres,
      apellido_paterno: input.apellidoPaterno,
      apellido_materno: input.apellidoMaterno,
      email: input.email ? normalizarEmail(input.email) : null,
      fecha_nacimiento: input.fechaNacimiento,
    })
    .eq("run", input.personaRun);

  if (errorPersona) return { ok: false as const, mensaje: errorPersona.message };

  const { data: vinculoActual } = await supabase
    .from("vinculos_laborales")
    .select("centro_trabajo_id")
    .eq("persona_run", input.personaRun)
    .eq("organizacion_id", input.organizacionId)
    .maybeSingle();

  const { error: errorVinculo } = await supabase
    .from("vinculos_laborales")
    .update({
      cargo_id: input.cargoId,
      centro_trabajo_id: input.centroTrabajoId,
      unidad: input.unidad,
      modalidad_contractual: input.modalidadContractual,
      tipo_vinculo: input.tipoVinculo,
      subcontrato_id: input.subcontratoId,
    })
    .eq("persona_run", input.personaRun)
    .eq("organizacion_id", input.organizacionId);

  if (errorVinculo) return { ok: false as const, mensaje: errorVinculo.message };

  if (vinculoActual && vinculoActual.centro_trabajo_id !== input.centroTrabajoId) {
    await supabase.from("historial_centro_trabajo").insert({
      persona_run: input.personaRun,
      organizacion_id: input.organizacionId,
      centro_anterior_id: vinculoActual.centro_trabajo_id,
      centro_nuevo_id: input.centroTrabajoId,
      cambiado_por: sesion.usuarioId,
    });
  }

  revalidatePath("/trabajadores");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export async function obtenerDetalleTrabajador(personaRun: string, organizacionId: string) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]) && r.organizacionId === organizacionId,
    );

  if (!autorizado) return { ok: false as const, mensaje: "No tienes permiso para ver este detalle." };

  const supabase = await createClient();

  const [{ data: persona }, { data: vinculo }, { data: inscripciones }, { data: historial }] = await Promise.all([
    supabase
      .from("personas")
      .select("run, dv, nombres, apellido_paterno, apellido_materno, fecha_nacimiento")
      .eq("run", personaRun)
      .maybeSingle(),
    supabase
      .from("vinculos_laborales")
      .select(
        "fecha_ingreso, modalidad_contractual, unidad, tipo_vinculo, cargos(nombre), centros_trabajo(nombre), subcontratos(nombre)",
      )
      .eq("persona_run", personaRun)
      .eq("organizacion_id", organizacionId)
      .maybeSingle(),
    supabase
      .from("inscripciones")
      .select(
        "id, estado, fecha_inscripcion, fecha_aprobacion, vigencia_hasta, ediciones_curso(fecha_inicio, fecha_termino, cursos(nombre, horas_totales), centros_trabajo(nombre)), evaluaciones_resultado(puntaje, aprobado, modulo_id)",
      )
      .eq("persona_run", personaRun)
      .order("fecha_inscripcion", { ascending: false }),
    supabase
      .from("historial_centro_trabajo")
      .select(
        "cambiado_en, centro_anterior:centros_trabajo!historial_centro_trabajo_centro_anterior_id_fkey(nombre), centro_nuevo:centros_trabajo!historial_centro_trabajo_centro_nuevo_id_fkey(nombre)",
      )
      .eq("persona_run", personaRun)
      .eq("organizacion_id", organizacionId)
      .order("cambiado_en", { ascending: false }),
  ]);

  if (!persona) return { ok: false as const, mensaje: "No se encontró a esta persona." };

  return {
    ok: true as const,
    persona,
    vinculo: vinculo ?? null,
    inscripciones: inscripciones ?? [],
    historialCentro: historial ?? [],
  };
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

  const email = normalizarEmail(input.email);
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

export async function obtenerCredencialQr(personaRun: string, organizacionId: string) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]) && r.organizacionId === organizacionId,
    );

  if (!autorizado) return { ok: false as const, mensaje: "No tienes permiso para generar esta credencial." };

  const supabase = await createClient();

  const { data: vinculo } = await supabase
    .from("vinculos_laborales")
    .select("qr_token")
    .eq("persona_run", personaRun)
    .eq("organizacion_id", organizacionId)
    .maybeSingle();

  if (!vinculo) return { ok: false as const, mensaje: "No se encontró el vínculo laboral." };

  const url = `${APP_URL}/credencial/${vinculo.qr_token}`;
  const qrDataUrl = await generarQrDataUrl(url);

  return { ok: true as const, url, qrDataUrl };
}
