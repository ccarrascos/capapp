-- =====================================================================
-- Migración 0026: la política INSERT de historial_centro_trabajo usaba
-- app_puede_gestionar_trabajadores(), que sólo verifica "¿tiene el rol
-- en ALGUNA organización?" sin comparar contra la organización de la
-- fila que se está insertando — el mismo problema que la migración
-- 0018 ya corrigió para personas/notificaciones/auditoria_log, pero
-- esta tabla se creó después (migración 0012) y quedó sin el arreglo.
--
-- Un admin_organizacion o prevencionista de la Organización A podía
-- insertar una fila con organizacion_id de la Organización B (y
-- cualquier persona_run), falsificando un cambio de centro en el
-- historial de cumplimiento de otra organización.
-- =====================================================================

drop policy if exists ins_historial_centro on historial_centro_trabajo;
create policy ins_historial_centro on historial_centro_trabajo for insert to authenticated
  with check (
    app_es_super_admin()
    or app_tiene_rol_en_org('admin_organizacion', organizacion_id)
    or app_tiene_rol_en_org('prevencionista', organizacion_id)
  );
