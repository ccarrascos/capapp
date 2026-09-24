"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClaveConfiguracion } from "@/lib/configuracion";
import type { RolNombre } from "@/lib/auth";
import {
  CATALOGO_PERMISOS,
  MODULOS_PERMISO,
  ROLES_CONFIGURABLES,
  rolPuedeTenerPermiso,
  type AccionPermiso,
} from "@/lib/permisos-catalogo";
import {
  CAMPOS_CONFIGURACION,
  CAMPOS_ORGANIZACION,
  GRUPOS_CONFIGURACION,
  rangoCampoOrganizacion,
  type CampoConfiguracion,
  type CampoOrganizacion,
} from "@/lib/configuracion-campos";
import { actualizarConfiguracion, actualizarConfiguracionOrganizacion, actualizarPermiso } from "./actions";

export type ValorActual = {
  valor: number;
  porDefecto: number;
  actualizadoEn: string | null;
};

export type OrganizacionConfigurable = {
  id: string;
  razonSocial: string;
  valores: Record<CampoOrganizacion["clave"], number | null>;
};

export function ConfiguracionView({
  esSuperAdmin,
  valores,
  revocados,
  permisosDisponibles,
  organizaciones,
  organizacionesDisponibles,
}: {
  esSuperAdmin: boolean;
  valores: Record<ClaveConfiguracion, ValorActual>;
  revocados: string[];
  permisosDisponibles: boolean;
  organizaciones: OrganizacionConfigurable[];
  organizacionesDisponibles: boolean;
}) {
  const seccionOrganizacion = organizacionesDisponibles ? (
    <ConfiguracionOrganizacion organizaciones={organizaciones} plataforma={valores} />
  ) : (
    <p className="border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
      Falta correr la migración 0031_configuracion_por_organizacion.sql en Supabase para habilitar esta sección.
    </p>
  );

  if (!esSuperAdmin) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Administración de la organización</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Ajustes propios de tu organización. Si dejas un campo vacío se usa el valor de la plataforma. Cada
            cambio queda registrado en Auditoría.
          </p>
        </div>
        {seccionOrganizacion}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Alcance super administrador</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Aplica a toda la plataforma. Cada cambio queda registrado en Auditoría y puede tardar hasta 30 segundos
          en reflejarse en todas las pantallas.
        </p>
      </div>

      <Tabs defaultValue="parametros">
        <TabsList>
          <TabsTrigger value="parametros">Parámetros</TabsTrigger>
          <TabsTrigger value="organizaciones">Organizaciones</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="parametros" className="mt-4">
          <Parametros valores={valores} />
        </TabsContent>
        <TabsContent value="organizaciones" className="mt-4">
          {seccionOrganizacion}
        </TabsContent>
        <TabsContent value="permisos" className="mt-4">
          {permisosDisponibles ? (
            <Permisos revocadosIniciales={revocados} />
          ) : (
            <p className="border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              Falta correr la migración 0030_permisos_revocados.sql en Supabase para habilitar esta sección.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfiguracionOrganizacion({
  organizaciones,
  plataforma,
}: {
  organizaciones: OrganizacionConfigurable[];
  plataforma: Record<ClaveConfiguracion, ValorActual>;
}) {
  const [organizacionId, setOrganizacionId] = useState(organizaciones[0]?.id ?? "");
  const organizacion = organizaciones.find((o) => o.id === organizacionId);

  if (!organizacion) {
    return <p className="text-sm text-muted-foreground">No hay organizaciones para configurar.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {organizaciones.length > 1 && (
        <div className="flex flex-col gap-1.5 max-w-sm">
          <Label htmlFor="cfg-organizacion">Organización</Label>
          <select
            id="cfg-organizacion"
            value={organizacionId}
            onChange={(e) => setOrganizacionId(e.target.value)}
            className="h-9 border border-input bg-transparent px-3 text-sm rounded-md"
          >
            {organizaciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.razonSocial}
              </option>
            ))}
          </select>
        </div>
      )}
      <section className="border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">{organizacion.razonSocial}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deja un campo vacío para usar el valor de la plataforma. Horas y plazo aplican a cursos y ediciones
            que se creen desde ahora.
          </p>
        </div>
        <div className="divide-y divide-border">
          {CAMPOS_ORGANIZACION.map((campo) => (
            <CampoOrganizacionFila
              key={`${organizacion.id}-${campo.clave}`}
              organizacionId={organizacion.id}
              campo={campo}
              propio={organizacion.valores[campo.clave]}
              plataforma={plataforma[campo.clave].valor}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CampoOrganizacionFila({
  organizacionId,
  campo,
  propio,
  plataforma,
}: {
  organizacionId: string;
  campo: CampoOrganizacion;
  propio: number | null;
  plataforma: number;
}) {
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(propio);
  const [texto, setTexto] = useState(propio === null ? "" : String(propio));
  const { min, max } = rangoCampoOrganizacion(campo.clave, plataforma);

  const vacio = texto.trim() === "";
  const numero = Number(texto);
  const valido = vacio || (Number.isInteger(numero) && numero >= min && numero <= max);
  const nuevo = vacio ? null : numero;
  const cambiado = valido && nuevo !== guardado;
  const idInput = `cfg-org-${campo.clave}`;

  function guardar(valor: number | null) {
    startTransition(async () => {
      const resultado = await actualizarConfiguracionOrganizacion({ organizacionId, clave: campo.clave, valor });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setGuardado(valor);
      setTexto(valor === null ? "" : String(valor));
      toast.success(
        valor === null
          ? `${campo.etiqueta}: se usa el valor de la plataforma (${plataforma} ${campo.unidad}).`
          : `${campo.etiqueta}: ${valor} ${campo.unidad}.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <Label htmlFor={idInput} className="text-sm font-medium">
          {campo.etiqueta}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">{campo.ayuda}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Plataforma: {plataforma} {campo.unidad} · Rango {min}–{max}
          {guardado === null ? " · Usando el valor de la plataforma" : ""}
        </p>
      </div>
      <form
        className="flex items-center gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (cambiado) guardar(nuevo);
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            id={idInput}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            placeholder={String(plataforma)}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-invalid={!valido}
            className="w-24 font-mono"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground w-14">{campo.unidad}</span>
        </div>
        <Button type="submit" size="sm" disabled={!cambiado || pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Usar el valor de la plataforma"
          aria-label="Usar el valor de la plataforma"
          disabled={pending || guardado === null}
          onClick={() => guardar(null)}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

function Parametros({ valores }: { valores: Record<ClaveConfiguracion, ValorActual> }) {
  return (
    <div className="flex flex-col gap-8">
      {GRUPOS_CONFIGURACION.map((grupo) => (
        <section key={grupo.id} className="border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide">{grupo.titulo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{grupo.descripcion}</p>
          </div>
          <div className="divide-y divide-border">
            {CAMPOS_CONFIGURACION.filter((c) => c.grupo === grupo.id).map((campo) => (
              <CampoFila key={campo.clave} campo={campo} actual={valores[campo.clave]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CampoFila({ campo, actual }: { campo: CampoConfiguracion; actual: ValorActual }) {
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(actual.valor);
  const [texto, setTexto] = useState(String(actual.valor));

  const numero = Number(texto);
  const valido = texto.trim() !== "" && Number.isInteger(numero) && numero >= campo.min && numero <= campo.max;
  const cambiado = valido && numero !== guardado;
  const idInput = `cfg-${campo.clave}`;

  function guardar(valor: number) {
    startTransition(async () => {
      const resultado = await actualizarConfiguracion({ clave: campo.clave, valor });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setGuardado(valor);
      setTexto(String(valor));
      toast.success(`${campo.etiqueta}: ${valor} ${campo.unidad}.`);
    });
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <Label htmlFor={idInput} className="text-sm font-medium">
          {campo.etiqueta}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">{campo.ayuda}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Por defecto: {actual.porDefecto} {campo.unidad} · Rango {campo.min}–{campo.max}
        </p>
      </div>
      <form
        className="flex items-center gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (cambiado) guardar(numero);
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            id={idInput}
            type="number"
            inputMode="numeric"
            min={campo.min}
            max={campo.max}
            step={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-invalid={!valido}
            className="w-24 font-mono"
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground w-14">{campo.unidad}</span>
        </div>
        <Button type="submit" size="sm" disabled={!cambiado || pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="Restablecer valor por defecto"
          aria-label="Restablecer valor por defecto"
          disabled={pending || guardado === actual.porDefecto}
          onClick={() => guardar(actual.porDefecto)}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

function Permisos({ revocadosIniciales }: { revocadosIniciales: string[] }) {
  const [revocados, setRevocados] = useState(() => new Set(revocadosIniciales));
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const acciones = Object.entries(CATALOGO_PERMISOS) as [AccionPermiso, (typeof CATALOGO_PERMISOS)[AccionPermiso]][];

  function alternar(rol: RolNombre, accion: AccionPermiso, etiqueta: string) {
    const llave = `${rol}:${accion}`;
    const permitido = revocados.has(llave);
    setPendiente(llave);
    startTransition(async () => {
      const resultado = await actualizarPermiso({ rol, accion, permitido });
      setPendiente(null);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setRevocados((prev) => {
        const next = new Set(prev);
        if (permitido) next.delete(llave);
        else next.add(llave);
        return next;
      });
      const nombreRol = ROLES_CONFIGURABLES.find((r) => r.rol === rol)?.etiqueta ?? rol;
      toast.success(`${nombreRol}: ${permitido ? "puede" : "ya no puede"} ${etiqueta.toLowerCase()}.`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground flex flex-col gap-1">
        <p>
          Desmarca una casilla para quitarle ese permiso a un rol en todas las organizaciones. El super administrador
          siempre tiene acceso completo y no aparece aquí.
        </p>
        <p>
          Las casillas con — no se pueden activar: la base de datos no permite esa acción a ese rol. Quitar un
          permiso lo bloquea en la aplicación; para un bloqueo también a nivel de base de datos hace falta un
          cambio de esquema.
        </p>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium px-4 py-3">Permiso</th>
              {ROLES_CONFIGURABLES.map((r) => (
                <th key={r.rol} className="font-medium px-3 py-3 text-center text-xs whitespace-nowrap">
                  {r.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          {MODULOS_PERMISO.map((modulo) => (
            <tbody key={modulo.id} className="border-b border-border last:border-b-0">
              <tr className="bg-muted/50">
                <td
                  colSpan={ROLES_CONFIGURABLES.length + 1}
                  className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {modulo.titulo}
                </td>
              </tr>
              {acciones
                .filter(([, def]) => def.modulo === modulo.id)
                .map(([accion, def]) => (
                  <tr key={accion} className="border-t border-border">
                    <td className="px-4 py-2.5">{def.etiqueta}</td>
                    {ROLES_CONFIGURABLES.map(({ rol, etiqueta }) => {
                      const llave = `${rol}:${accion}`;
                      if (!rolPuedeTenerPermiso(accion, rol)) {
                        return (
                          <td
                            key={rol}
                            className="px-3 py-2.5 text-center text-muted-foreground/50"
                            title="La base de datos no permite esta acción a este rol"
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={rol} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary cursor-pointer disabled:cursor-wait"
                            checked={!revocados.has(llave)}
                            disabled={pendiente !== null}
                            aria-label={`${etiqueta}: ${def.etiqueta}`}
                            onChange={() => alternar(rol, accion, def.etiqueta)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
