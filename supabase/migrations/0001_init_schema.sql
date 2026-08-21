-- =====================================================================
-- CAPAPP — Sistema de gestión de capacitación DS 44 (art. 16)
-- Migración 0001: esquema relacional base + roles + RLS
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. TIPOS ENUMERADOS
-- =====================================================================

create type rol_nombre as enum (
  'super_admin',        -- administra toda la plataforma, multi-organización
  'admin_organizacion',  -- administra una entidad empleadora completa
  'prevencionista',       -- gestiona capacitación, matriz de vigencia, PTP
  'facilitador',          -- dicta cursos, registra asistencia/evaluaciones
  'supervisor_centro',    -- solo lectura de un centro de trabajo
  'trabajador',           -- portal propio del trabajador
  'auditor'               -- solo lectura, fiscalización
);

create type modalidad_contractual as enum (
  'indefinido', 'plazo_fijo', 'obra_o_faena', 'aprendiz', 'honorarios', 'otro'
);

create type tipo_proveedor as enum ('interno', 'oal', 'otec');

create type modalidad_ejecucion as enum (
  'telematica_asincronica', 'telematica_sincronica', 'presencial', 'mixta'
);

create type tema_modulo as enum (
  'introduccion',
  'marco_general_sst',
  'identificacion_peligros_evaluacion_riesgos',
  'riesgos_laborales_efectos_salud',
  'medidas_preventivas_proteccion',
  'gestion_emergencias_desastres',
  'senalizacion_prevencion_incendios'
);

create type estado_edicion as enum ('planificada', 'en_curso', 'finalizada', 'cancelada');

create type estado_inscripcion as enum ('inscrito', 'en_progreso', 'aprobado', 'reprobado', 'desertor');

create type entidad_emisora_tipo as enum ('empleador', 'oal', 'otec');

create type tipo_notificacion as enum (
  'vencimiento_proximo', 'vencido', 'nueva_inscripcion', 'curso_finalizado'
);

-- =====================================================================
-- 2. ENTIDADES DE APOYO (OAL / OTEC)
-- =====================================================================

