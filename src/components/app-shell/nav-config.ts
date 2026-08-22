import type { RolNombre } from "@/lib/auth";
import {
  LayoutGrid,
  GraduationCap,
  Building2,
  ShieldCheck,
  ClipboardList,
  UserCog,
  UserCog2,
  Landmark,
  Briefcase,
  BarChart3,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  roles: RolNombre[] | "all";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutGrid, roles: "all" },
  {
    href: "/trabajadores",
    label: "Matriz de vigencia",
    icon: ShieldCheck,
    roles: ["super_admin", "admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
  {
    href: "/analitica",
    label: "Analítica",
    icon: BarChart3,
    roles: ["super_admin", "admin_organizacion", "prevencionista", "supervisor_centro", "auditor"],
  },
  {
    href: "/cursos",
    label: "Cursos y ediciones",
    icon: GraduationCap,
    roles: ["super_admin", "admin_organizacion", "prevencionista"],
  },
  {
    href: "/facilitadores",
    label: "Facilitadores",
    icon: UserCog2,
    roles: ["super_admin", "admin_organizacion", "prevencionista"],
  },
  {
    href: "/mis-ediciones",
    label: "Mis ediciones",
    icon: ClipboardList,
    roles: ["facilitador"],
  },
  {
    href: "/mi-capacitacion",
    label: "Mi capacitación",
    icon: GraduationCap,
    roles: ["trabajador"],
  },
  {
    href: "/centros",
    label: "Centros de trabajo",
    icon: Building2,
    roles: ["super_admin", "admin_organizacion"],
  },
  {
    href: "/cargos",
    label: "Cargos",
    icon: Briefcase,
    roles: ["super_admin", "admin_organizacion", "prevencionista"],
  },
  {
    href: "/usuarios",
    label: "Usuarios y roles",
    icon: UserCog,
    roles: ["super_admin", "admin_organizacion"],
  },
  {
    href: "/organizaciones",
    label: "Organizaciones",
    icon: Landmark,
    roles: ["super_admin"],
  },
];

export function navParaRoles(rolesUsuario: RolNombre[], esSuperAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      item.roles === "all" ||
      esSuperAdmin ||
      item.roles.some((r) => rolesUsuario.includes(r)),
  );
}
