import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { NuevaEdicionDialog } from "./nueva-edicion-dialog";
import { FileField } from "@/components/materiales/file-field";
import { guardarManualCurso, guardarMaterialModulo } from "./materiales-actions";

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

const TEMA_LABEL: Record<string, string> = {
  introduccion: "Introducción",
  marco_general_sst: "Marco general SST",
  identificacion_peligros_evaluacion_riesgos: "Identificación de peligros y riesgos",
  riesgos_laborales_efectos_salud: "Riesgos laborales y efectos en salud",
  medidas_preventivas_proteccion: "Medidas preventivas y protección",
  gestion_emergencias_desastres: "Gestión de emergencias y desastres",
  senalizacion_prevencion_incendios: "Señalización y prevención de incendios",
};

export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ cursoId: string }>;
}) {
  const { cursoId } = await params;
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: curso }, { data: miFacilitador }] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle(),
    supabase.from("facilitadores").select("id, organizacion_id").eq("usuario_id", sesion.usuarioId).maybeSingle(),
  ]);

  if (!curso) notFound();

  const puedeGestionar = sesion.esSuperAdmin || sesion.roles.some(
    (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === curso.organizacion_id,
  );
  const esFacilitadorDeLaOrg = miFacilitador?.organizacion_id != null && miFacilitador.organizacion_id === curso.organizacion_id;
  const puedeVer =
    sesion.esSuperAdmin ||
    esFacilitadorDeLaOrg ||
    sesion.roles.some(
      (r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]) && r.organizacionId === curso.organizacion_id,
    );
  if (!puedeVer) redirect("/dashboard");

  const [{ data: modulos }, { data: ediciones }, { data: facilitadores }, { data: centros }] = await Promise.all([
    supabase.from("modulos").select("*").eq("curso_id", cursoId).order("orden"),
    supabase
      .from("ediciones_curso")
      .select("id, fecha_inicio, fecha_limite, estado, facilitadores(nombres, apellidos), centros_trabajo(nombre), inscripciones(id)")
      .eq("curso_id", cursoId)
      .order("fecha_inicio", { ascending: false }),
    supabase.from("facilitadores").select("id, nombres, apellidos").eq("activo", true),
    supabase.from("centros_trabajo").select("id, nombre"),
  ]);

  const storagePrefixCurso = `${curso.organizacion_id}/cursos/${cursoId}`;

  async function guardarManualParticipante(path: string) {
    "use server";
    return guardarManualCurso({ cursoId, campo: "manual_participante_path", path });
  }

  async function guardarManualFacilitador(path: string) {
    "use server";
    return guardarManualCurso({ cursoId, campo: "manual_facilitador_path", path });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/cursos" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Cursos
        </Link>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">{curso.nombre}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {curso.horas_totales} horas totales · {curso.tipo_proveedor}
        </p>
      </div>

      {puedeGestionar && (
        <div>
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide mb-1">
            Materiales del curso
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Anexo Metodológico, punto 5 — deben entregarse a cada participante antes del inicio.
          </p>
          <div className="flex flex-col gap-2">
            <FileField
              label="Manual del participante"
              path={curso.manual_participante_path}
              storagePathPrefix={storagePrefixCurso}
              fileName="manual-participante"
              onGuardarPath={guardarManualParticipante}
            />
            <FileField
              label="Manual del facilitador"
              path={curso.manual_facilitador_path}
              storagePathPrefix={storagePrefixCurso}
              fileName="manual-facilitador"
              onGuardarPath={guardarManualFacilitador}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide mb-3">Módulos</h2>
        <div className="border border-border bg-card divide-y divide-border">
          {(modulos ?? []).map((m) => (
            <ModuloRow
              key={m.id}
              modulo={m}
              cursoId={cursoId}
              storagePrefixCurso={storagePrefixCurso}
              puedeGestionar={puedeGestionar}
            />
          ))}
          {(modulos ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">Este curso no tiene módulos definidos.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Ediciones (cohortes)</h2>
          {puedeGestionar && (
            <NuevaEdicionDialog
              cursoId={cursoId}
              organizacionId={curso.organizacion_id!}
              facilitadores={facilitadores ?? []}
              centros={centros ?? []}
            />
          )}
        </div>
        <div className="border border-border bg-card divide-y divide-border">
          {(ediciones ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/ediciones/${e.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-accent/40"
            >
              <div>
                <p className="font-medium text-sm">
                  Inicio {e.fecha_inicio} · Límite {e.fecha_limite}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.facilitadores ? `${e.facilitadores.nombres} ${e.facilitadores.apellidos}` : "Sin facilitador asignado"}
                  {e.centros_trabajo ? ` · ${e.centros_trabajo.nombre}` : ""}
                  {" · "}
                  {e.inscripciones?.length ?? 0} inscritos
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground capitalize">
                {e.estado.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
          {(ediciones ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aún no hay ediciones (cohortes) de este curso.</p>
          )}
        </div>
      </div>
    </div>
  );
}

async function ModuloRow({
  modulo,
  cursoId,
  storagePrefixCurso,
  puedeGestionar,
}: {
  modulo: {
    id: string;
    orden: number;
    nombre: string;
    tema: string;
    duracion_horas: number;
    modalidad: string;
    material_path: string | null;
  };
  cursoId: string;
  storagePrefixCurso: string;
  puedeGestionar: boolean;
}) {
  async function guardarMaterial(path: string) {
    "use server";
    return guardarMaterialModulo({ moduloId: modulo.id, cursoId, path });
  }

  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">
            {modulo.orden}. {modulo.nombre}
          </p>
          <p className="text-xs text-muted-foreground">{TEMA_LABEL[modulo.tema] ?? modulo.tema}</p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <p>{modulo.duracion_horas} h</p>
          <p className="capitalize">{modulo.modalidad.replace(/_/g, " ")}</p>
        </div>
      </div>
      {puedeGestionar && (
        <FileField
          label="Material didáctico"
          path={modulo.material_path}
          storagePathPrefix={`${storagePrefixCurso}/modulos/${modulo.id}`}
          fileName="material"
          onGuardarPath={guardarMaterial}
        />
      )}
    </div>
  );
}