create table organismos_administradores ( -- OAL: mutuales / ISL (ley 16.744)
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rut text unique,
  tipo text, -- 'mutual' | 'isl'
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table entidades_acreditadas ( -- OTEC (acreditadas SENCE)
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rut text unique,
  codigo_sence text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. ORGANIZACIONES Y CENTROS DE TRABAJO
-- =====================================================================

create table organizaciones ( -- entidad empleadora
  id uuid primary key default gen_random_uuid(),
  rut text not null unique,
  razon_social text not null,
  nombre_fantasia text,
  sector_economico text,
  tamano_empresa text,
  oal_id uuid references organismos_administradores(id),
  direccion text,
  comuna text,
  region text,
  telefono text,
  email_contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table centros_trabajo (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  nombre text not null,
  direccion text,
  comuna text,
  region text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_centros_trabajo_org on centros_trabajo(organizacion_id);

-- =====================================================================
-- 4. USUARIOS Y ROLES (módulo de usuarios)
-- =====================================================================

create table usuarios ( -- perfil de app, 1:1 con auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  nombres text not null,
  apellidos text not null,
  email text not null,
  telefono text,
  avatar_url text,
  activo boolean not null default true,
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  nombre rol_nombre not null unique,
  descripcion text,
  nivel_jerarquico int not null
);

create table usuario_roles ( -- asignación de roles, con alcance opcional por org/centro
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  rol_id uuid not null references roles(id),
  organizacion_id uuid references organizaciones(id) on delete cascade,
  centro_trabajo_id uuid references centros_trabajo(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (usuario_id, rol_id, organizacion_id, centro_trabajo_id)
);

create index idx_usuario_roles_usuario on usuario_roles(usuario_id);
create index idx_usuario_roles_org on usuario_roles(organizacion_id);

insert into roles (nombre, descripcion, nivel_jerarquico) values
  ('super_admin', 'Administra toda la plataforma (multi-organización)', 100),
  ('admin_organizacion', 'Administra una entidad empleadora completa', 80),
  ('prevencionista', 'Gestiona capacitación, PTP y matriz de vigencia', 60),
  ('facilitador', 'Dicta cursos y registra asistencia/evaluaciones', 40),
  ('supervisor_centro', 'Visualiza el cumplimiento de su centro de trabajo', 30),
  ('auditor', 'Acceso de solo lectura para fiscalización', 20),
  ('trabajador', 'Portal propio del trabajador', 10);

-- =====================================================================
-- 5. TRABAJADORES (matriz maestra) Y FACILITADORES
-- =====================================================================

create table trabajadores (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  centro_trabajo_id uuid references centros_trabajo(id),
  usuario_id uuid references usuarios(id), -- portal de autoservicio (opcional)
  run text not null,
  dv text not null,
  nombres text not null,
  apellido_paterno text not null,
  apellido_materno text,
  cargo text,
  unidad text,
  modalidad_contractual modalidad_contractual not null default 'indefinido',
  fecha_ingreso date,
  fecha_termino date,
  email text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizacion_id, run)
);

create index idx_trabajadores_org on trabajadores(organizacion_id);
create index idx_trabajadores_centro on trabajadores(centro_trabajo_id);
create index idx_trabajadores_run on trabajadores(run);

create table facilitadores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  run text not null,
  dv text not null,
  nombres text not null,
  apellidos text not null,
  titulo_profesional text,
  es_experto_prevencion boolean not null default false,
  tipo_proveedor tipo_proveedor not null,
  organizacion_id uuid references organizaciones(id),
  oal_id uuid references organismos_administradores(id),
  otec_id uuid references entidades_acreditadas(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_facilitador_proveedor check (
    (tipo_proveedor = 'interno' and organizacion_id is not null and oal_id is null and otec_id is null) or
    (tipo_proveedor = 'oal' and oal_id is not null and organizacion_id is null and otec_id is null) or
    (tipo_proveedor = 'otec' and otec_id is not null and organizacion_id is null and oal_id is null)
  )
);

-- =====================================================================
-- 6. PROGRAMA DE TRABAJO PREVENTIVO
-- =====================================================================

create table programas_trabajo_preventivo (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  anio int not null,
  periodicidad_capacitacion_meses int not null default 24,
  fecha_aprobacion date,
  documento_url text,
  responsable_usuario_id uuid references usuarios(id),
  created_at timestamptz not null default now(),
  constraint chk_ptp_periodicidad check (
    periodicidad_capacitacion_meses > 0 and periodicidad_capacitacion_meses <= 24
  ),
  unique (organizacion_id, anio)
);

-- =====================================================================
-- 7. CURSOS Y MÓDULOS (contenidos mínimos art. 16)
-- =====================================================================

create table cursos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  version text,
  tipo_proveedor tipo_proveedor not null,
  organizacion_id uuid references organizaciones(id),
  oal_id uuid references organismos_administradores(id),
  otec_id uuid references entidades_acreditadas(id),
  horas_totales numeric(4,1) not null default 8.0,
  incorpora_enfoque_genero boolean not null default true,
  vigente boolean not null default true,
  descripcion text,
  created_at timestamptz not null default now(),
  constraint chk_curso_horas_minimas check (horas_totales >= 8.0)
);

create table modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  orden int not null,
  tema tema_modulo not null,
  nombre text not null,
  objetivos_aprendizaje text,
  duracion_horas numeric(4,1) not null,
  modalidad modalidad_ejecucion not null,
  recursos_didacticos text,
  created_at timestamptz not null default now(),
  unique (curso_id, orden)
);

-- =====================================================================
-- 8. EDICIONES DE CURSO (cohortes) E INSCRIPCIONES
-- =====================================================================

create table ediciones_curso (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  centro_trabajo_id uuid references centros_trabajo(id),
  programa_trabajo_preventivo_id uuid references programas_trabajo_preventivo(id),
  tipo_proveedor tipo_proveedor not null,
  oal_id uuid references organismos_administradores(id),
  otec_id uuid references entidades_acreditadas(id),
  facilitador_id uuid references facilitadores(id),
  fecha_inicio date not null,
  fecha_limite date not null, -- máx. 3 meses desde inicio (Anexo Metodológico §1)
  fecha_termino date,
  estado estado_edicion not null default 'planificada',
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now(),
  constraint chk_fecha_limite check (fecha_limite <= (fecha_inicio + interval '3 months')::date)
);

create index idx_ediciones_org on ediciones_curso(organizacion_id);
create index idx_ediciones_curso on ediciones_curso(curso_id);

create table inscripciones (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ediciones_curso(id) on delete cascade,
  trabajador_id uuid not null references trabajadores(id) on delete cascade,
  estado estado_inscripcion not null default 'inscrito',
  fecha_inscripcion date not null default current_date,
  fecha_aprobacion date,
  vigencia_hasta date, -- fecha_aprobacion + 2 años (calculado por trigger)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edicion_id, trabajador_id)
);

create index idx_inscripciones_trabajador on inscripciones(trabajador_id);
create index idx_inscripciones_edicion on inscripciones(edicion_id);
create index idx_inscripciones_vigencia on inscripciones(vigencia_hasta);

create table asistencias_modulo (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references inscripciones(id) on delete cascade,
  modulo_id uuid not null references modulos(id),
  fecha date not null,
  hora_inicio time,
  hora_termino time,
  presente boolean not null default false,
  tiempo_permanencia_min int,
  created_at timestamptz not null default now(),
  unique (inscripcion_id, modulo_id)
);

create table evaluaciones_resultado (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null references inscripciones(id) on delete cascade,
  modulo_id uuid references modulos(id), -- null = evaluación final del curso
  intento_numero int not null default 1,
  fecha timestamptz not null default now(),
  puntaje numeric(5,2),
  aprobado boolean not null default false,
  respuestas jsonb,
  created_at timestamptz not null default now()
);

create index idx_evaluaciones_inscripcion on evaluaciones_resultado(inscripcion_id);

create table certificados (
  id uuid primary key default gen_random_uuid(),
  inscripcion_id uuid not null unique references inscripciones(id) on delete cascade,
  trabajador_id uuid not null references trabajadores(id),
  curso_id uuid not null references cursos(id),
  numero_certificado text not null unique,
  fecha_emision date not null default current_date,
  fecha_vigencia_hasta date not null,
  entidad_emisora_tipo entidad_emisora_tipo not null,
  entidad_emisora_id uuid,
  archivo_url text,
  created_at timestamptz not null default now()
);

create index idx_certificados_trabajador on certificados(trabajador_id);

-- =====================================================================
-- 9. NOTIFICACIONES Y AUDITORÍA
-- =====================================================================

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  trabajador_id uuid references trabajadores(id),
  tipo tipo_notificacion not null,
  mensaje text not null,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notificaciones_usuario on notificaciones(usuario_id, leido);

create table auditoria_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  accion text not null,
  tabla text not null,
  registro_id uuid,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz not null default now()
);

