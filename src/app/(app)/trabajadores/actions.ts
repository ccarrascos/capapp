"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { generarPasswordTemporal } from "@/lib/password";
import { esRutValido } from "@/lib/rut";
import { esFechaNacimientoValida, normalizarFechaNacimiento } from "@/lib/fecha-nacimiento";
import { normalizarEmail } from "@/lib/normalizar-email";
import { generarQrDataUrl } from "@/lib/qr";
import { registrarAuditoria } from "@/lib/auditoria";
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
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) =>
        (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === input.organizacionId,
    );

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para registrar trabajadores en esta organización." };
  }

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
  //
  // La comprobación de existencia se hace con el cliente admin (bypassa
  // RLS) porque sel_personas sólo deja ver a una persona con la que el
  // actor ya comparte una organización — si esta organización es la
  // primera con la que se vincula, el cliente normal la vería como
  // inexistente y el INSERT de abajo chocaría contra la llave primaria
  // (personas.run), mostrando un "ya existe" que el usuario no podría
  // resolver. Cuando la persona ya existe se conserva su identidad tal
  // cual está — no se sobrescribe con lo tipeado en este formulario, que
  // puede pertenecer a una organización sin ningún vínculo con ella
  // todavía (evita que cualquiera pise el nombre/fecha de nacimiento de
  // alguien que no gestiona). Si hace falta corregir un dato suyo, se
  // edita después desde "Editar trabajador" una vez creado el vínculo.
  const admin = createAdminClient();
  const { data: personaExistente } = await admin
    .from("personas")
    .select("run, nombres, apellido_paterno, apellido_materno")
    .eq("run", input.run)
    .maybeSingle();

  if (!personaExistente) {
    const { error: errorPersona } = await supabase.from("personas").insert({
      run: input.run,
      dv: input.dv,
      nombres: input.nombres,
      apellido_paterno: input.apellidoPaterno,
      apellido_materno: input.apellidoMaterno,
      email: input.email ? normalizarEmail(input.email) : null,
      fecha_nacimiento: input.fechaNacimiento,
    });

    if (errorPersona) {
      return { ok: false as const, mensaje: errorPersona.message };
    }
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
  return personaExistente
    ? {
        ok: true as const,
        personaYaExistia: true as const,
        nombreExistente: `${personaExistente.nombres} ${personaExistente.apellido_paterno}${personaExistente.apellido_materno ? ` ${personaExistente.apellido_materno}` : ""}`,
      }
    : { ok: true as const, personaYaExistia: false as const };
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
        "id, estado, fecha_inscripcion, fecha_aprobacion, vigencia_hasta, ediciones_curso(curso_id, fecha_inicio, fecha_termino, cursos(nombre, horas_totales), centros_trabajo(nombre)), evaluaciones_resultado(puntaje, aprobado, modulo_id)",
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

  const { data: vinculo } = await admin
    .from("vinculos_laborales")
    .select("persona_run")
    .eq("persona_run", input.personaRun)
    .eq("organizacion_id", input.organizacionId)
    .eq("activo", true)
    .maybeSingle();

  if (!vinculo) {
    return { ok: false as const, mensaje: "Esta persona no tiene un vínculo laboral activo en esta organización." };
  }

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

  await registrarAuditoria(admin, {
    usuarioId: sesion.usuarioId,
    accion: "dar_acceso_trabajador",
    tabla: "usuarios",
    registroId: creado.user.id,
    datosNuevos: { personaRun: persona.run, organizacionId: input.organizacionId },
  });

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

export type FilaCargaMasiva = {
  run: string;
  dv: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  email: string;
  cargoNombre: string;
  centroNombre: string;
  unidad: string;
  modalidadContractual: string;
  tipoVinculo: string;
  subcontratoNombre: string;
};

export type ResultadoFilaCarga = { fila: number; ok: boolean; mensaje: string };

const MODALIDADES_VALIDAS = new Set<ModalidadContractual>([
  "indefinido",
  "plazo_fijo",
  "obra_o_faena",
  "aprendiz",
  "honorarios",
  "otro",
]);
const TIPOS_VINCULO_VALIDOS = new Set<TipoVinculoLaboral>(["directo", "subcontrato"]);
const MAX_FILAS_CARGA_MASIVA = 300;

/**
 * Alta masiva de trabajadores desde un CSV. Procesa las filas de forma
 * secuencial (no en paralelo) porque el mismo RUT puede repetirse dentro
 * del propio archivo — así la segunda aparición ve que la primera ya
 * insertó la persona, en vez de que ambas intenten crearla a la vez.
 */
export async function cargarTrabajadoresMasivo(input: {
  organizacionId: string;
  filas: FilaCargaMasiva[];
}): Promise<{ ok: true; resultados: ResultadoFilaCarga[] } | { ok: false; mensaje: string }> {
  const sesion = await getSesion();
  if (!sesion) return { ok: false, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) =>
        (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === input.organizacionId,
    );
  if (!autorizado) {
    return { ok: false, mensaje: "No tienes permiso para cargar trabajadores en esta organización." };
  }

  if (input.filas.length === 0) return { ok: false, mensaje: "El archivo no tiene filas para importar." };
  if (input.filas.length > MAX_FILAS_CARGA_MASIVA) {
    return {
      ok: false,
      mensaje: `Máximo ${MAX_FILAS_CARGA_MASIVA} filas por carga. Divide el archivo en partes más pequeñas.`,
    };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: cargos }, { data: centros }, { data: subcontratos }] = await Promise.all([
    supabase.from("cargos").select("id, nombre").eq("organizacion_id", input.organizacionId),
    supabase.from("centros_trabajo").select("id, nombre").eq("organizacion_id", input.organizacionId),
    supabase.from("subcontratos").select("id, nombre").eq("organizacion_id", input.organizacionId),
  ]);

  const cargoPorNombre = new Map((cargos ?? []).map((c) => [c.nombre.trim().toLowerCase(), c.id]));
  const centroPorNombre = new Map((centros ?? []).map((c) => [c.nombre.trim().toLowerCase(), c.id]));
  const subcontratoPorNombre = new Map((subcontratos ?? []).map((s) => [s.nombre.trim().toLowerCase(), s.id]));

  const resultados: ResultadoFilaCarga[] = [];

  for (let idx = 0; idx < input.filas.length; idx++) {
    const numeroFila = idx + 2; // la fila 1 del archivo es el encabezado
    const fila = input.filas[idx];

    const run = fila.run.replace(/\./g, "").trim();
    const dv = fila.dv.trim().toUpperCase();

    if (!esRutValido(run, dv)) {
      resultados.push({ fila: numeroFila, ok: false, mensaje: "RUT inválido." });
      continue;
    }
    if (!fila.nombres.trim() || !fila.apellidoPaterno.trim()) {
      resultados.push({ fila: numeroFila, ok: false, mensaje: "Nombres y apellido paterno son obligatorios." });
      continue;
    }

    let fechaNacimiento: string | null = null;
    const fechaNacimientoTexto = fila.fechaNacimiento.trim();
    if (fechaNacimientoTexto) {
      fechaNacimiento = normalizarFechaNacimiento(fechaNacimientoTexto);
      if (!fechaNacimiento || !esFechaNacimientoValida(fechaNacimiento)) {
        resultados.push({
          fila: numeroFila,
          ok: false,
          mensaje: "Fecha de nacimiento inválida (usa AAAA-MM-DD o DD-MM-AAAA).",
        });
        continue;
      }
    }

    const modalidad = fila.modalidadContractual.trim().toLowerCase() as ModalidadContractual;
    if (!MODALIDADES_VALIDAS.has(modalidad)) {
      resultados.push({
        fila: numeroFila,
        ok: false,
        mensaje: `Modalidad contractual "${fila.modalidadContractual}" no reconocida.`,
      });
      continue;
    }

    const tipoVinculo = (fila.tipoVinculo.trim().toLowerCase() || "directo") as TipoVinculoLaboral;
    if (!TIPOS_VINCULO_VALIDOS.has(tipoVinculo)) {
      resultados.push({
        fila: numeroFila,
        ok: false,
        mensaje: `Tipo de vínculo "${fila.tipoVinculo}" no reconocido.`,
      });
      continue;
    }

    let subcontratoId: string | null = null;
    if (tipoVinculo === "subcontrato") {
      subcontratoId = subcontratoPorNombre.get(fila.subcontratoNombre.trim().toLowerCase()) ?? null;
      if (!subcontratoId) {
        resultados.push({
          fila: numeroFila,
          ok: false,
          mensaje: `Subcontrato "${fila.subcontratoNombre}" no existe en esta organización.`,
        });
        continue;
      }
    }

    let cargoId: string | null = null;
    if (fila.cargoNombre.trim()) {
      cargoId = cargoPorNombre.get(fila.cargoNombre.trim().toLowerCase()) ?? null;
      if (!cargoId) {
        resultados.push({
          fila: numeroFila,
          ok: false,
          mensaje: `Cargo "${fila.cargoNombre}" no existe en esta organización.`,
        });
        continue;
      }
    }

    let centroId: string | null = null;
    if (fila.centroNombre.trim()) {
      centroId = centroPorNombre.get(fila.centroNombre.trim().toLowerCase()) ?? null;
      if (!centroId) {
        resultados.push({
          fila: numeroFila,
          ok: false,
          mensaje: `Centro de trabajo "${fila.centroNombre}" no existe en esta organización.`,
        });
        continue;
      }
    }

    if (tipoVinculo === "subcontrato" && !centroId) {
      resultados.push({
        fila: numeroFila,
        ok: false,
        mensaje: "El vínculo por subcontrato requiere indicar el centro de trabajo.",
      });
      continue;
    }

    // Misma lógica de portabilidad que crearTrabajador: se busca con el
    // cliente admin (visibilidad global) y, si ya existe, no se sobrescribe
    // su identidad — sólo se agrega el vínculo con esta organización.
    const { data: personaExistente } = await admin.from("personas").select("run").eq("run", run).maybeSingle();

    if (!personaExistente) {
      const { error: errorPersona } = await supabase.from("personas").insert({
        run,
        dv,
        nombres: fila.nombres.trim(),
        apellido_paterno: fila.apellidoPaterno.trim(),
        apellido_materno: fila.apellidoMaterno.trim() || null,
        email: fila.email.trim() ? normalizarEmail(fila.email.trim()) : null,
        fecha_nacimiento: fechaNacimiento,
      });
      if (errorPersona) {
        resultados.push({ fila: numeroFila, ok: false, mensaje: errorPersona.message });
        continue;
      }
    }

    const { error: errorVinculo } = await supabase.from("vinculos_laborales").insert({
      persona_run: run,
      organizacion_id: input.organizacionId,
      centro_trabajo_id: centroId,
      cargo_id: cargoId,
      unidad: fila.unidad.trim() || null,
      modalidad_contractual: modalidad,
      tipo_vinculo: tipoVinculo,
      subcontrato_id: subcontratoId,
    });

    if (errorVinculo) {
      const mensaje = errorVinculo.message.includes("duplicate key")
        ? "Esta persona ya está registrada en esta organización."
        : errorVinculo.message;
      resultados.push({ fila: numeroFila, ok: false, mensaje });
      continue;
    }

    resultados.push({
      fila: numeroFila,
      ok: true,
      mensaje: personaExistente ? "Agregado (identidad ya existente, se reutilizó)." : "Agregado.",
    });
  }

  revalidatePath("/trabajadores");
  revalidatePath("/dashboard");

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "carga_masiva_trabajadores",
    tabla: "vinculos_laborales",
    datosNuevos: {
      organizacionId: input.organizacionId,
      filas: input.filas.length,
      exitosas: resultados.filter((r) => r.ok).length,
    },
  });

  return { ok: true, resultados };
}

