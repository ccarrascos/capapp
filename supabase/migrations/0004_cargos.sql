-- =====================================================================
-- Migración 0004: catálogo de cargos por organización
-- El cargo pasa de texto libre a una lista predeterminada que cada
-- organización administra (los rubros/cargos varían mucho entre
-- entidades empleadoras — no tiene sentido un catálogo global único).
-- =====================================================================

create table cargos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

create index idx_cargos_org on cargos(organizacion_id);

alter table cargos enable row level security;

create policy sel_cargos on cargos for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario()));

create policy mod_cargos on cargos for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id));

-- 1. Agregar la nueva columna referencial ----------------------------------
alter table trabajadores add column cargo_id uuid references cargos(id);

-- 2. Migrar los valores de texto existentes a catálogo por organización ---
insert into cargos (organizacion_id, nombre)
select distinct organizacion_id, cargo
from trabajadores
where cargo is not null and trim(cargo) <> ''
on conflict (organizacion_id, nombre) do nothing;

update trabajadores t
set cargo_id = c.id
from cargos c
where c.organizacion_id = t.organizacion_id
  and c.nombre = t.cargo;

-- 3. Eliminar la columna de texto libre -------------------------------------
-- La vista depende de esta columna; se elimina primero y se recrea al final.
drop view matriz_vigencia_capacitacion;
alter table trabajadores drop column cargo;

-- 4. Actualizar la vista de la matriz de vigencia para exponer el nombre ---
create or replace view matriz_vigencia_capacitacion
with (security_invoker = true) as
select
  t.id as trabajador_id,
  t.organizacion_id,
  t.centro_trabajo_id,
  t.run,
  t.dv,
  t.nombres,
  t.apellido_paterno,
  t.apellido_materno,
  c.nombre as cargo,
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
left join cargos c on c.id = t.cargo_id
left join lateral (
  select i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
  from inscripciones i
  join ediciones_curso ec on ec.id = i.edicion_id
  where i.trabajador_id = t.id and i.estado = 'aprobado'
  order by i.fecha_aprobacion desc nulls last
  limit 1
) ult on true;