create index idx_auditoria_tabla on auditoria_log(tabla, registro_id);

-- =====================================================================
-- 10. TRIGGERS
-- =====================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizaciones_updated_at before update on organizaciones
  for each row execute function set_updated_at();
create trigger trg_usuarios_updated_at before update on usuarios
  for each row execute function set_updated_at();
create trigger trg_trabajadores_updated_at before update on trabajadores
  for each row execute function set_updated_at();
create trigger trg_inscripciones_updated_at before update on inscripciones
  for each row execute function set_updated_at();

create or replace function calcular_vigencia_inscripcion()
returns trigger language plpgsql as $$
begin
  if new.estado = 'aprobado' and new.fecha_aprobacion is not null then
    new.vigencia_hasta := (new.fecha_aprobacion + interval '2 years')::date;
  end if;
  return new;
end;
$$;

create trigger trg_inscripciones_vigencia
  before insert or update on inscripciones
  for each row execute function calcular_vigencia_inscripcion();

-- =====================================================================
-- 11. VISTA: MATRIZ MAESTRA DE VIGENCIA
-- =====================================================================

create or replace view matriz_vigencia_capacitacion as
select
  t.id as trabajador_id,
  t.organizacion_id,
  t.centro_trabajo_id,
  t.run,
  t.dv,
  t.nombres,
  t.apellido_paterno,
  t.apellido_materno,
  t.cargo,
  t.unidad,
  t.modalidad_contractual,
  t.activo as trabajador_activo,
  ult.inscripcion_id,
  ult.curso_id,
  ult.fecha_aprobacion,
  ult.vigencia_hasta,
  case
    when ult.vigencia_hasta is null then 'sin_capacitacion'
    when ult.vigencia_hasta < current_date then 'vencido'
    when ult.vigencia_hasta <= (current_date + interval '60 days') then 'por_vencer'
    else 'vigente'
  end as estado_vigencia
