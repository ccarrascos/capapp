"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navParaRoles } from "./nav-config";
import type { RolNombre } from "@/lib/auth";
import { ShieldHalf } from "lucide-react";

export function Sidebar({
  rolesUsuario,
  esSuperAdmin,
}: {
  rolesUsuario: RolNombre[];
  esSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = navParaRoles(rolesUsuario, esSuperAdmin);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <span className="flex size-8 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
          <ShieldHalf className="size-5" strokeWidth={2.4} />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-lg tracking-wide uppercase">Capapp</p>
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            DS 44 · Art. 16
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="flex flex-col gap-0.5 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" strokeWidth={2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hazard-stripe h-1.5 w-full" />
    </aside>
  );
}
