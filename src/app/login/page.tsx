"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldHalf, TriangleAlert, Eye, EyeOff } from "lucide-react";
import { parsearRut, formatearRutInput } from "@/lib/rut";
import { iniciarSesionConRut } from "./actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parsearRut(rut);
    if (!parsed) {
      setError("Ingresa un RUT válido, por ejemplo 12.345.678-9.");
      return;
    }

    startTransition(async () => {
      const resultado = await iniciarSesionConRut({ run: parsed.run, dv: parsed.dv, password });
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      const next = searchParams.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldHalf className="size-6" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-2xl tracking-wide uppercase">Capapp</span>
        </div>

        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/50 mb-3">
            DS N.º 44/2023 · Artículo 16
          </p>
          <h1 className="font-heading text-5xl font-bold leading-[0.95] uppercase tracking-tight">
            Capacitación
            <br />
            en prevención
            <br />
            de riesgos
          </h1>
          <p className="mt-5 text-sm text-sidebar-foreground/70 leading-relaxed">
            Matriz de vigencia, cursos, evaluaciones y certificación — trazable y verificable
            para fiscalización, conforme a la Guía Técnica del Ministerio del Trabajo.
          </p>
        </div>

        <div className="hazard-stripe h-2 w-full absolute bottom-0 left-0" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <ShieldHalf className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-heading text-xl tracking-wide uppercase">Capapp</span>
          </div>

          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight mb-1">
            Iniciar sesión
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Ingresa con el RUT y la contraseña que te asignó tu organización.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rut">RUT</Label>
              <Input
                id="rut"
                autoComplete="username"
                required
                value={rut}
                onChange={(e) => setRut(formatearRutInput(e.target.value))}
                placeholder="12.345.678-9"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-2 rounded-sm border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                <TriangleAlert className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Verificando…" : "Ingresar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
