-- =====================================================================
-- Migración 0020: soporte para notificaciones de vencimiento en la app.
--
-- Agrega `inscripcion_id` a `notificaciones` para poder deduplicar: como
-- máximo una notificación de cada tipo (vencimiento_proximo / vencido)
-- por destinatario y por ciclo de aprobación (inscripcion_id cambia cada
-- vez que la persona vuelve a aprobar el curso), en vez de generar una
-- fila nueva cada vez que alguien visita la app.
-- =====================================================================

alter table notificaciones
  add column if not exists inscripcion_id uuid references inscripciones(id) on delete cascade;

create unique index if not exists idx_notificaciones_dedup
  on notificaciones (usuario_id, inscripcion_id, tipo)
  where inscripcion_id is not null;
