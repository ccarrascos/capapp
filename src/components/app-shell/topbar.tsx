"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Menu, LogOut, ChevronDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { RolNombre } from "@/lib/auth";
import { navParaRoles } from "./nav-config";
import Link from "next/link";

const ROL_LABEL: Record<RolNombre, string> = {
  super_admin: "Super administrador",
  admin_organizacion: "Administrador de organización",
  prevencionista: "Prevencionista",
  facilitador: "Facilitador",
  supervisor_centro: "Supervisor de centro",
  auditor: "Auditor",
  trabajador: "Trabajador",
};

function iniciales(nombres: string, apellidos: string) {
  return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

export function Topbar({
  nombres,
  apellidos,
  rolPrincipal,
  organizacionActual,
  rolesUsuario,
  esSuperAdmin,
}: {
  nombres: string;
  apellidos: string;
  rolPrincipal: RolNombre;
  organizacionActual: string | null;
  rolesUsuario: RolNombre[];
  esSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const items = navParaRoles(rolesUsuario, esSuperAdmin);

  function cerrarSesion() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <nav className="flex flex-col gap-0.5 p-3 pt-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <item.icon className="size-4.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        {organizacionActual && (
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {organizacionActual}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent" />
          }
        >
          <Avatar className="size-8 rounded-sm">
            <AvatarFallback className="rounded-sm bg-primary text-primary-foreground text-xs font-semibold">
              {iniciales(nombres, apellidos)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">
              {nombres} {apellidos}
            </span>
            <span className="text-[11px] text-muted-foreground">{ROL_LABEL[rolPrincipal]}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            {nombres} {apellidos}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/perfil" />}>
            <UserRound className="size-4" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={pending} onClick={cerrarSesion} variant="destructive">
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
