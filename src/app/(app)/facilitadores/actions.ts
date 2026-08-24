"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esRutValido } from "@/lib/rut";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TipoProveedor = Database["public"]["Enums"]["tipo_proveedor"];

async function resolverEntidadExterna(
  supabase: SupabaseClient<Database>,
  tipoProveedor: TipoProveedor,
  entidadNombre: string | null,
): Promise<{ ok: true; oalId: string | null; otecId: string | null } | { ok: false; mensaje: string }> {
  if (tipoProveedor !== "oal" && tipoProveedor !== "otec") {
    return { ok: true, oalId: null, otecId: null };
  }

  if (!entidadNombre?.trim()) {
    return { ok: false, mensaje: "Indica el nombre de la entidad externa." };
  }

  const nombre = entidadNombre.trim();
  const tabla = tipoProveedor === "oal" ? "organismos_administradores" : "entidades_acreditadas";

  const { data: existente } = await supabase.from(tabla).select("id").ilike("nombre", nombre).maybeSingle();

  if (existente) {
    return tipoProveedor === "oal"
      ? { ok: true, oalId: existente.id, otecId: null }
      : { ok: true, oalId: null, otecId: existente.id };
  }

  const { data: creado, error } = await supabase.from(tabla).insert({ nombre }).select("id").single();
  if (error || !creado) {
    return {
      ok: false,
      mensaje: error?.message ?? `No se pudo registrar ${tipoProveedor === "oal" ? "el organismo administrador" : "la OTEC"}.`,
    };
  }

  return tipoProveedor === "oal" ? { ok: true, oalId: creado.id, otecId: null } : { ok: true, oalId: null, otecId: creado.id };
}

export async function buscarPersonaPorRun(run: string) {
  // Se usa el cliente admin (sólo lectura de nombre, nada sensible) porque
  // esta búsqueda debe encontrar a la persona sin importar en qué
  // organización quedó registrada primero — igual que un facilitador o un
  // trabajador puede repetirse en varias organizaciones. Con el cliente
  // normal, RLS sólo deja ver personas/facilitadores de organizaciones que
  // el actor ya administra, y el mismo RUT podía terminar registrado con
  // nombres distintos en cada una sin que la app lo detectara.
  const admin = createAdminClient();

  const { data: facilitador } = await admin
    .from("facilitadores")
    .select("nombres, apellidos, titulo_profesional, es_experto_prevencion")
    .eq("run", run)
    .maybeSingle();

  if (facilitador) {
    return {
      nombres: facilitador.nombres,
      apellidos: facilitador.apellidos,
      tituloProfesional: facilitador.titulo_profesional,
      esExpertoPrevencion: facilitador.es_experto_prevencion,
    };
  }

  const { data: persona } = await admin
    .from("personas")
    .select("nombres, apellido_paterno, apellido_materno")
    .eq("run", run)
    .maybeSingle();

  if (persona) {
    return {
      nombres: persona.nombres,
      apellidos: `${persona.apellido_paterno}${persona.apellido_materno ? ` ${persona.apellido_materno}` : ""}`,
      tituloProfesional: null,
      esExpertoPrevencion: null,
    };
  }

  const { data: usuario } = await admin
    .from("usuarios")
    .select("nombres, apellidos")
    .eq("run", run)
    .maybeSingle();

  if (usuario) {
    return { nombres: usuario.nombres, apellidos: usuario.apellidos, tituloProfesional: null, esExpertoPrevencion: null };
  }

  return null;
}

export async function crearFacilitador(input: {
  organizacionId: string;
  run: string;
  dv: string;
  nombres: string;
  apellidos: string;
  tituloProfesional: string | null;
  esExpertoPrevencion: boolean;
  tipoProveedor: TipoProveedor;
  entidadNombre: string | null;
}) {
  if (!esRutValido(input.run, input.dv)) {
    return { ok: false as const, mensaje: "El RUT ingresado no es válido." };
  }

  const supabase = await createClient();

  const entidad = await resolverEntidadExterna(supabase, input.tipoProveedor, input.entidadNombre);
  if (!entidad.ok) return { ok: false as const, mensaje: entidad.mensaje };

  const { error } = await supabase.from("facilitadores").insert({
    tipo_proveedor: input.tipoProveedor,
    organizacion_id: input.organizacionId,
    oal_id: entidad.oalId,
    otec_id: entidad.otecId,
    run: input.run,
    dv: input.dv,
    nombres: input.nombres,
    apellidos: input.apellidos,
    titulo_profesional: input.tituloProfesional,
    es_experto_prevencion: input.esExpertoPrevencion,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/facilitadores");
  return { ok: true as const };
}

export async function actualizarFacilitador(input: {
  facilitadorId: string;
  organizacionId: string;
  nombres: string;
  apellidos: string;
  tituloProfesional: string | null;
  esExpertoPrevencion: boolean;
  tipoProveedor: TipoProveedor;
  entidadNombre: string | null;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === input.organizacionId);

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para editar este facilitador." };
  }

  const supabase = await createClient();

  const entidad = await resolverEntidadExterna(supabase, input.tipoProveedor, input.entidadNombre);
  if (!entidad.ok) return { ok: false as const, mensaje: entidad.mensaje };

  const { error } = await supabase
    .from("facilitadores")
    .update({
      tipo_proveedor: input.tipoProveedor,
      oal_id: entidad.oalId,
      otec_id: entidad.otecId,
      nombres: input.nombres,
      apellidos: input.apellidos,
      titulo_profesional: input.tituloProfesional,
      es_experto_prevencion: input.esExpertoPrevencion,
    })
    .eq("id", input.facilitadorId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/facilitadores");
  return { ok: true as const };
}

export async function actualizarEstadoFacilitador(input: {
  facilitadorId: string;
  organizacionId: string;
  activo: boolean;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === input.organizacionId);

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para modificar este facilitador." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("facilitadores")
    .update({ activo: input.activo })
    .eq("id", input.facilitadorId);

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/facilitadores");
  return { ok: true as const };
}
