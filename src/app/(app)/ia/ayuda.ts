/**
 * Guías de uso curadas a mano — a diferencia de las demás herramientas del
 * asistente, este contenido es estático y no refleja la base de datos.
 * Si un flujo de la UI cambia, hay que actualizar la guía correspondiente
 * o el asistente dará instrucciones desactualizadas con total confianza.
 */

type GuiaAyuda = {
  tema: string;
  palabrasClave: string[];
  pasos: string[];
};

export const GUIAS_AYUDA: GuiaAyuda[] = [
  {
    tema: "Agregar un trabajador nuevo",
    palabrasClave: ["agregar trabajador", "nuevo trabajador", "alta", "registrar trabajador"],
    pasos: [
      "Ve a Matriz de vigencia en el menú lateral.",
      "Clic en \"Nuevo trabajador\" (arriba a la derecha).",
      "Completa RUN, nombres, apellidos, cargo, centro de trabajo, modalidad contractual y sexo (obligatorio). La fecha de nacimiento es opcional, pero alimenta el gráfico de edad en Analítica.",
      "Si la persona ya trabajó antes en otra organización de la plataforma, se reutiliza su identidad — su capacitación previa se reconoce automáticamente, no hace falta reingresarla.",
      "Opcional: marca \"Dar acceso al portal de inmediato\" para crearle la cuenta y enviarle las credenciales en el mismo paso, sin tener que ir después a \"Dar acceso\" — requiere haber ingresado su correo.",
      "Clic en \"Agregar trabajador\".",
    ],
  },
  {
    tema: "Cargar varios trabajadores a la vez (CSV)",
    palabrasClave: ["carga masiva", "csv", "excel", "importar trabajadores", "varios trabajadores"],
    pasos: [
      "Ve a Matriz de vigencia y clic en \"Carga masiva\".",
      "Clic en \"Descargar plantilla CSV\" y complétala sin cambiar los nombres de las columnas (hasta 300 filas por archivo).",
      "La columna Sexo es obligatoria (masculino, femenino u otro) — una fila sin ese dato se rechaza.",
      "Cargo, Centro de trabajo y Subcontrato deben coincidir exactamente con uno ya creado en sus respectivos módulos — si no existen aún, créalos primero.",
      "Sube el archivo completado y revisa el resumen antes de importar.",
      "Clic en \"Importar\" — el resultado muestra fila por fila cuáles se cargaron y cuáles fallaron, con el motivo.",
    ],
  },
  {
    tema: "Dar acceso al portal a un trabajador",
    palabrasClave: ["dar acceso", "crear cuenta", "portal trabajador", "contraseña trabajador"],
    pasos: [
      "En Matriz de vigencia, busca al trabajador y en la columna Acceso clic en \"Dar acceso\" (solo aparece si aún no tiene cuenta).",
      "Confirma o corrige el correo al que se enviarán las credenciales.",
      "Se genera una contraseña temporal y se envía un correo de bienvenida.",
      "Si el correo no se pudo enviar, la contraseña temporal se muestra en pantalla para entregarla por otro medio.",
    ],
  },
  {
    tema: "Crear un curso",
    palabrasClave: ["crear curso", "nuevo curso", "agregar curso", "módulos"],
    pasos: [
      "Ve a Cursos y ediciones en el menú lateral.",
      "Clic en \"Nuevo curso (plantilla DS 44)\".",
      "Completa nombre, horas totales y los módulos según los temas exigidos por el DS 44 (marco general, identificación de peligros, riesgos laborales, medidas preventivas, gestión de emergencias, señalización).",
      "Clic en \"Crear curso\".",
    ],
  },
  {
    tema: "Programar una edición de un curso e inscribir trabajadores",
    palabrasClave: ["nueva edición", "programar curso", "inscribir trabajadores", "cohorte"],
    pasos: [
      "Entra al curso desde Cursos y ediciones y clic en \"Nueva edición\".",
      "Define fecha de inicio, fecha límite, facilitador y centro de trabajo.",
      "Dentro de la edición, clic en \"Inscribir trabajadores\" y selecciona a quiénes — solo aparecen quienes tienen un vínculo laboral activo con esa organización.",
      "Cada trabajador con portal propio recibe una notificación de que fue inscrito.",
    ],
  },
  {
    tema: "Registrar asistencia, aprobar y emitir un certificado",
    palabrasClave: ["registrar asistencia", "aprobar curso", "evaluación", "emitir certificado", "certificado"],
    pasos: [
      "Entra a la edición del curso y abre el detalle de la inscripción del trabajador.",
      "En \"Asistencia por módulo\" marca cada módulo al que asistió (o usa \"Marcar todo\").",
      "En \"Manual del participante\" marca \"Entregado\" una vez que se le dio el material.",
      "En \"Evaluación final\" ingresa el puntaje (0-100) y clic en \"Aprobar\" o \"Reprobar\". Aprobar exige que la asistencia esté completa y el manual entregado — si falta algo, el sistema lo bloquea.",
      "Una vez aprobado, aparece la sección \"Certificación\": clic en \"Emitir certificado\" y define hasta cuándo queda vigente. El trabajador recibe una notificación de que su certificado está disponible.",
    ],
  },
  {
    tema: "Ver o entender las notificaciones",
    palabrasClave: ["notificaciones", "campana", "avisos", "vencimiento"],
    pasos: [
      "La campana en la barra superior muestra un contador de notificaciones no leídas.",
      "Se generan solas al vencer o estar por vencer (60 días) una capacitación, al ser inscrito en un curso, al ser aprobado, o al emitirse un certificado — no hay que pedirlas manualmente.",
      "Quien gestiona (admin/prevencionista/supervisor de centro) ve las de su alcance; quien tiene portal propio ve además las suyas.",
    ],
  },
  {
    tema: "Usar el Asistente IA",
    palabrasClave: ["asistente", "chat", "preguntas", "ia"],
    pasos: [
      "Ve a Asistente IA en el menú lateral.",
      "Escribe la pregunta en español, en lenguaje natural — por ejemplo \"¿cuántos trabajadores están vencidos en Iquique?\".",
      "El asistente solo responde con datos reales de la plataforma, filtrados según lo que tu rol puede ver; si no tiene la información, lo dice en vez de inventarla.",
      "Shift+Enter agrega un salto de línea sin enviar el mensaje; Enter solo lo envía.",
    ],
  },
];

export function buscarAyuda(consulta: string): { tema: string; pasos: string[] }[] | { mensaje: string } {
  const q = consulta
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!q) return { mensaje: "Indica sobre qué acción de la plataforma necesitas ayuda." };

  const normalizar = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const encontradas = GUIAS_AYUDA.filter(
    (g) => normalizar(g.tema).includes(q) || g.palabrasClave.some((k) => normalizar(k).includes(q) || q.includes(normalizar(k))),
  );

  if (encontradas.length === 0) {
    const temas = GUIAS_AYUDA.map((g) => g.tema).join(", ");
    return { mensaje: `No hay una guía para eso todavía. Temas disponibles: ${temas}.` };
  }

  return encontradas.map((g) => ({ tema: g.tema, pasos: g.pasos }));
}

export function temasDeAyudaDisponibles(): string[] {
  return GUIAS_AYUDA.map((g) => g.tema);
}
