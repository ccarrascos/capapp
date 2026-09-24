-- Panel de configuración para super_admin: valores de negocio que hoy
-- estaban fijos en el código (duraciones, límites, umbrales) pasan a
-- vivir en esta tabla, con los mismos valores que tenían antes para que
-- nada cambie de comportamiento al desplegar esta migración.
create table configuracion_plataforma (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references usuarios(id)
);

alter table configuracion_plataforma enable row level security;

-- Mismo idioma que sel_organismos/adm_organismos en 0001_init_schema.sql:
-- lectura abierta a cualquier autenticado, escritura solo super_admin,
-- reutilizando el helper existente app_es_super_admin() en vez de repetir
-- el subquery de rol inline.
create policy sel_configuracion_plataforma on configuracion_plataforma for select to authenticated using (true);
create policy adm_configuracion_plataforma on configuracion_plataforma for all to authenticated
  using (app_es_super_admin()) with check (app_es_super_admin());

-- Lectura numérica reutilizable desde vistas y triggers, sin repetir el
-- select a esta tabla en cada lugar que necesite un valor configurado.
create or replace function app_config_int(p_clave text, p_default int) returns int
language sql stable as $$
  select coalesce((select (valor->>0)::int from configuracion_plataforma where clave = p_clave), p_default);
$$;

insert into configuracion_plataforma (clave, valor, descripcion) values
  ('password_temporal_horas', '72', 'Horas que dura válida una contraseña temporal enviada por correo.'),
  ('recuperacion_throttle_minutos', '5', 'Minutos mínimos entre dos solicitudes de "olvidé mi acceso" para la misma cuenta.'),
  ('login_max_intentos', '5', 'Intentos fallidos de login permitidos antes de bloquear temporalmente ese RUT.'),
  ('login_bloqueo_minutos', '15', 'Minutos que dura el bloqueo tras superar el máximo de intentos de login.'),
  ('edad_minima_trabajador', '18', 'Edad mínima, en años, para registrar a una persona como trabajador.'),
  ('vigencia_por_vencer_dias', '60', 'Desde cuántos días antes del vencimiento se marca un curso como "por vencer".'),
  ('certificado_vigencia_anios', '2', 'Años de vigencia de una capacitación aprobada.'),
  ('curso_horas_minimas', '8', 'Horas mínimas exigidas para un curso DS44.'),
  ('edicion_plazo_maximo_meses', '3', 'Meses máximos entre el inicio de una edición de curso y su fecha límite.'),
  ('max_mb_logo_organizacion', '2', 'Tamaño máximo, en MB, del logo de una organización.'),
  ('max_mb_avatar_usuario', '3', 'Tamaño máximo, en MB, del avatar de un usuario.'),
  ('max_mb_materiales_curso', '20', 'Tamaño máximo, en MB, de un material de curso.');

-- Registro de intentos de login fallidos, por RUT tal cual se recibe
-- (exista o no la cuenta) — así el bloqueo por fuerza bruta no delata si
-- un RUT tiene cuenta o no: la respuesta es la misma en ambos casos.
create table intentos_login (
  run text not null,
  dv text not null,
  intentos int not null default 0,
  ultimo_intento timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  primary key (run, dv)
);

alter table intentos_login enable row level security;
-- Sin políticas de select/insert/update para authenticated/anon: solo el
-- cliente admin (que evita RLS) lee y escribe esta tabla, igual que las
-- demás tablas de uso puramente interno de los server actions.

-- ---------------------------------------------------------------------
-- Unifica la ventana "por vencer" (antes 60 días fijos, repetidos en
-- esta misma vista) para que lea de configuracion_plataforma.
-- ---------------------------------------------------------------------
create or replace view matriz_vigencia_capacitacion
with (security_invoker = true) as
select
  vl.id as vinculo_id,
  p.run as persona_run,
  vl.organizacion_id,
  vl.centro_trabajo_id,
  p.run,
  p.dv,
  p.nombres,
  p.apellido_paterno,
  p.apellido_materno,
  c.nombre as cargo,
  vl.unidad,
  vl.modalidad_contractual,
  vl.activo as trabajador_activo,
  peor.inscripcion_id,
  peor.curso_id,
  peor.fecha_aprobacion,
  peor.vigencia_hasta,
  case
    when peor.vigencia_hasta is null then 'sin_capacitacion'
    when peor.vigencia_hasta < current_date then 'vencido'
    when peor.vigencia_hasta <= (current_date + (app_config_int('vigencia_por_vencer_dias', 60) || ' days')::interval) then 'por_vencer'
    else 'vigente'
  end as estado_vigencia,
  vl.tipo_vinculo,
  vl.subcontrato_id,
  sc.nombre as subcontrato_nombre
from vinculos_laborales vl
join personas p on p.run = vl.persona_run
left join cargos c on c.id = vl.cargo_id
left join subcontratos sc on sc.id = vl.subcontrato_id
left join usuarios u on u.id = p.usuario_id
left join lateral (
  select ultimo.inscripcion_id, ultimo.curso_id, ultimo.fecha_aprobacion, ultimo.vigencia_hasta
  from (
    select distinct on (ec.curso_id)
      i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
    from inscripciones i
    join ediciones_curso ec on ec.id = i.edicion_id
    where i.persona_run = p.run and i.estado = 'aprobado'
    order by ec.curso_id, i.fecha_aprobacion desc nulls last
  ) ultimo
  order by
    case
      when ultimo.vigencia_hasta is null then 0
      when ultimo.vigencia_hasta < current_date then 0
      when ultimo.vigencia_hasta <= (current_date + (app_config_int('vigencia_por_vencer_dias', 60) || ' days')::interval) then 1
      else 2
    end asc,
    ultimo.vigencia_hasta asc nulls first
  limit 1
) peor on true
where u.id is null or u.activo = true;

-- ---------------------------------------------------------------------
-- Vigencia del certificado: antes 2 años fijos.
-- ---------------------------------------------------------------------
create or replace function calcular_vigencia_inscripcion()
returns trigger language plpgsql as $$
begin
  if new.estado = 'aprobado' and new.fecha_aprobacion is not null then
    new.vigencia_hasta := (new.fecha_aprobacion + make_interval(years => app_config_int('certificado_vigencia_anios', 2)))::date;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Los dos constraints de abajo no pueden leer configuracion_plataforma
-- (Postgres no permite subqueries en check constraints). Se relajan a
-- un piso de sanidad permanente; el valor de negocio real y configurable
-- (8 horas, 3 meses hoy) se valida en el código de cursos/actions.ts.
-- ---------------------------------------------------------------------
alter table cursos drop constraint chk_curso_horas_minimas;
alter table cursos add constraint chk_curso_horas_minimas check (horas_totales >= 1.0);

alter table ediciones_curso drop constraint chk_fecha_limite;
alter table ediciones_curso add constraint chk_fecha_limite check (fecha_limite <= (fecha_inicio + interval '24 months')::date);
