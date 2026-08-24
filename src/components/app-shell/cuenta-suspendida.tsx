"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldHalf, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function CuentaSuspendida() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function cerrarSesion() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldHalf className="size-5" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-xl tracking-wide uppercase">Capapp</span>
        </div>
        <div className="border border-alert/30 bg-alert/10 p-6 text-center flex flex-col items-center gap-3">
          <TriangleAlert className="size-8 text-alert" />
          <h1 className="font-heading text-lg font-bold uppercase tracking-tight">
            Organización desactivada
          </h1>
          <p className="text-sm text-muted-foreground">
            El acceso a tu organización está temporalmente desactivado. Contacta a quien la
            administra para regularizar la situación.
          </p>
          <Button variant="outline" disabled={pending} onClick={cerrarSesion} className="mt-2">
            {pending ? "Cerrando sesión…" : "Cerrar sesión"}
          </Button>
        </div>
      </div>
    </div>
  );
}
