"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { actualizarPerfil, subirAvatar, exportarMisDatos, solicitarBajaCuenta } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function PerfilView({
  nombres,
  apellidos,
  email,
  telefono,
  rut,
  roles,
  avatarUrl,
}: {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  rut: string | null;
  roles: { rol: string; organizacion: string | null }[];
  avatarUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-8 max-w-xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Cuenta</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Mi perfil</h1>
      </div>

      <AvatarUploader nombres={nombres} apellidos={apellidos} avatarUrl={avatarUrl} />

      <DatosPersonales nombres={nombres} apellidos={apellidos} email={email} telefono={telefono} rut={rut} />

      <div>
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide mb-3">Roles asignados</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((r, i) => (
            <Badge key={i} variant="secondary" className="rounded-sm">
              {r.rol}
              {r.organizacion ? ` · ${r.organizacion}` : ""}
            </Badge>
          ))}
        </div>
      </div>

      <CambiarContrasena email={email} />

      <MisDatos />
    </div>
  );
}

function AvatarUploader({
  nombres,
  apellidos,
  avatarUrl,
}: {
  nombres: string;
  apellidos: string;
  avatarUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [urlActual, setUrlActual] = useState(avatarUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const iniciales = `${nombres[0] ?? ""}${apellidos[0] ?? ""}`.toUpperCase();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const formData = new FormData();
    formData.set("archivo", archivo);

    startTransition(async () => {
      const resultado = await subirAvatar(formData);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setUrlActual(resultado.avatarUrl);
      toast.success("Foto de perfil actualizada.");
    });

    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar size="lg" className="size-16">
          {urlActual && <AvatarImage src={urlActual} alt={`${nombres} ${apellidos}`} />}
          <AvatarFallback className="text-base">{iniciales}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          title="Cambiar foto"
          className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background disabled:opacity-50"
        >
          <Camera className="size-3.5" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      <div>
        <p className="text-sm font-medium">Foto de perfil</p>
        <p className="text-xs text-muted-foreground">JPG, PNG o WEBP. Máximo 3 MB.</p>
      </div>
    </div>
  );
}

function DatosPersonales({
  nombres: nombresInicial,
  apellidos: apellidosInicial,
  email,
  telefono: telefonoInicial,
  rut,
}: {
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  rut: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    nombres: nombresInicial,
    apellidos: apellidosInicial,
    telefono: telefonoInicial,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const resultado = await actualizarPerfil({
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        telefono: form.telefono.trim() || null,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Perfil actualizado.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Datos personales</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombres">Nombres</Label>
          <Input id="nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input id="apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rut">RUT (acceso)</Label>
          <Input id="rut" value={rut ?? "No asignado"} disabled className="font-mono" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" value={email} disabled />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}

function CambiarContrasena({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [actual, setActual] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!actual) {
      toast.error("Ingresa tu contraseña actual.");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmacion) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual });
      if (errorActual) {
        toast.error("La contraseña actual no es correcta.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Contraseña actualizada.");
      setActual("");
      setPassword("");
      setConfirmacion("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Cambiar contraseña</h2>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input id="actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmacion">Confirmar contraseña</Label>
          <Input id="confirmacion" type="password" autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={pending} variant="outline" className="w-fit">
        {pending ? "Actualizando…" : "Actualizar contraseña"}
      </Button>
    </form>
  );
}

function MisDatos() {
  const router = useRouter();
  const [pendingExport, startExport] = useTransition();
  const [pendingBaja, startBaja] = useTransition();
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  function onExportar() {
    startExport(async () => {
      const resultado = await exportarMisDatos();
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      const blob = new Blob([JSON.stringify(resultado.datos, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mis-datos-capapp.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Descarga lista.");
    });
  }

  function onSolicitarBaja() {
    if (!confirmandoBaja) {
      setConfirmandoBaja(true);
      return;
    }
    startBaja(async () => {
      const resultado = await solicitarBajaCuenta();
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Mis datos</h2>
      <p className="text-sm text-muted-foreground">
        Conforme a la Ley N.º 21.719, puedes descargar una copia de tus datos personales o solicitar la baja de tu
        cuenta. Ver <Link href="/privacidad" className="underline hover:text-foreground">política de privacidad</Link>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pendingExport} onClick={onExportar} className="w-fit">
          {pendingExport ? "Preparando…" : "Descargar mis datos"}
        </Button>
        <Button
          type="button"
          variant={confirmandoBaja ? "destructive" : "outline"}
          disabled={pendingBaja}
          onClick={onSolicitarBaja}
          className="w-fit"
        >
          {pendingBaja
            ? "Procesando…"
            : confirmandoBaja
              ? "Confirmar baja de mi cuenta"
              : "Solicitar baja de mi cuenta"}
        </Button>
      </div>
      {confirmandoBaja && !pendingBaja && (
        <p className="text-xs text-muted-foreground max-w-md">
          Esto desactiva tu acceso a Capapp de inmediato. Tus registros de capacitación se conservan según lo exige
          el DS 44, incluso después de la baja.
        </p>
      )}
    </div>
  );
}
