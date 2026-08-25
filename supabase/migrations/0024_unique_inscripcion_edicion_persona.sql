-- =====================================================================
-- Migración 0024: restaurar la protección contra inscribir dos veces a
-- la misma persona en la misma edición.
--
-- La tabla original tenía unique(edicion_id, trabajador_id) — al migrar
-- de trabajador_id a persona_run (migración 0005, portabilidad DS 44)
-- esa restricción no se recreó, dejando la tabla sin protección desde
-- entonces. Un doble clic en "Inscribir" (o dos pestañas) podía crear
-- dos inscripciones para la misma persona en la misma edición.
-- =====================================================================

-- Antes de crear el índice único hay que eliminar duplicados que ya
-- existan, conservando la inscripción más completa de cada grupo: la
-- que tiene certificado, si no la aprobada, si no la más antigua.
with clasificadas as (
  select
    i.id,
    row_number() over (
      partition by i.edicion_id, i.persona_run
      order by
        (exists (select 1 from certificados c where c.inscripcion_id = i.id)) desc,
        (i.estado = 'aprobado') desc,
        i.fecha_inscripcion asc,
        i.id asc
    ) as rn
  from inscripciones i
)
delete from inscripciones
where id in (select id from clasificadas where rn > 1);

create unique index if not exists idx_inscripciones_edicion_persona
  on inscripciones (edicion_id, persona_run);