from trabajadores t
left join lateral (
  select i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
  from inscripciones i
  join ediciones_curso ec on ec.id = i.edicion_id
  where i.trabajador_id = t.id and i.estado = 'aprobado'
  order by i.fecha_aprobacion desc nulls last
  limit 1
) ult on true;

-- =====================================================================
-- 12. FUNCIONES DE APOYO PARA RLS
-- =====================================================================

create or replace function app_es_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_roles ur join roles r on r.id = ur.rol_id
    where ur.usuario_id = auth.uid() and r.nombre = 'super_admin'
  );
$$;

create or replace function app_organizaciones_usuario() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct organizacion_id), '{}')
  from usuario_roles
  where usuario_id = auth.uid() and organizacion_id is not null;
$$;

create or replace function app_tiene_rol_en_org(p_rol rol_nombre, p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_roles ur join roles r on r.id = ur.rol_id
    where ur.usuario_id = auth.uid() and r.nombre = p_rol and ur.organizacion_id = p_org
  );
$$;

create or replace function app_trabajador_id_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select id from trabajadores where usuario_id = auth.uid() limit 1;
$$;

-- =====================================================================
-- 13. ROW LEVEL SECURITY
-- =====================================================================

alter table organismos_administradores enable row level security;
alter table entidades_acreditadas enable row level security;
alter table organizaciones enable row level security;
alter table centros_trabajo enable row level security;
alter table usuarios enable row level security;
alter table roles enable row level security;
alter table usuario_roles enable row level security;
alter table trabajadores enable row level security;
alter table facilitadores enable row level security;
alter table programas_trabajo_preventivo enable row level security;
alter table cursos enable row level security;
alter table modulos enable row level security;
alter table ediciones_curso enable row level security;
alter table inscripciones enable row level security;
alter table asistencias_modulo enable row level security;
alter table evaluaciones_resultado enable row level security;
alter table certificados enable row level security;
alter table notificaciones enable row level security;
alter table auditoria_log enable row level security;

-- Catálogos globales: lectura para cualquier usuario autenticado
create policy sel_organismos on organismos_administradores for select to authenticated using (true);
create policy sel_entidades_acred on entidades_acreditadas for select to authenticated using (true);
create policy sel_roles on roles for select to authenticated using (true);
create policy adm_organismos on organismos_administradores for all to authenticated
  using (app_es_super_admin()) with check (app_es_super_admin());
create policy adm_entidades_acred on entidades_acreditadas for all to authenticated
  using (app_es_super_admin()) with check (app_es_super_admin());

-- Organizaciones
create policy sel_organizaciones on organizaciones for select to authenticated
  using (app_es_super_admin() or id = any(app_organizaciones_usuario()));
create policy mod_organizaciones on organizaciones for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', id));

-- Centros de trabajo
create policy sel_centros on centros_trabajo for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario()));
create policy mod_centros on centros_trabajo for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- Usuarios: cada quien ve/edita su propio perfil; admins ven su organización
create policy sel_usuarios_propio on usuarios for select to authenticated
  using (id = auth.uid() or app_es_super_admin() or exists (
    select 1 from usuario_roles ur where ur.usuario_id = usuarios.id
      and ur.organizacion_id = any(app_organizaciones_usuario())
  ));
create policy upd_usuarios_propio on usuarios for update to authenticated
  using (id = auth.uid() or app_es_super_admin());
create policy ins_usuarios on usuarios for insert to authenticated
  with check (id = auth.uid() or app_es_super_admin());

-- Usuario_roles: visibles/gestionables por admins de la organización
create policy sel_usuario_roles on usuario_roles for select to authenticated
  using (usuario_id = auth.uid() or app_es_super_admin()
    or organizacion_id = any(app_organizaciones_usuario()));
create policy mod_usuario_roles on usuario_roles for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id));

-- Trabajadores
create policy sel_trabajadores on trabajadores for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario())
    or id = app_trabajador_id_actual());
