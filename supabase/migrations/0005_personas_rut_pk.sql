-- =====================================================================
-- Migración 0005: RUT como identidad de persona (portabilidad DS 44)
--
-- Separa "persona" (identidad, clave = RUT, global en el sistema) de
-- "vínculo laboral" (relación con una organización: cargo, modalidad,
-- fechas). Esto refleja correctamente el punto 6.4 del Anexo Metodológico
-- ("portabilidad del aprendizaje"): la certificación sigue al RUN de la
-- persona, no a la organización en la que se dictó el curso — si alguien
-- cambia de empleador, su capacitación vigente se reconoce automáticamente.
-- =====================================================================

-- 1. Nuevas tablas ---------------------------------------------------------

create table personas (
  run text primary key,
  dv text not null,
  nombres text not null,
  apellido_paterno text not null,
  apellido_materno text,
  usuario_id uuid references usuarios(id),
  email text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id)
);

create table vinculos_laborales (
  id uuid primary key default gen_random_uuid(),
  persona_run text not null references personas(run) on delete cascade,
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  centro_trabajo_id uuid references centros_trabajo(id),
  cargo_id uuid references cargos(id),
  unidad text,
  modalidad_contractual modalidad_contractual not null default 'indefinido',
  fecha_ingreso date,
  fecha_termino date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (persona_run, organizacion_id)
);

create index idx_vinculos_persona on vinculos_laborales(persona_run);
create index idx_vinculos_org on vinculos_laborales(organizacion_id);

-- 2. Migrar datos desde trabajadores ---------------------------------------

insert into personas (run, dv, nombres, apellido_paterno, apellido_materno, usuario_id, email, telefono)
select distinct on (run) run, dv, nombres, apellido_paterno, apellido_materno, usuario_id, email, telefono
from trabajadores
order by run, created_at;

insert into vinculos_laborales (persona_run, organizacion_id, centro_trabajo_id, cargo_id, unidad, modalidad_contractual, fecha_ingreso, fecha_termino, activo, created_at)
select run, organizacion_id, centro_trabajo_id, cargo_id, unidad, modalidad_contractual, fecha_ingreso, fecha_termino, activo, created_at
from trabajadores;

-- 3. Repuntar inscripciones, certificados, notificaciones a persona_run ----

alter table inscripciones add column persona_run text;
update inscripciones i set persona_run = t.run from trabajadores t where t.id = i.trabajador_id;
alter table inscripciones alter column persona_run set not null;
alter table inscripciones add constraint inscripciones_persona_run_fkey foreign key (persona_run) references personas(run);

alter table certificados add column persona_run text;
update certificados c set persona_run = t.run from trabajadores t where t.id = c.trabajador_id;
alter table certificados alter column persona_run set not null;
alter table certificados add constraint certificados_persona_run_fkey foreign key (persona_run) references personas(run);

alter table notificaciones add column persona_run text;
update notificaciones n set persona_run = t.run from trabajadores t where t.id = n.trabajador_id;
alter table notificaciones add constraint notificaciones_persona_run_fkey foreign key (persona_run) references personas(run);

-- 4. Eliminar políticas y vista que dependen de trabajadores/trabajador_id -

drop view matriz_vigencia_capacitacion;

drop policy sel_inscripciones on inscripciones;
drop policy sel_asistencias on asistencias_modulo;
drop policy sel_evaluaciones on evaluaciones_resultado;
drop policy sel_certificados on certificados;
drop policy mod_certificados on certificados;

alter table inscripciones drop column trabajador_id;
alter table certificados drop column trabajador_id;
alter table notificaciones drop column trabajador_id;

drop table trabajadores;
drop function app_trabajador_id_actual();

-- 5. Función de apoyo RLS para "mi propia persona" -------------------------

create or replace function app_persona_run_actual() returns text
language sql stable security definer set search_path = public as $$
  select run from personas where usuario_id = auth.uid() limit 1;
$$;

-- 6. RLS: personas y vinculos_laborales -------------------------------------

alter table personas enable row level security;
alter table vinculos_laborales enable row level security;

create policy sel_personas on personas for select to authenticated
  using (
    app_es_super_admin()
    or usuario_id = auth.uid()
    or exists (
      select 1 from vinculos_laborales vl
      where vl.persona_run = personas.run and vl.organizacion_id = any(app_organizaciones_usuario())
    )
  );

create policy ins_personas on personas for insert to authenticated
  with check (
    app_es_super_admin()
    or exists (
      select 1 from usuario_roles ur join roles r on r.id = ur.rol_id
      where ur.usuario_id = auth.uid() and r.nombre in ('admin_organizacion', 'prevencionista')
    )
  );

create policy upd_personas on personas for update to authenticated
  using (
    app_es_super_admin()
    or exists (
      select 1 from vinculos_laborales vl
      where vl.persona_run = personas.run
        and (app_tiene_rol_en_org('admin_organizacion', vl.organizacion_id) or app_tiene_rol_en_org('prevencionista', vl.organizacion_id))
    )
  );

create policy sel_vinculos on vinculos_laborales for select to authenticated
  using (
    app_es_super_admin()
    or organizacion_id = any(app_organizaciones_usuario())
    or persona_run = app_persona_run_actual()
  );

create policy mod_vinculos on vinculos_laborales for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id) or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id) or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- 7. Recrear políticas que dependían de trabajador_id -----------------------

create policy sel_inscripciones on inscripciones for select to authenticated
  using (app_es_super_admin() or persona_run = app_persona_run_actual() or exists (
    select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
      and (ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

create policy sel_asistencias on asistencias_modulo for select to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (i.persona_run = app_persona_run_actual()
        or ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

create policy sel_evaluaciones on evaluaciones_resultado for select to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (i.persona_run = app_persona_run_actual()
        or ec.organizacion_id = any(app_organizaciones_usuario())
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

create policy sel_certificados on certificados for select to authenticated
  using (app_es_super_admin() or persona_run = app_persona_run_actual() or exists (
    select 1 from vinculos_laborales vl where vl.persona_run = certificados.persona_run
      and vl.organizacion_id = any(app_organizaciones_usuario())
  ));

create policy mod_certificados on certificados for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from vinculos_laborales vl where vl.persona_run = certificados.persona_run
      and (app_tiene_rol_en_org('admin_organizacion', vl.organizacion_id) or app_tiene_rol_en_org('prevencionista', vl.organizacion_id))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from vinculos_laborales vl where vl.persona_run = certificados.persona_run
      and (app_tiene_rol_en_org('admin_organizacion', vl.organizacion_id) or app_tiene_rol_en_org('prevencionista', vl.organizacion_id))
  ));

-- 8. Vista de matriz de vigencia, reconociendo capacitación global por RUT -

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
from vinculos_laborales vl
join personas p on p.run = vl.persona_run
left join cargos c on c.id = vl.cargo_id
left join lateral (
  select i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
  from inscripciones i
  join ediciones_curso ec on ec.id = i.edicion_id
  where i.persona_run = p.run and i.estado = 'aprobado'
  order by i.fecha_aprobacion desc nulls last
  limit 1
) ult on true;

-- 9. updated_at automático para las tablas nuevas ---------------------------

create trigger trg_personas_updated_at before update on personas
  for each row execute function set_updated_at();
create trigger trg_vinculos_updated_at before update on vinculos_laborales
  for each row execute function set_updated_at();
