-- =====================================================================
-- Migración 0023: nuevo tipo de notificación "certificado_emitido".
--
-- "curso_finalizado" (ya existía en el enum, sin usar hasta ahora) pasa a
-- avisarle al trabajador que fue aprobado. Emitir el certificado es un
-- paso aparte, en otro momento — necesita su propio tipo para que la
-- deduplicación (usuario_id, inscripcion_id, tipo) no confunda ambos
-- avisos como el mismo evento.
-- =====================================================================

alter type tipo_notificacion add value if not exists 'certificado_emitido';