create policy mod_trabajadores on trabajadores for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- Facilitadores
create policy sel_facilitadores on facilitadores for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario())
    or usuario_id = auth.uid());
create policy mod_facilitadores on facilitadores for all to authenticated
  using (app_es_super_admin() or (organizacion_id is not null
    and app_tiene_rol_en_org('admin_organizacion', organizacion_id)))
  with check (app_es_super_admin() or (organizacion_id is not null
    and app_tiene_rol_en_org('admin_organizacion', organizacion_id)));

-- Programas de trabajo preventivo
create policy sel_ptp on programas_trabajo_preventivo for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario()));
create policy mod_ptp on programas_trabajo_preventivo for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- Cursos y módulos (visibles para cualquier autenticado; gestión restringida)
create policy sel_cursos on cursos for select to authenticated using (true);
create policy mod_cursos on cursos for all to authenticated
  using (app_es_super_admin() or (organizacion_id is not null
    and (app_tiene_rol_en_org('admin_organizacion', organizacion_id)
      or app_tiene_rol_en_org('prevencionista', organizacion_id))))
  with check (app_es_super_admin() or (organizacion_id is not null
    and (app_tiene_rol_en_org('admin_organizacion', organizacion_id)
      or app_tiene_rol_en_org('prevencionista', organizacion_id))));

create policy sel_modulos on modulos for select to authenticated using (true);
create policy mod_modulos on modulos for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from cursos c where c.id = modulos.curso_id and c.organizacion_id = any(app_organizaciones_usuario())
  ))
  with check (app_es_super_admin() or exists (
    select 1 from cursos c where c.id = modulos.curso_id and c.organizacion_id = any(app_organizaciones_usuario())
  ));

-- Ediciones de curso
create policy sel_ediciones on ediciones_curso for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario())
    or facilitador_id in (select id from facilitadores where usuario_id = auth.uid()));
create policy mod_ediciones on ediciones_curso for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- Inscripciones
create policy sel_inscripciones on inscripciones for select to authenticated
  using (app_es_super_admin() or trabajador_id = app_trabajador_id_actual()
    or exists (
      select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
        and (ec.organizacion_id = any(app_organizaciones_usuario())
          or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
    ));
create policy mod_inscripciones on inscripciones for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

-- Asistencias y evaluaciones: mismas reglas que inscripciones (vía join)
create policy sel_asistencias on asistencias_modulo for select to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (i.trabajador_id = app_trabajador_id_actual()
        or ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));
create policy mod_asistencias on asistencias_modulo for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

create policy sel_evaluaciones on evaluaciones_resultado for select to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (i.trabajador_id = app_trabajador_id_actual()
        or ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));
create policy mod_evaluaciones on evaluaciones_resultado for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

-- Certificados
create policy sel_certificados on certificados for select to authenticated
  using (app_es_super_admin() or trabajador_id = app_trabajador_id_actual()
    or exists (select 1 from trabajadores t where t.id = certificados.trabajador_id
      and t.organizacion_id = any(app_organizaciones_usuario())));
create policy mod_certificados on certificados for all to authenticated
  using (app_es_super_admin() or exists (select 1 from trabajadores t where t.id = certificados.trabajador_id
    and (app_tiene_rol_en_org('admin_organizacion', t.organizacion_id)
      or app_tiene_rol_en_org('prevencionista', t.organizacion_id))))
  with check (app_es_super_admin() or exists (select 1 from trabajadores t where t.id = certificados.trabajador_id
    and (app_tiene_rol_en_org('admin_organizacion', t.organizacion_id)
      or app_tiene_rol_en_org('prevencionista', t.organizacion_id))));

-- Notificaciones: cada usuario ve/gestiona las suyas
create policy sel_notificaciones on notificaciones for select to authenticated
  using (usuario_id = auth.uid() or app_es_super_admin());
create policy upd_notificaciones on notificaciones for update to authenticated
  using (usuario_id = auth.uid());
create policy ins_notificaciones on notificaciones for insert to authenticated
  with check (app_es_super_admin() or true);

-- Auditoría: solo lectura por super_admin y auditores de la organización
create policy sel_auditoria on auditoria_log for select to authenticated
  using (app_es_super_admin());
create policy ins_auditoria on auditoria_log for insert to authenticated
  with check (true);
