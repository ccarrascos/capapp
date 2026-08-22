-- =====================================================================
-- Migración 0014: trabajadores directos vs. subcontrato.
-- Un subcontrato es una empresa contratista, única por organización
-- (no se puede volver a crear el mismo nombre). Se crea ya asociado a un
-- centro de trabajo; si necesita operar en otro centro, se ASIGNA ahí
-- (subcontratos_centros) en vez de crear un registro duplicado.
-- =====================================================================

create type tipo_vinculo_laboral as enum ('directo', 'subcontrato');

create table subcontratos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  nombre text not null,
  rut text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

create table subcontratos_centros (
  id uuid primary key default gen_random_uuid(),
  subcontrato_id uuid not null references subcontratos(id) on delete cascade,
  centro_trabajo_id uuid not null references centros_trabajo(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subcontrato_id, centro_trabajo_id)
);

alter table vinculos_laborales
  add column tipo_vinculo tipo_vinculo_laboral not null default 'directo',
  add column subcontrato_id uuid references subcontratos(id);

alter table vinculos_laborales
  add constraint chk_vinculo_subcontrato_consistente
  check (
    (tipo_vinculo = 'subcontrato' and subcontrato_id is not null)
    or (tipo_vinculo = 'directo' and subcontrato_id is null)
  );

create trigger trg_subcontratos_updated_at before update on subcontratos
  for each row execute function set_updated_at();

-- RLS: sólo admin_organizacion (o super_admin) gestiona subcontratos;
-- cualquier miembro de la organización puede leerlos (lo necesita el
-- formulario de alta de trabajadores para prevencionista también).

alter table subcontratos enable row level security;
alter table subcontratos_centros enable row level security;

create policy sel_subcontratos on subcontratos for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario()));

create policy mod_subcontratos on subcontratos for all to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', organizacion_id));

create policy sel_subcontratos_centros on subcontratos_centros for select to authenticated
  using (
    app_es_super_admin()
    or exists (
      select 1 from subcontratos s
      where s.id = subcontratos_centros.subcontrato_id
        and s.organizacion_id = any(app_organizaciones_usuario())
    )
  );

create policy mod_subcontratos_centros on subcontratos_centros for all to authenticated
  using (
    app_es_super_admin()
    or exists (
      select 1 from subcontratos s
      where s.id = subcontratos_centros.subcontrato_id
        and app_tiene_rol_en_org('admin_organizacion', s.organizacion_id)
    )
  )
  with check (
    app_es_super_admin()
    or exists (
      select 1 from subcontratos s
      where s.id = subcontratos_centros.subcontrato_id
        and app_tiene_rol_en_org('admin_organizacion', s.organizacion_id)
    )
  );

-- Extiende la matriz de vigencia con el tipo de vínculo y el subcontrato,
-- para poder desglosarlo en Analítica.

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
  end as estado_vigencia,
  vl.tipo_vinculo,
  vl.subcontrato_id,
  sc.nombre as subcontrato_nombre
from vinculos_laborales vl
join personas p on p.run = vl.persona_run
left join cargos c on c.id = vl.cargo_id
left join subcontratos sc on sc.id = vl.subcontrato_id
left join lateral (
  select i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
  from inscripciones i
  join ediciones_curso ec on ec.id = i.edicion_id
  where i.persona_run = p.run and i.estado = 'aprobado'
  order by i.fecha_aprobacion desc nulls last
  limit 1
) ult on true;
