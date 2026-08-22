-- =====================================================================
-- Migración 0015: el estado de vigencia de un trabajador debe reflejar
-- el PEOR curso entre todos los que tiene aprobados, no solo el más
-- reciente. Antes, alguien con dos cursos aprobados (uno vigente, otro
-- vencido) aparecía como "vigente" en la matriz porque la vista solo
-- miraba la aprobación más reciente — la misma lógica ya se corrigió en
-- la credencial QR; ahora se alinea la vista para que la matriz, la
-- analítica y el popup usen el mismo criterio.
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
left join lateral (
  select i.id as inscripcion_id, ec.curso_id, i.fecha_aprobacion, i.vigencia_hasta
  from inscripciones i
  join ediciones_curso ec on ec.id = i.edicion_id
  where i.persona_run = p.run and i.estado = 'aprobado'
  order by
    case
      when i.vigencia_hasta is null then 0
      when i.vigencia_hasta < current_date then 0
      when i.vigencia_hasta <= (current_date + interval '60 days') then 1
      else 2
    end asc,
    i.vigencia_hasta asc nulls first
  limit 1
) peor on true;
