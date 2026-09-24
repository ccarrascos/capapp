"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  invalidarCacheConfiguracion,
  invalidarCacheConfiguracionOrganizaciones,
  obtenerConfiguracion,
} from "@/lib/configuracion";
import {
  CAMPOS_CONFIGURACION,
  CAMPOS_ORGANIZACION,
  rangoCampoOrganizacion,
  type CampoOrganizacion,
} from "@/lib/configuracion-campos";
import { invalidarCachePermisos, tienePermiso } from "@/lib/permisos";
import { CATALOGO_PERMISOS, rolPuedeTenerPermiso, type AccionPermiso } from "@/lib/permisos-catalogo";
import type { RolNombre } from "@/lib/auth";

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

export async function actualizarPermiso(input: { rol: RolNombre; accion: string; permitido: boolean }) {
  const sesion = await getSesion();
  if (!sesion?.esSuperAdmin) {
    return { ok: false as const, mensaje: "Sólo un super administrador puede cambiar permisos." };
  }

  if (!(input.accion in CATALOGO_PERMISOS)) return { ok: false as const, mensaje: "Permiso desconocido." };
  const accion = input.accion as AccionPermiso;
  if (!rolPuedeTenerPermiso(accion, input.rol)) {
    return { ok: false as const, mensaje: "Ese rol no puede tener este permiso." };
  }

  const supabase = await createClient();
  const { error } = input.permitido
    ? await supabase.from("permisos_revocados").delete().eq("rol", input.rol).eq("accion", accion)
    : await supabase
        .from("permisos_revocados")
        .upsert({ rol: input.rol, accion, revocado_por: sesion.usuarioId, revocado_en: new Date().toISOString() });

  if (error) return { ok: false as const, mensaje: error.message };

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: input.permitido ? "otorgar_permiso" : "revocar_permiso",
    tabla: "permisos_revocados",
    registroId: null,
    datosNuevos: { rol: input.rol, permiso: accion },
  });

  invalidarCachePermisos();
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function actualizarConfiguracionOrganizacion(input: {
  organizacionId: string;
  clave: string;
  valor: number | null;
}) {
  const sesion = await getSesion();
  if (!sesion || !(await tienePermiso(sesion, "organizacion.configurar", input.organizacionId))) {
    return { ok: false as const, mensaje: "No tienes permiso para configurar esta organización." };
  }

  const campo = CAMPOS_ORGANIZACION.find((c) => c.clave === input.clave);
  if (!campo) return { ok: false as const, mensaje: "Parámetro desconocido." };

  if (input.valor !== null) {
    const plataforma = (await obtenerConfiguracion())[campo.clave];
    const { min, max } = rangoCampoOrganizacion(campo.clave, plataforma);
    if (!Number.isInteger(input.valor) || input.valor < min || input.valor > max) {
      return { ok: false as const, mensaje: `${campo.etiqueta}: debe ser un número entero entre ${min} y ${max}.` };
    }
  }

  const supabase = await createClient();
  const { data: anterior } = await supabase
    .from("organizaciones")
    .select(campo.clave)
    .eq("id", input.organizacionId)
    .maybeSingle();

  const cambios: Partial<Record<CampoOrganizacion["clave"], number | null>> = {};
  cambios[campo.clave] = input.valor;
  const { error } = await supabase.from("organizaciones").update(cambios).eq("id", input.organizacionId);

  if (error) return { ok: false as const, mensaje: error.message };

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "actualizar_configuracion_organizacion",
    tabla: "organizaciones",
    registroId: input.organizacionId,
    datosAnteriores: { clave: campo.clave, valor: (anterior as Record<string, unknown> | null)?.[campo.clave] ?? null },
    datosNuevos: { clave: campo.clave, valor: input.valor },
  });

  invalidarCacheConfiguracionOrganizaciones();
  revalidatePath("/", "layout");
  return { ok: true as const };
}
