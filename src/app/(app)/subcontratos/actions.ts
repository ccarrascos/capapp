"use server";

import { revalidatePath } from "next/cache";
import { getSesion, type Sesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function autorizado(sesion: Sesion, organizacionId: string) {
  return (
    sesion.esSuperAdmin ||
    sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === organizacionId)
  );
}

export async function crearSubcontrato(input: {
  organizacionId: string;
  nombre: string;
  rut: string | null;
  centroTrabajoId: string;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar subcontratos." };
  }

  const supabase = await createClient();

  const { data: subcontrato, error } = await supabase
    .from("subcontratos")
    .insert({ organizacion_id: input.organizacionId, nombre: input.nombre, rut: input.rut })
    .select("id")
    .single();

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Ya existe un subcontrato con ese nombre en esta organización — asígnalo a otro centro en vez de crearlo de nuevo."
      : error.message;
    return { ok: false as const, mensaje };
  }

  const { error: errorAsignacion } = await supabase
    .from("subcontratos_centros")
    .insert({ subcontrato_id: subcontrato.id, centro_trabajo_id: input.centroTrabajoId });

  if (errorAsignacion) {
    await supabase.from("subcontratos").delete().eq("id", subcontrato.id);
    return { ok: false as const, mensaje: errorAsignacion.message };
  }

  revalidatePath("/subcontratos");
  return { ok: true as const };
}

export async function actualizarSubcontrato(input: {
  subcontratoId: string;
  organizacionId: string;
  nombre: string;
  rut: string | null;
  centroIds: string[];
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };
  if (!autorizado(sesion, input.organizacionId)) {
    return { ok: false as const, mensaje: "No tienes permiso para gestionar subcontratos." };
  }

  if (input.centroIds.length === 0) {
    return { ok: false as const, mensaje: "Selecciona al menos un centro de trabajo." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("subcontratos")
    .update({ nombre: input.nombre, rut: input.rut })
    .eq("id", input.subcontratoId)
    .eq("organizacion_id", input.organizacionId);

  if (error) {
    const mensaje = error.message.includes("duplicate key")
      ? "Ya existe otro subcontrato con ese nombre en esta organización."
      : error.message;
    return { ok: false as const, mensaje };
  }

  const { data: actuales } = await supabase
    .from("subcontratos_centros")
    .select("centro_trabajo_id")
    .eq("subcontrato_id", input.subcontratoId);

  const centroIdsActuales = new Set((actuales ?? []).map((c) => c.centro_trabajo_id));
  const centroIdsNuevos = new Set(input.centroIds);

  const aAgregar = input.centroIds.filter((id) => !centroIdsActuales.has(id));
  const aQuitar = [...centroIdsActuales].filter((id) => !centroIdsNuevos.has(id));

  if (aAgregar.length > 0) {
    const { error: errorAgregar } = await supabase
      .from("subcontratos_centros")
      .insert(aAgregar.map((centroTrabajoId) => ({ subcontrato_id: input.subcontratoId, centro_trabajo_id: centroTrabajoId })));
    if (errorAgregar) return { ok: false as const, mensaje: errorAgregar.message };
  }

  if (aQuitar.length > 0) {
    const { error: errorQuitar } = await supabase
      .from("subcontratos_centros")
      .delete()
      .eq("subcontrato_id", input.subcontratoId)
      .in("centro_trabajo_id", aQuitar);
    if (errorQuitar) return { ok: false as const, mensaje: errorQuitar.message };
  }

  revalidatePath("/subcontratos");
  revalidatePath("/trabajadores");
  return { ok: true as const };
}
