-- =====================================================================
-- Migración 0021: corrige la deduplicación de notificaciones.
--
-- El índice único de la migración 0020 era parcial
-- (`where inscripcion_id is not null`). Postgres exige que un
-- `ON CONFLICT (columnas)` sin predicado explícito coincida con un índice
-- SIN predicado para poder usarlo como "arbiter" — como PostgREST/supabase-js
-- no permite enviar un predicado en `upsert(...)`, cada intento de insertar
-- fallaba con "no unique or exclusion constraint matching the ON CONFLICT
-- specification", y como el código no revisaba ese error, las notificaciones
-- nunca se creaban (la tabla quedaba vacía pese a haber vencimientos reales).
--
-- Se reemplaza por un índice único normal — sigue funcionando igual para
-- deduplicar, porque Postgres trata cada NULL de inscripcion_id como
-- distinto entre sí (no se comparan como iguales), así que filas sin
-- inscripcion_id nunca chocan entre ellas.
-- =====================================================================

drop index if exists idx_notificaciones_dedup;

create unique index if not exists idx_notificaciones_dedup
  on notificaciones (usuario_id, inscripcion_id, tipo);
