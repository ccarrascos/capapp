import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizacionId = process.argv[2];

if (!url || !serviceKey || !organizacionId) {
  console.error("Uso: node scripts/seed-trabajadores-demo.mjs <organizacion_id>");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// --- RUN chileno con dígito verificador real ---
function calcularDV(rut) {
  let suma = 0;
  let multiplo = 2;
  for (let i = rut.length - 1; i >= 0; i--) {
    suma += Number(rut[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

const usados = new Set();
function generarRUN() {
  let rut;
  do {
    rut = String(Math.floor(10000000 + Math.random() * 15000000));
  } while (usados.has(rut));
  usados.add(rut);
  return { run: rut, dv: calcularDV(rut) };
}

const NOMBRES_M = ["Juan","Pedro","Luis","Carlos","Jorge","Miguel","Francisco","José","Diego","Matías","Sebastián","Rodrigo","Cristián","Álvaro","Gonzalo","Patricio","Manuel","Ricardo","Andrés","Felipe"];
const NOMBRES_F = ["María","Carmen","Andrea","Claudia","Paula","Francisca","Camila","Valentina","Javiera","Constanza","Daniela","Fernanda","Macarena","Soledad","Verónica","Marcela","Ximena","Loreto","Antonia","Catalina"];
const APELLIDOS = ["González","Muñoz","Rojas","Díaz","Pérez","Soto","Contreras","Silva","Martínez","Sepúlveda","Morales","Rodríguez","López","Fuentes","Hernández","Torres","Araya","Flores","Espinoza","Valenzuela","Castillo","Reyes","Gutiérrez","Vásquez","Tapia","Vergara"];

const CARGOS = ["Operario de producción","Supervisor de obra","Maestro carpintero","Soldador","Conductor","Jefe de bodega","Administrativo","Ingeniero de terreno","Prevencionista de riesgos","Encargado de logística","Técnico eléctrico","Auxiliar de aseo"];
const UNIDADES = ["Producción","Terreno","Bodega","Administración","Logística","RRHH"];
const MODALIDADES = ["indefinido","indefinido","indefinido","plazo_fijo","plazo_fijo","obra_o_faena","aprendiz"];

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

function restarMeses(fecha, meses) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() - meses);
  return d;
}

async function main() {
  const hoy = new Date();

  // 1. Generar 50 trabajadores
  const trabajadores = [];
  for (let i = 0; i < 50; i++) {
    const esHombre = Math.random() > 0.5;
    const nombres = `${elegir(esHombre ? NOMBRES_M : NOMBRES_F)} ${elegir(esHombre ? NOMBRES_M : NOMBRES_F)}`;
    const apellidoPaterno = elegir(APELLIDOS);
    const apellidoMaterno = elegir(APELLIDOS);
    const { run, dv } = generarRUN();
    const fechaIngreso = restarMeses(hoy, Math.floor(Math.random() * 60) + 3);

    trabajadores.push({
      organizacion_id: organizacionId,
      run,
      dv,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      cargo: elegir(CARGOS),
      unidad: elegir(UNIDADES),
      modalidad_contractual: elegir(MODALIDADES),
      fecha_ingreso: fechaISO(fechaIngreso),
      email: `${nombres.split(" ")[0].toLowerCase()}.${apellidoPaterno.toLowerCase()}@tecnofast.cl`,
      activo: true,
    });
  }

  const { data: trabajadoresInsertados, error: errorTrab } = await db
    .from("trabajadores")
    .insert(trabajadores)
    .select("id");

  if (errorTrab) {
    console.error("Error insertando trabajadores:", errorTrab.message);
    process.exit(1);
  }
  console.log(`✓ ${trabajadoresInsertados.length} trabajadores creados.`);

  // 2. Crear curso DS44 con 7 módulos
  const MODULOS_DS44 = [
    { tema: "introduccion", nombre: "Introducción al curso", duracion_horas: 0.5 },
    { tema: "marco_general_sst", nombre: "Marco general de la Seguridad y Salud en el Trabajo", duracion_horas: 1.5 },
    { tema: "identificacion_peligros_evaluacion_riesgos", nombre: "Identificación de peligros y evaluación de riesgos", duracion_horas: 1.5 },
    { tema: "riesgos_laborales_efectos_salud", nombre: "Riesgos laborales y efectos en la salud", duracion_horas: 1 },
    { tema: "medidas_preventivas_proteccion", nombre: "Medidas preventivas y protección", duracion_horas: 1.5 },
    { tema: "gestion_emergencias_desastres", nombre: "Gestión de emergencias y desastres", duracion_horas: 1 },
    { tema: "senalizacion_prevencion_incendios", nombre: "Señalización y prevención de incendios", duracion_horas: 1 },
  ];

  const { data: curso, error: errorCurso } = await db
    .from("cursos")
    .insert({
      nombre: "Curso de capacitación en prevención de riesgos laborales",
      tipo_proveedor: "interno",
      organizacion_id: organizacionId,
      horas_totales: 8,
      incorpora_enfoque_genero: true,
      vigente: true,
      descripcion: "Curso de capacitación de trabajadores en prevención de riesgos laborales (art. 16, DS N.º 44/2023).",
    })
    .select("id")
    .single();

  if (errorCurso) {
    console.error("Error creando curso:", errorCurso.message);
    process.exit(1);
  }

  const { error: errorModulos } = await db.from("modulos").insert(
    MODULOS_DS44.map((m, i) => ({
      curso_id: curso.id,
      orden: i + 1,
      tema: m.tema,
      nombre: m.nombre,
      duracion_horas: m.duracion_horas,
      modalidad: "telematica_asincronica",
    })),
  );
  if (errorModulos) {
    console.error("Error creando módulos:", errorModulos.message);
    process.exit(1);
  }
  console.log("✓ Curso DS 44 creado con 7 módulos.");

  // 3. Facilitador interno
  const { data: facilitador, error: errorFacilitador } = await db
    .from("facilitadores")
    .insert({
      tipo_proveedor: "interno",
      organizacion_id: organizacionId,
      run: "15987234",
      dv: calcularDV("15987234"),
      nombres: "Rodrigo",
      apellidos: "Fernández",
      titulo_profesional: "Ingeniero en Prevención de Riesgos",
      es_experto_prevencion: true,
    })
    .select("id")
    .single();

  if (errorFacilitador) {
    console.error("Error creando facilitador:", errorFacilitador.message);
    process.exit(1);
  }
  console.log("✓ Facilitador creado.");

  // 4. Distribuir trabajadores en 4 grupos: vigente, por_vencer, vencido, sin_capacitacion
  const ids = trabajadoresInsertados.map((t) => t.id);
  const grupoVigente = ids.slice(0, 20);
  const grupoPorVencer = ids.slice(20, 30);
  const grupoVencido = ids.slice(30, 40);
  // ids.slice(40, 50) queda sin inscripción -> sin_capacitacion

  async function crearEdicionConAprobados(fechaAprobacionBase, grupo, nombreCohorte) {
    const fechaInicio = restarMeses(fechaAprobacionBase, 0);
    fechaInicio.setDate(fechaInicio.getDate() - 10);
    const fechaLimite = new Date(fechaInicio);
    fechaLimite.setMonth(fechaLimite.getMonth() + 3);

    const { data: edicion, error: errorEdicion } = await db
      .from("ediciones_curso")
      .insert({
        curso_id: curso.id,
        organizacion_id: organizacionId,
        tipo_proveedor: "interno",
        facilitador_id: facilitador.id,
        fecha_inicio: fechaISO(fechaInicio),
        fecha_limite: fechaISO(fechaLimite),
        fecha_termino: fechaISO(fechaAprobacionBase),
        estado: "finalizada",
      })
      .select("id")
      .single();

    if (errorEdicion) {
      console.error(`Error creando edición ${nombreCohorte}:`, errorEdicion.message);
      process.exit(1);
    }

    // Insertar inscripciones en sub-lotes con fechas de aprobación ligeramente distintas
    const inscripciones = grupo.map((trabajadorId, i) => {
      const fechaAprob = new Date(fechaAprobacionBase);
      fechaAprob.setDate(fechaAprob.getDate() - Math.floor(Math.random() * 15));
      return {
        edicion_id: edicion.id,
        trabajador_id: trabajadorId,
        estado: "aprobado",
        fecha_inscripcion: fechaISO(fechaInicio),
        fecha_aprobacion: fechaISO(fechaAprob),
      };
    });

    const { error: errorInsc } = await db.from("inscripciones").insert(inscripciones);
    if (errorInsc) {
      console.error(`Error inscribiendo grupo ${nombreCohorte}:`, errorInsc.message);
      process.exit(1);
    }
    console.log(`✓ Cohorte "${nombreCohorte}": ${grupo.length} trabajadores aprobados (edición ${fechaISO(fechaInicio)}).`);
  }

  // Vigente: aprobado hace 4-10 meses (vigencia_hasta muy lejana)
  await crearEdicionConAprobados(restarMeses(hoy, 6), grupoVigente, "vigente");
  // Por vencer: aprobado hace ~23 meses (vigencia_hasta cae dentro de los próximos 60 días)
  await crearEdicionConAprobados(restarMeses(hoy, 23), grupoPorVencer, "por vencer");
  // Vencido: aprobado hace más de 2 años
  await crearEdicionConAprobados(restarMeses(hoy, 30), grupoVencido, "vencido");

  console.log("\nListo. 10 trabajadores quedaron sin inscripción (estado 'sin_capacitacion').");
}

main();