export type CursoConEdicionesDisponibles = {
  cursoId: string;
  cursoNombre: string;
  ediciones: { id: string; fechaInicio: string; fechaLimite: string; centroNombre: string | null }[];
};

/** Cursos con ediciones abiertas donde este trabajador aún no está inscrito
 * ni tiene ese mismo curso vigente — para ofrecerlos desde la Matriz de
 * vigencia cuando está sin capacitación o vencido. */
export async function obtenerCursosDisponiblesParaInscripcion(personaRun: string, organizacionId: string) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some(
      (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === organizacionId,
    );
  if (!autorizado) return { ok: false as const, mensaje: "No tienes permiso para inscribir en esta organización." };

  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [{ data: ediciones }, { data: inscripciones }] = await Promise.all([
    supabase
      .from("ediciones_curso")
      .select("id, curso_id, fecha_inicio, fecha_limite, cursos(nombre), centros_trabajo(nombre)")
      .eq("organizacion_id", organizacionId)
      .in("estado", ["planificada", "en_curso"])
      .gte("fecha_limite", hoy)
      .order("fecha_inicio"),
    supabase
      .from("inscripciones")
      .select(
        "edicion_id, estado, fecha_aprobacion, vigencia_hasta, ediciones_curso!inner(curso_id, organizacion_id)",
      )
      .eq("persona_run", personaRun)
      .eq("ediciones_curso.organizacion_id", organizacionId),
  ]);

  const edicionesYaInscrito = new Set((inscripciones ?? []).map((i) => i.edicion_id));

  // Si la aprobación más reciente de un curso sigue vigente, no tiene
  // sentido ofrecer inscribirlo de nuevo hasta que venza.
  const vigenciaPorCurso = new Map<string, { fechaAprobacion: string | null; vigenciaHasta: string | null }>();
  for (const i of inscripciones ?? []) {
    if (i.estado !== "aprobado") continue;
    const cursoId = i.ediciones_curso.curso_id;
    const previa = vigenciaPorCurso.get(cursoId);
    if (!previa || (i.fecha_aprobacion ?? "") > (previa.fechaAprobacion ?? "")) {
      vigenciaPorCurso.set(cursoId, { fechaAprobacion: i.fecha_aprobacion, vigenciaHasta: i.vigencia_hasta });
    }
  }
  const cursosVigentes = new Set(
    [...vigenciaPorCurso.entries()]
      .filter(([, v]) => v.vigenciaHasta != null && v.vigenciaHasta >= hoy)
      .map(([cursoId]) => cursoId),
  );

  const porCurso = new Map<string, CursoConEdicionesDisponibles>();
  for (const e of ediciones ?? []) {
    if (edicionesYaInscrito.has(e.id) || cursosVigentes.has(e.curso_id)) continue;
    const fila = {
      id: e.id,
      fechaInicio: e.fecha_inicio,
      fechaLimite: e.fecha_limite,
      centroNombre: e.centros_trabajo?.nombre ?? null,
    };
    const existente = porCurso.get(e.curso_id);
    if (existente) existente.ediciones.push(fila);
    else porCurso.set(e.curso_id, { cursoId: e.curso_id, cursoNombre: e.cursos?.nombre ?? "Curso", ediciones: [fila] });
  }

  return {
    ok: true as const,
    cursos: [...porCurso.values()].sort((a, b) => a.cursoNombre.localeCompare(b.cursoNombre, "es")),
  };
}
