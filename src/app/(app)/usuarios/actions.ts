"use server";

import { revalidatePath } from "next/cache";
import { getSesion, type RolNombre } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoBienvenida } from "@/lib/email";
import { esRutValido } from "@/lib/rut";
import { generarPasswordTemporal, calcularExpiracionPasswordTemporal } from "@/lib/password";
import { normalizarEmail } from "@/lib/normalizar-email";
import { registrarAuditoria } from "@/lib/auditoria";

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

const AVISO_SIN_FICHA_FACILITADOR =
  "No hay una ficha de facilitador con este RUT en la organización. Regístralo en Facilitadores para que pueda dictar ediciones; quedará vinculado automáticamente.";

export type CrearUsuarioInput = {
  nombres: string;
  apellidos: string;
  email: string;
  run: string;
  dv: string;
  roles: RolNombre[];
  organizacionId: string | null;
  centroTrabajoId: string | null;
};

export async function crearUsuario(input: CrearUsuarioInput) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const roles = [...new Set(input.roles)];
  if (roles.length === 0) return { ok: false as const, mensaje: "Selecciona al menos un rol." };
  const rolesDeOrganizacion = roles.filter((r) => r !== "super_admin");

  if (roles.includes("super_admin") && !sesion.esSuperAdmin) {
    return { ok: false as const, mensaje: "Sólo un super administrador puede asignar ese rol." };
  }

  if (rolesDeOrganizacion.length > 0) {
    if (!input.organizacionId) {
      return { ok: false as const, mensaje: "Selecciona una organización para estos roles." };
    }
    if (!(await tienePermiso(sesion, "usuarios.gestionar", input.organizacionId))) {
      return { ok: false as const, mensaje: "No tienes permiso para crear esta cuenta." };
    }
  }

  if (roles.includes("trabajador")) {
    return {
      ok: false as const,
      mensaje: "El acceso de un trabajador se otorga desde el módulo Trabajadores (botón «Dar acceso»), para que quede vinculado a su registro en la matriz de vigencia.",
    };
  }

  const run = input.run.trim();
  const dv = input.dv.trim().toUpperCase();
  const email = normalizarEmail(input.email);

  if (!esRutValido(run, dv)) {
    return { ok: false as const, mensaje: "El RUT ingresado no es válido." };
  }

  const admin = createAdminClient();

  const { data: rutExistente } = await admin
    .from("usuarios")
    .select("id, nombres, apellidos")
    .eq("run", run)
    .maybeSingle();
  if (rutExistente) {
    // La persona ya tiene cuenta (por ejemplo, en otra organización o con
    // otro rol): se le suma el rol, sin tocar su identidad ni su contraseña.
    const resultados: Awaited<ReturnType<typeof agregarRolUsuario>>[] = [];
    for (const rol of roles) {
      resultados.push(
        await agregarRolUsuario({
          usuarioId: rutExistente.id,
          organizacionId: rol === "super_admin" ? null : input.organizacionId,
          rol,
          centroTrabajoId: input.centroTrabajoId,
        }),
      );
    }
    const agregados = roles.filter((_, i) => resultados[i].ok);
    if (agregados.length === 0) {
      const primerError = resultados.find((r) => !r.ok);
      return { ok: false as const, mensaje: primerError && !primerError.ok ? primerError.mensaje : "No se pudo asignar." };
    }
    return {
      ok: true as const,
      cuentaExistente: true as const,
      nombreExistente: `${rutExistente.nombres} ${rutExistente.apellidos}`,
      rolesAgregados: agregados,
      avisoFacilitador: resultados.map((r) => (r.ok ? r.avisoFacilitador : null)).find(Boolean) ?? null,
    };
  }

  const passwordTemporal = generarPasswordTemporal();
  const expiraEn = await calcularExpiracionPasswordTemporal();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorAuth || !creado.user) {
    return { ok: false as const, mensaje: errorAuth?.message ?? "No se pudo crear la cuenta." };
  }

  const supabase = await createClient();

  const { error: errorPerfil } = await admin.from("usuarios").insert({
    id: creado.user.id,
    nombres: input.nombres,
    apellidos: input.apellidos,
    email,
    run,
    dv,
    password_temporal_expira_en: expiraEn.toISOString(),
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorPerfil.message };
  }

  const { data: rolRows } = await supabase.from("roles").select("id, nombre").in("nombre", roles);

  if (!rolRows || rolRows.length !== roles.length) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: "Rol inválido." };
  }

  const { error: errorRol } = await admin.from("usuario_roles").insert(
    rolRows.map((r) => ({
      usuario_id: creado.user.id,
      rol_id: r.id,
      organizacion_id: r.nombre === "super_admin" ? null : input.organizacionId,
      centro_trabajo_id: r.nombre === "supervisor_centro" ? input.centroTrabajoId : null,
    })),
  );

  if (errorRol) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false as const, mensaje: errorRol.message };
  }

  let avisoFacilitador: string | null = null;
  if (roles.includes("facilitador") && input.organizacionId) {
    if (!(await vincularFichaFacilitador(creado.user.id, input.organizacionId))) {
      avisoFacilitador = AVISO_SIN_FICHA_FACILITADOR;
    }
  }

  revalidatePath("/usuarios");

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "crear_usuario",
    tabla: "usuarios",
    registroId: creado.user.id,
    datosNuevos: { nombres: input.nombres, apellidos: input.apellidos, roles, organizacionId: input.organizacionId },
  });

  const correo = await enviarCorreoBienvenida({
    nombres: input.nombres,
    email,
    password: passwordTemporal,
    rolLabel: roles.map((r) => ROL_LABEL[r]).join(", "),
    rut: `${run}-${dv}`,
    expiraEn,
  });

  if (!correo.ok) {
    // La cuenta ya existe; si el correo falla, entregamos la clave para respaldo manual.
    return {
      ok: true as const,
      emailEnviado: false as const,
      passwordTemporal,
      expiraEn,
      mensajeCorreo: correo.mensaje,
      avisoFacilitador,
    };
  }

  return { ok: true as const, emailEnviado: true as const, avisoFacilitador };
}

