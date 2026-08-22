-- =====================================================================
-- Migración 0017: si la cuenta de acceso de un trabajador está
-- desactivada, ya no debe contarse en la matriz de vigencia ni en la
-- analítica (personas sin cuenta de acceso — la mayoría — no se ven
-- afectadas, sólo las que tienen usuario y ese usuario está inactivo).
-- =====================================================================

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
    when peor.vigencia_hasta <= (current_date + interval '60 days') then 'por_vencer'
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
      when ultimo.vigencia_hasta <= (current_date + interval '60 days') then 1
      else 2
    end asc,
    ultimo.vigencia_hasta asc nulls first
  limit 1
) peor on true
where u.id is null or u.activo = true;
