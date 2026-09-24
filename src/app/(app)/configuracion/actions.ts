"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { invalidarCacheConfiguracion } from "@/lib/configuracion";
import { CAMPOS_CONFIGURACION } from "@/lib/configuracion-campos";

export async function actualizarConfiguracion(input: { clave: string; valor: number }) {
  const sesion = await getSesion();
  if (!sesion?.esSuperAdmin) {
    return { ok: false as const, mensaje: "Sólo un super administrador puede cambiar la configuración." };
  }

  const campo = CAMPOS_CONFIGURACION.find((c) => c.clave === input.clave);
  if (!campo) return { ok: false as const, mensaje: "Parámetro desconocido." };

  if (!Number.isInteger(input.valor) || input.valor < campo.min || input.valor > campo.max) {
    return {
      ok: false as const,
      mensaje: `${campo.etiqueta}: debe ser un número entero entre ${campo.min} y ${campo.max}.`,
    };
  }

  const supabase = await createClient();

  const { data: anterior } = await supabase
    .from("configuracion_plataforma")
    .select("valor")
    .eq("clave", campo.clave)
    .maybeSingle();

  const { error } = await supabase.from("configuracion_plataforma").upsert({
    clave: campo.clave,
    valor: input.valor,
    actualizado_en: new Date().toISOString(),
    actualizado_por: sesion.usuarioId,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "actualizar_configuracion",
    tabla: "configuracion_plataforma",
    registroId: null,
    datosAnteriores: { clave: campo.clave, valor: anterior?.valor ?? null },
    datosNuevos: { clave: campo.clave, valor: input.valor },
  });

  invalidarCacheConfiguracion();
  revalidatePath("/", "layout");
  return { ok: true as const };
}
