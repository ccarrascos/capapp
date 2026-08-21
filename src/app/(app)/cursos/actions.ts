"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type TemaModulo = Database["public"]["Enums"]["tema_modulo"];
type ModalidadEjecucion = Database["public"]["Enums"]["modalidad_ejecucion"];

/** Los 7 bloques de contenido mínimo exigidos por el Anexo Metodológico, art. 16 DS 44. */
const MODULOS_DS44: {
  tema: TemaModulo;
  nombre: string;
  duracionHoras: number;
}[] = [
  { tema: "introduccion", nombre: "Introducción al curso", duracionHoras: 0.5 },
  { tema: "marco_general_sst", nombre: "Marco general de la Seguridad y Salud en el Trabajo", duracionHoras: 1.5 },
  { tema: "identificacion_peligros_evaluacion_riesgos", nombre: "Identificación de peligros y evaluación de riesgos", duracionHoras: 1.5 },
  { tema: "riesgos_laborales_efectos_salud", nombre: "Riesgos laborales y efectos en la salud", duracionHoras: 1 },
  { tema: "medidas_preventivas_proteccion", nombre: "Medidas preventivas y protección", duracionHoras: 1.5 },
  { tema: "gestion_emergencias_desastres", nombre: "Gestión de emergencias y desastres", duracionHoras: 1 },
  { tema: "senalizacion_prevencion_incendios", nombre: "Señalización y prevención de incendios", duracionHoras: 1 },
];

export async function crearCursoDS44(input: { organizacionId: string; nombre: string; modalidad: ModalidadEjecucion }) {
  const supabase = await createClient();

  const { data: curso, error: errorCurso } = await supabase
    .from("cursos")
    .insert({
      nombre: input.nombre,
      tipo_proveedor: "interno",
      organizacion_id: input.organizacionId,
      horas_totales: 8,
      incorpora_enfoque_genero: true,
      vigente: true,
      descripcion: "Curso de capacitación de trabajadores en prevención de riesgos laborales (art. 16, DS N.º 44/2023).",
    })
    .select("id")
    .single();

  if (errorCurso || !curso) {
    return { ok: false as const, mensaje: errorCurso?.message ?? "No se pudo crear el curso." };
  }

  const { error: errorModulos } = await supabase.from("modulos").insert(
    MODULOS_DS44.map((m, i) => ({
      curso_id: curso.id,
      orden: i + 1,
      tema: m.tema,
      nombre: m.nombre,
      duracion_horas: m.duracionHoras,
      modalidad: input.modalidad,
    })),
  );

  if (errorModulos) {
    await supabase.from("cursos").delete().eq("id", curso.id);
    return { ok: false as const, mensaje: errorModulos.message };
  }

  revalidatePath("/cursos");
  return { ok: true as const, cursoId: curso.id };
}

export async function crearEdicion(input: {
  cursoId: string;
  organizacionId: string;
  centroTrabajoId: string | null;
  facilitadorId: string | null;
  fechaInicio: string;
}) {
  const supabase = await createClient();

  const fechaInicio = new Date(input.fechaInicio + "T00:00:00");
  const fechaLimite = new Date(fechaInicio);
  fechaLimite.setMonth(fechaLimite.getMonth() + 3);

  const { error } = await supabase.from("ediciones_curso").insert({
    curso_id: input.cursoId,
    organizacion_id: input.organizacionId,
    centro_trabajo_id: input.centroTrabajoId,
    tipo_proveedor: "interno",
    facilitador_id: input.facilitadorId,
    fecha_inicio: input.fechaInicio,
    fecha_limite: fechaLimite.toISOString().slice(0, 10),
    estado: "planificada",
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath(`/cursos/${input.cursoId}`);
  return { ok: true as const };
}