async function rolYaAsignado(
  admin: ReturnType<typeof createAdminClient>,
  usuarioId: string,
  rolId: string,
  organizacionId: string | null,
  centroTrabajoId: string | null,
) {
  let consulta = admin.from("usuario_roles").select("id").eq("usuario_id", usuarioId).eq("rol_id", rolId);
  consulta = organizacionId ? consulta.eq("organizacion_id", organizacionId) : consulta.is("organizacion_id", null);
  consulta = centroTrabajoId ? consulta.eq("centro_trabajo_id", centroTrabajoId) : consulta.is("centro_trabajo_id", null);
  const { data } = await consulta.limit(1);
  return (data ?? []).length > 0;
}

/**
 * RLS de ediciones/asistencias reconoce al facilitador por
 * facilitadores.usuario_id - sin este vínculo, una cuenta con rol
 * facilitador no ve ni puede gestionar sus ediciones.
 */
async function vincularFichaFacilitador(usuarioId: string, organizacionId: string) {
  const admin = createAdminClient();
  const { data: usuario } = await admin.from("usuarios").select("run").eq("id", usuarioId).maybeSingle();
  if (!usuario?.run) return false;
  const { data } = await admin
    .from("facilitadores")
    .update({ usuario_id: usuarioId })
    .eq("organizacion_id", organizacionId)
    .eq("run", usuario.run)
    .is("usuario_id", null)
    .select("id");
  if ((data ?? []).length > 0) return true;
  const { data: yaVinculado } = await admin
    .from("facilitadores")
    .select("id")
    .eq("organizacion_id", organizacionId)
    .eq("usuario_id", usuarioId)
    .limit(1);
  return (yaVinculado ?? []).length > 0;
}

