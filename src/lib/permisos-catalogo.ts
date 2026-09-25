import type { RolNombre } from "@/lib/auth";

export type ModuloPermiso = "estructura" | "personas" | "capacitacion" | "herramientas";

export const MODULOS_PERMISO: { id: ModuloPermiso; titulo: string }[] = [
  { id: "estructura", titulo: "Estructura de la organización" },
  { id: "personas", titulo: "Trabajadores y cuentas" },
  { id: "capacitacion", titulo: "Capacitación" },
  { id: "herramientas", titulo: "Herramientas" },
];

export const ROLES_CONFIGURABLES: { rol: RolNombre; etiqueta: string }[] = [
  { rol: "admin_organizacion", etiqueta: "Admin. organización" },
  { rol: "prevencionista", etiqueta: "Prevencionista" },
  { rol: "supervisor_centro", etiqueta: "Supervisor de centro" },
  { rol: "auditor", etiqueta: "Auditor" },
];

// `roles` es el máximo que hoy permiten las políticas RLS de la base: desde
// el panel sólo se puede quitar un permiso de esta lista, nunca agregar uno
// fuera de ella (la base lo rechazaría igual).
export const CATALOGO_PERMISOS = {
  "cargos.gestionar": {
    modulo: "estructura",
    etiqueta: "Crear y editar cargos",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "centros.gestionar": {
    modulo: "estructura",
    etiqueta: "Crear y editar centros de trabajo",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "subcontratos.gestionar": {
    modulo: "estructura",
    etiqueta: "Gestionar subcontratos",
    roles: ["admin_organizacion"],
  },
  "organizacion.editar_logo": {
    modulo: "estructura",
    etiqueta: "Cambiar el logo de la organización",
    roles: ["admin_organizacion"],
  },
  "organizacion.configurar": {
    modulo: "estructura",
    etiqueta: "Ajustar parámetros propios de la organización",
    roles: ["admin_organizacion"],
  },
  "trabajadores.gestionar": {
    modulo: "personas",
    etiqueta: "Agregar, editar y cargar trabajadores",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "trabajadores.dar_acceso": {
    modulo: "personas",
    etiqueta: "Dar acceso a la app a un trabajador",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "trabajadores.ver_detalle": {
    modulo: "personas",
    etiqueta: "Ver detalle y credencial QR de un trabajador",
    roles: ["admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
  "personas.buscar_por_run": {
    modulo: "personas",
    etiqueta: "Buscar personas por RUN",
    roles: ["admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
  "usuarios.gestionar": {
    modulo: "personas",
    etiqueta: "Crear cuentas, cambiar roles y desactivar usuarios",
    roles: ["admin_organizacion"],
  },
  "facilitadores.gestionar": {
    modulo: "personas",
    etiqueta: "Crear y editar facilitadores",
    roles: ["admin_organizacion"],
  },
  "cursos.gestionar": {
    modulo: "capacitacion",
    etiqueta: "Crear cursos y subir materiales",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "ediciones.crear": {
    modulo: "capacitacion",
    etiqueta: "Crear ediciones de un curso",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "ediciones.inscribir": {
    modulo: "capacitacion",
    etiqueta: "Inscribir trabajadores en ediciones",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "ediciones.gestionar": {
    modulo: "capacitacion",
    etiqueta: "Registrar asistencia, evaluaciones y entrega de manual",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "certificados.emitir": {
    modulo: "capacitacion",
    etiqueta: "Emitir certificados",
    roles: ["admin_organizacion", "prevencionista"],
  },
  "certificados.ver": {
    modulo: "capacitacion",
    etiqueta: "Ver certificados de la organización",
    roles: ["admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
  "ia.usar": {
    modulo: "herramientas",
    etiqueta: "Usar el asistente IA",
    roles: ["admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
} as const satisfies Record<string, { modulo: ModuloPermiso; etiqueta: string; roles: readonly RolNombre[] }>;

export type AccionPermiso = keyof typeof CATALOGO_PERMISOS;

export function rolPuedeTenerPermiso(accion: AccionPermiso, rol: RolNombre): boolean {
  return (CATALOGO_PERMISOS[accion].roles as readonly RolNombre[]).includes(rol);
}
