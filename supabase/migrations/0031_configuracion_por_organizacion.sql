-- Parámetros que cada organización puede ajustar para sí misma. NULL = usa
-- el valor de la plataforma (configuracion_plataforma).
--
--   vigencia_por_vencer_dias    libre entre 7 y 365
--   curso_horas_minimas         sólo puede subir sobre el mínimo de la plataforma
--   edicion_plazo_maximo_meses  sólo puede bajar bajo el máximo de la plataforma

alter table organizaciones
  add column vigencia_por_vencer_dias int,
  add column curso_horas_minimas int,
  add column edicion_plazo_maximo_meses int;

-- mod_organizaciones deja a un admin_organizacion editar su fila completa
-- vía API, así que los límites se validan aquí y no sólo en la app. Un
-- CHECK no puede leer configuracion_plataforma; un trigger sí.
create or replace function app_validar_configuracion_organizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vigencia_por_vencer_dias is not null
     and (new.vigencia_por_vencer_dias < 7 or new.vigencia_por_vencer_dias > 365) then
    raise exception 'La ventana "por vencer" debe estar entre 7 y 365 días.';
  end if;

  if new.curso_horas_minimas is not null
     and (new.curso_horas_minimas < app_config_int('curso_horas_minimas', 8) or new.curso_horas_minimas > 40) then
    raise exception 'Las horas del curso deben estar entre % y 40.', app_config_int('curso_horas_minimas', 8);
  end if;

  if new.edicion_plazo_maximo_meses is not null
     and (new.edicion_plazo_maximo_meses < 1
          or new.edicion_plazo_maximo_meses > app_config_int('edicion_plazo_maximo_meses', 3)) then
    raise exception 'El plazo de una edición debe estar entre 1 y % meses.', app_config_int('edicion_plazo_maximo_meses', 3);
  end if;

  return new;
end;
$$;

create trigger trg_organizaciones_validar_configuracion
  before insert or update of vigencia_por_vencer_dias, curso_horas_minimas, edicion_plazo_maximo_meses
  on organizaciones
  for each row execute function app_validar_configuracion_organizacion();

-- Ventana efectiva de una organización. security definer para que la vista
-- (security_invoker) obtenga el valor aunque quien consulta no pueda leer la
-- fila de organizaciones — sólo expone un número de días.
create or replace function app_ventana_por_vencer(p_org uuid) returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select vigencia_por_vencer_dias from organizaciones where id = p_org),
    app_config_int('vigencia_por_vencer_dias', 60)
  );
$$;

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
    when peor.vigencia_hasta <= (current_date + (app_ventana_por_vencer(vl.organizacion_id) || ' days')::interval) then 'por_vencer'
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
      when ultimo.vigencia_hasta <= (current_date + (app_ventana_por_vencer(vl.organizacion_id) || ' days')::interval) then 1
      else 2
    end asc,
    ultimo.vigencia_hasta asc nulls first
  limit 1
) peor on true
where u.id is null or u.activo = true;