export async function agregarRolUsuario(input: {
  usuarioId: string;
  organizacionId: string | null;
  rol: RolNombre;
  centroTrabajoId?: string | null;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  // Sobre la propia cuenta sólo se permite facilitador: no da ningún permiso
  // de gestión, así que no sirve para saltarse una revocación en Permisos.
  if (input.usuarioId === sesion.usuarioId && input.rol !== "facilitador") {
    return { ok: false as const, mensaje: "En tu propia cuenta sólo puedes agregarte el rol de facilitador." };
  }

  if (input.rol === "super_admin") {
    if (!sesion.esSuperAdmin) {
      return { ok: false as const, mensaje: "Sólo un super administrador puede asignar ese rol." };
    }
  } else {
    if (!input.organizacionId) return { ok: false as const, mensaje: "Selecciona una organización para este rol." };
    if (!(await tienePermiso(sesion, "usuarios.gestionar", input.organizacionId))) {
      return { ok: false as const, mensaje: "No tienes permiso para asignar roles en esta organización." };
    }
  }

  if (input.rol === "trabajador") {
    return {
      ok: false as const,
      mensaje: "El rol de trabajador se otorga desde el módulo Trabajadores (botón «Dar acceso»), no desde aquí.",
    };
  }

  const organizacionId = input.rol === "super_admin" ? null : input.organizacionId;
  const centroTrabajoId = input.rol === "supervisor_centro" ? (input.centroTrabajoId ?? null) : null;

  const admin = createAdminClient();

  const { data: rolRow } = await admin.from("roles").select("id").eq("nombre", input.rol).single();
  if (!rolRow) return { ok: false as const, mensaje: "Rol inválido." };

  if (await rolYaAsignado(admin, input.usuarioId, rolRow.id, organizacionId, centroTrabajoId)) {
    return { ok: false as const, mensaje: "Esta cuenta ya tiene ese rol." };
  }

  if (centroTrabajoId && organizacionId) {
    const { data: centro } = await admin
      .from("centros_trabajo")
      .select("id")
      .eq("id", centroTrabajoId)
      .eq("organizacion_id", organizacionId)
      .maybeSingle();
    if (!centro) return { ok: false as const, mensaje: "El centro no pertenece a esta organización." };
  }

  const supabase = await createClient();
  const { data: creado, error } = await supabase
    .from("usuario_roles")
    .insert({
      usuario_id: input.usuarioId,
      rol_id: rolRow.id,
      organizacion_id: organizacionId,
      centro_trabajo_id: centroTrabajoId,
    })
    .select("id")
    .single();

  if (error || !creado) return { ok: false as const, mensaje: error?.message ?? "No se pudo asignar el rol." };

  let avisoFacilitador: string | null = null;
  if (input.rol === "facilitador" && organizacionId) {
    const vinculado = await vincularFichaFacilitador(input.usuarioId, organizacionId);
    if (!vinculado) {
      avisoFacilitador = AVISO_SIN_FICHA_FACILITADOR;
    }
  }

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "agregar_rol",
    tabla: "usuario_roles",
    registroId: creado.id,
    datosNuevos: { rol: input.rol, organizacionId, centroTrabajoId, usuarioAfectado: input.usuarioId },
  });

  revalidatePath("/usuarios");
  return { ok: true as const, avisoFacilitador };
}

