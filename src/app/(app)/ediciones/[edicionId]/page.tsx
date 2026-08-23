import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";
import { estadoVigenciaDeCurso } from "@/lib/vigencia";
import { EdicionView } from "./edicion-view";

const ROLES_DETALLE = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

export default async function EdicionDetallePage({
  params,
}: {
  params: Promise<{ edicionId: string }>;
}) {
  const { edicionId } = await params;
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const [{ data: edicion }, { data: miFacilitador }] = await Promise.all([
    supabase
      .from("ediciones_curso")
      .select(
        "id, fecha_inicio, fecha_limite, estado, curso_id, organizacion_id, facilitador_id, cursos(nombre), facilitadores(nombres, apellidos), centros_trabajo(nombre)",
      )
      .eq("id", edicionId)
      .maybeSingle(),
    supabase.from("facilitadores").select("id").eq("usuario_id", sesion.usuarioId).maybeSingle(),
  ]);

  if (!edicion) notFound();

  const esAdminOrgOPrevencionista = sesion.roles.some(
    (r) => (r.rol === "admin_organizacion" || r.rol === "prevencionista") && r.organizacionId === edicion.organizacion_id,
  );
  const esFacilitadorDeEstaEdicion = miFacilitador?.id != null && miFacilitador.id === edicion.facilitador_id;
  const puedeVer =
    sesion.esSuperAdmin ||
    esFacilitadorDeEstaEdicion ||
    sesion.roles.some(
      (r) => ROLES_DETALLE.includes(r.rol as (typeof ROLES_DETALLE)[number]) && r.organizacionId === edicion.organizacion_id,
    );
  if (!puedeVer) redirect("/dashboard");

  const [{ data: modulos }, { data: inscripciones }, { data: vinculosOrg }, { data: aprobadosDelCurso }] =
    await Promise.all([
      supabase.from("modulos").select("id, orden, nombre").eq("curso_id", edicion.curso_id).order("orden"),
      supabase
        .from("inscripciones")
        .select(
          "id, estado, fecha_inscripcion, fecha_aprobacion, vigencia_hasta, manual_entregado, manual_entregado_fecha, personas(run, nombres, apellido_paterno, dv), asistencias_modulo(modulo_id, presente), evaluaciones_resultado(id, puntaje, aprobado, modulo_id), certificados(id, numero_certificado)",
        )
        .eq("edicion_id", edicionId)
        .order("fecha_inscripcion"),
      supabase
        .from("vinculos_laborales")
        .select("persona_run, personas(run, nombres, apellido_paterno, dv)")
        .eq("organizacion_id", edicion.organizacion_id)
        .eq("activo", true)
        .order("persona_run"),
      // Vigencia de este mismo curso en cualquiera de sus ediciones — para no
      // ofrecer inscribir a quien ya lo tiene vigente (ver más abajo).
      supabase
        .from("inscripciones")
        .select("persona_run, fecha_aprobacion, vigencia_hasta, ediciones_curso!inner(curso_id, organizacion_id)")
        .eq("estado", "aprobado")
        .eq("ediciones_curso.curso_id", edicion.curso_id)
        .eq("ediciones_curso.organizacion_id", edicion.organizacion_id),
    ]);

  const idsInscritos = new Set((inscripciones ?? []).map((i) => i.personas?.run));

  // Si el mismo curso se aprobó más de una vez, sólo la aprobación más
  // reciente de cada persona cuenta para decidir si aún lo tiene vigente.
  const vigenciaPorPersona = new Map<string, { fechaAprobacion: string | null; vigenciaHasta: string | null }>();
  for (const i of aprobadosDelCurso ?? []) {
    const previa = vigenciaPorPersona.get(i.persona_run);
    if (!previa || (i.fecha_aprobacion ?? "") > (previa.fechaAprobacion ?? "")) {
      vigenciaPorPersona.set(i.persona_run, { fechaAprobacion: i.fecha_aprobacion, vigenciaHasta: i.vigencia_hasta });
    }
  }
  const personasConEsteCursoVigente = new Set(
    [...vigenciaPorPersona.entries()]
      .filter(([, v]) => estadoVigenciaDeCurso(v.vigenciaHasta) === "vigente")
      .map(([run]) => run),
  );

  const disponibles = (vinculosOrg ?? [])
    .filter((v) => !idsInscritos.has(v.persona_run) && !personasConEsteCursoVigente.has(v.persona_run))
    .map((v) => v.personas)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.nombres.localeCompare(b.nombres, "es"));

  // Inscribir trabajadores (decidir quién toma el curso) es una decisión de gestión.
  const puedeInscribir = sesion.esSuperAdmin || esAdminOrgOPrevencionista;
  // Tomar asistencia y calificar es responsabilidad de quien dicta el curso.
  const puedeGestionarAsistencia = puedeInscribir || esFacilitadorDeEstaEdicion;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/cursos/${edicion.curso_id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {edicion.cursos?.nombre}
        </Link>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
          Edición · {edicion.fecha_inicio}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Límite {edicion.fecha_limite}
          {edicion.facilitadores ? ` · Facilitador: ${edicion.facilitadores.nombres} ${edicion.facilitadores.apellidos}` : " · Sin facilitador asignado"}
          {edicion.centros_trabajo ? ` · ${edicion.centros_trabajo.nombre}` : ""}
        </p>
      </div>

      <EdicionView
        edicionId={edicionId}
        cursoId={edicion.curso_id}
        modulos={modulos ?? []}
        inscripciones={inscripciones ?? []}
        disponibles={disponibles}
        puedeInscribir={puedeInscribir}
        puedeGestionarAsistencia={puedeGestionarAsistencia}
      />
    </div>
  );
}
