import type { ClaveConfiguracion } from "@/lib/configuracion";

export type GrupoConfiguracion = "acceso" | "cumplimiento" | "cursos" | "archivos";

export type CampoConfiguracion = {
  clave: ClaveConfiguracion;
  grupo: GrupoConfiguracion;
  etiqueta: string;
  ayuda: string;
  unidad: string;
  min: number;
  max: number;
};

export const GRUPOS_CONFIGURACION: { id: GrupoConfiguracion; titulo: string; descripcion: string }[] = [
  {
    id: "acceso",
    titulo: "Acceso y seguridad",
    descripcion: "Contraseñas temporales, recuperación de acceso y bloqueo por intentos fallidos.",
  },
  {
    id: "cumplimiento",
    titulo: "Cumplimiento y vigencia",
    descripcion: "Cuándo una capacitación se considera por vencer o vencida en la matriz.",
  },
  {
    id: "cursos",
    titulo: "Cursos y ediciones",
    descripcion: "Valores que se aplican al crear cursos y ediciones nuevas. Los ya creados no cambian.",
  },
  {
    id: "archivos",
    titulo: "Archivos",
    descripcion: "Tamaño máximo de los archivos que se pueden subir.",
  },
];

// Los rangos acotan errores de tipeo y respetan límites externos: el DS 44
// exige un curso de al menos 8 horas, y Vercel corta cualquier Server Action
// sobre 4.5 MB (logo y avatar pasan por una; los materiales van directo a Storage).
export const CAMPOS_CONFIGURACION: CampoConfiguracion[] = [
  {
    clave: "password_temporal_horas",
    grupo: "acceso",
    etiqueta: "Validez de la contraseña temporal",
    ayuda: "Tiempo que dura la contraseña enviada por correo antes de que haya que pedir una nueva.",
    unidad: "horas",
    min: 1,
    max: 720,
  },
  {
    clave: "recuperacion_throttle_minutos",
    grupo: "acceso",
    etiqueta: "Espera entre solicitudes de nuevo acceso",
    ayuda: "Tiempo mínimo entre dos solicitudes de \"olvidé mi acceso\" para la misma cuenta.",
    unidad: "minutos",
    min: 1,
    max: 1440,
  },
  {
    clave: "login_max_intentos",
    grupo: "acceso",
    etiqueta: "Intentos de ingreso permitidos",
    ayuda: "Intentos fallidos seguidos antes de bloquear temporalmente ese RUT.",
    unidad: "intentos",
    min: 3,
    max: 20,
  },
  {
    clave: "login_bloqueo_minutos",
    grupo: "acceso",
    etiqueta: "Duración del bloqueo",
    ayuda: "Tiempo que un RUT queda bloqueado tras superar los intentos permitidos.",
    unidad: "minutos",
    min: 1,
    max: 1440,
  },
  {
    clave: "edad_minima_trabajador",
    grupo: "cumplimiento",
    etiqueta: "Edad mínima del trabajador",
    ayuda: "Edad mínima para registrar a una persona en la matriz.",
    unidad: "años",
    min: 15,
    max: 21,
  },
  {
    clave: "vigencia_por_vencer_dias",
    grupo: "cumplimiento",
    etiqueta: "Ventana de aviso \"por vencer\"",
    ayuda: "Días antes del vencimiento en que una capacitación pasa a mostrarse como por vencer. Cada organización puede definir la suya; este es el valor por defecto.",
    unidad: "días",
    min: 7,
    max: 365,
  },
  {
    clave: "certificado_vigencia_anios",
    grupo: "cumplimiento",
    etiqueta: "Vigencia de la capacitación",
    ayuda: "Años de validez de una capacitación aprobada. Aplica a las aprobaciones que se registren desde ahora.",
    unidad: "años",
    min: 1,
    max: 5,
  },
  {
    clave: "curso_horas_minimas",
    grupo: "cursos",
    etiqueta: "Horas del curso DS 44",
    ayuda: "Mínimo de horas de un curso con estructura DS 44 (el decreto exige 8). Cada organización puede exigir más, nunca menos.",
    unidad: "horas",
    min: 8,
    max: 40,
  },
  {
    clave: "edicion_plazo_maximo_meses",
    grupo: "cursos",
    etiqueta: "Plazo de una edición",
    ayuda: "Plazo máximo entre el inicio de una edición y su fecha límite (el Anexo Metodológico usa 3). Cada organización puede fijar uno menor.",
    unidad: "meses",
    min: 1,
    max: 24,
  },
  {
    clave: "max_mb_logo_organizacion",
    grupo: "archivos",
    etiqueta: "Logo de organización",
    ayuda: "Tamaño máximo del logo que se muestra en la app y en los certificados.",
    unidad: "MB",
    min: 1,
    max: 4,
  },
  {
    clave: "max_mb_avatar_usuario",
    grupo: "archivos",
    etiqueta: "Foto de perfil",
    ayuda: "Tamaño máximo de la foto de perfil de cada usuario.",
    unidad: "MB",
    min: 1,
    max: 4,
  },
  {
    clave: "max_mb_materiales_curso",
    grupo: "archivos",
    etiqueta: "Materiales de curso",
    ayuda: "Tamaño máximo de manuales y material didáctico (PDF, Word, PowerPoint).",
    unidad: "MB",
    min: 1,
    max: 50,
  },
];

export type CampoOrganizacion = {
  clave: "vigencia_por_vencer_dias" | "curso_horas_minimas" | "edicion_plazo_maximo_meses";
  etiqueta: string;
  ayuda: string;
  unidad: string;
};

export const CAMPOS_ORGANIZACION: CampoOrganizacion[] = [
  {
    clave: "vigencia_por_vencer_dias",
    etiqueta: "Ventana de aviso \"por vencer\"",
    ayuda: "Días antes del vencimiento en que una capacitación de esta organización pasa a mostrarse como por vencer.",
    unidad: "días",
  },
  {
    clave: "curso_horas_minimas",
    etiqueta: "Horas del curso DS 44",
    ayuda: "Horas asignadas a los cursos nuevos de esta organización. Puede ser más que el mínimo de la plataforma, nunca menos.",
    unidad: "horas",
  },
  {
    clave: "edicion_plazo_maximo_meses",
    etiqueta: "Plazo de una edición",
    ayuda: "Meses entre el inicio de una edición nueva y su fecha límite. Puede ser menor al máximo de la plataforma, nunca mayor.",
    unidad: "meses",
  },
];

/** Rango permitido a una organización, dado el valor vigente de la plataforma. */
export function rangoCampoOrganizacion(clave: CampoOrganizacion["clave"], plataforma: number) {
  if (clave === "vigencia_por_vencer_dias") return { min: 7, max: 365 };
  if (clave === "curso_horas_minimas") return { min: plataforma, max: 40 };
  return { min: 1, max: plataforma };
}
