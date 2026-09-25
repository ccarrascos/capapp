import type { RolNombre } from "@/lib/auth";

export const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Admin. organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

export const ROLES_ASIGNABLES: RolNombre[] = [
  "admin_organizacion",
  "prevencionista",
  "facilitador",
  "supervisor_centro",
  "auditor",
];