export async function quitarRolUsuario(input: { usuarioRolId: string; usuarioId: string }) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  const admin = createAdminClient();
  const { data: asignacion } = await admin
    .from("usuario_roles")
    .select("id, usuario_id, organizacion_id, roles(nombre)")
    .eq("id", input.usuarioRolId)
    .eq("usuario_id", input.usuarioId)
    .maybeSingle();
  if (!asignacion) return { ok: false as const, mensaje: "No se encontró esa asignación de rol." };

  const rol = asignacion.roles?.nombre;
  if (input.usuarioId === sesion.usuarioId && rol !== "facilitador") {
    return { ok: false as const, mensaje: "En tu propia cuenta sólo puedes quitarte el rol de facilitador." };
  }

  const autorizado =
    rol === "super_admin"
      ? sesion.esSuperAdmin
      : await tienePermiso(sesion, "usuarios.gestionar", asignacion.organizacion_id);
  if (!autorizado) return { ok: false as const, mensaje: "No tienes permiso para quitar este rol." };

  if (rol === "trabajador") {
    return {
      ok: false as const,
      mensaje: "El rol de trabajador está ligado a su registro en la matriz; se gestiona desde Trabajadores.",
    };
  }

  const { count } = await admin
    .from("usuario_roles")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", input.usuarioId);
  if ((count ?? 0) <= 1) {
    return {
      ok: false as const,
      mensaje: "Es el único rol de esta cuenta. Para quitarle el acceso, desactiva la cuenta.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("usuario_roles").delete().eq("id", input.usuarioRolId);
  if (error) return { ok: false as const, mensaje: error.message };

  if (rol === "facilitador" && asignacion.organizacion_id) {
    // Sin esto seguiría viendo y gestionando ediciones vía RLS
    // (facilitadores.usuario_id), aunque ya no tenga el rol.
    await admin
      .from("facilitadores")
      .update({ usuario_id: null })
      .eq("organizacion_id", asignacion.organizacion_id)
      .eq("usuario_id", input.usuarioId);
  }

  await registrarAuditoria(supabase, {
    usuarioId: sesion.usuarioId,
    accion: "quitar_rol",
    tabla: "usuario_roles",
    registroId: input.usuarioRolId,
    datosAnteriores: { rol, organizacionId: asignacion.organizacion_id, usuarioAfectado: input.usuarioId },
  });

  revalidatePath("/usuarios");
  return { ok: true as const };
}

export async function actualizarEstadoUsuario(input: {
  usuarioId: string;
  organizacionId: string | null;
  activo: boolean;
}) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false as const, mensaje: "No autenticado." };

  if (input.usuarioId === sesion.usuarioId) {
    return { ok: false as const, mensaje: "No puedes desactivar tu propia cuenta desde aquí." };
  }

  const autorizado = await tienePermiso(sesion, "usuarios.gestionar", input.organizacionId);

  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para modificar esta cuenta." };
  }

  // upd_usuarios_propio (RLS) sólo permite que cada quien edite su propio
  // perfil o que un super_admin edite cualquiera - un admin_organizacion no
  // puede tocar usuarios.activo de terceros con el cliente normal, así que
  // se usa el cliente admin. Como el cliente admin bypassa RLS, hay que
  // verificar aquí mismo que el usuario objetivo realmente pertenece a la
  // organización que el llamante administra (si no, cualquier admin_organizacion
  // podría desactivar la cuenta de cualquier persona con sólo conocer su UUID).
  const admin = createAdminClient();

  if (!sesion.esSuperAdmin && input.organizacionId) {
    const { data: rolEnOrg } = await admin
      .from("usuario_roles")
      .select("usuario_id")
      .eq("usuario_id", input.usuarioId)
      .eq("organizacion_id", input.organizacionId)
      .limit(1);

    if (!rolEnOrg?.length) {
      return { ok: false as const, mensaje: "Esa cuenta no pertenece a tu organización." };
    }
  }

  const { error } = await admin.from("usuarios").update({ activo: input.activo }).eq("id", input.usuarioId);

  if (error) return { ok: false as const, mensaje: error.message };

  await registrarAuditoria(admin, {
    usuarioId: sesion.usuarioId,
    accion: input.activo ? "reactivar_usuario" : "desactivar_usuario",
    tabla: "usuarios",
    registroId: input.usuarioId,
    datosNuevos: { activo: input.activo },
  });

  revalidatePath("/usuarios");
  return { ok: true as const };
}
