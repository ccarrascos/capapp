-- =====================================================================
-- Migración 0018: endurecimiento de seguridad (auditoría 2026-08-23).
--
-- Corrige tres brechas encontradas en una auditoría adversarial:
--
-- 1. mod_inscripciones / mod_asistencias / mod_evaluaciones exigían sólo
--    "tener algún rol en la organización" (app_organizaciones_usuario()),
--    lo que permitía a roles de sólo lectura (auditor, supervisor_centro)
--    insertar inscripciones, marcar asistencia y aprobar evaluaciones —
--    falsificando el registro de cumplimiento que produce esta app.
--    Se acota a admin_organizacion/prevencionista de la organización, o
--    al facilitador a cargo de esa edición puntual.
--
-- 2. upd_personas usaba app_puede_gestionar_trabajadores(), que sólo
--    verifica que el actor tenga el rol admin_organizacion/prevencionista
--    EN ALGUNA organización, no en la organización donde la persona
--    objetivo realmente trabaja. Eso permitía que un admin de la
--    Organización A sobrescribiera el nombre/fecha de nacimiento/email de
--    una persona que sólo existe en la Organización B. Se vuelve a acotar
--    por vínculo laboral real, como en la versión original (migración
--    0005) — la migración 0010 relajó esto pensando en un upsert que la
--    app ya no usa (crearTrabajador hace select + insert/update explícito,
--    no INSERT ... ON CONFLICT).
--
-- 3. ins_notificaciones e ins_auditoria aceptaban "with check (true)" para
--    cualquier usuario autenticado, permitiendo insertar notificaciones
--    dirigidas a otra persona o forjar filas en la bitácora de auditoría.
--    Ninguna de las dos tablas tiene aún código de aplicación que las use,
--    así que este endurecimiento no rompe nada existente.
--
-- Además agrega `certificados.token`: un identificador aleatorio para la
-- página pública /validar/[token], en vez de usar numero_certificado (que
-- incluye el RUT del titular y es adivinable dentro de una ventana de
-- tiempo conocida).
-- =====================================================================

-- 1. Inscripciones / asistencias / evaluaciones: sólo gestión, no cualquier rol.

drop policy if exists mod_inscripciones on inscripciones;
create policy mod_inscripciones on inscripciones for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from ediciones_curso ec where ec.id = inscripciones.edicion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

drop policy if exists mod_asistencias on asistencias_modulo;
create policy mod_asistencias on asistencias_modulo for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = asistencias_modulo.inscripcion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

drop policy if exists mod_evaluaciones on evaluaciones_resultado;
create policy mod_evaluaciones on evaluaciones_resultado for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from inscripciones i join ediciones_curso ec on ec.id = i.edicion_id
    where i.id = evaluaciones_resultado.inscripcion_id
      and (app_tiene_rol_en_org('admin_organizacion', ec.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', ec.organizacion_id)
        or ec.facilitador_id in (select id from facilitadores where usuario_id = auth.uid()))
  ));

-- 2. personas: la edición de identidad exige un vínculo laboral real con
--    una organización donde el actor administra, no sólo el rol en abstracto.

drop policy if exists upd_personas on personas;
create policy upd_personas on personas for update to authenticated
  using (
    app_es_super_admin()
    or exists (
      select 1 from vinculos_laborales vl
      where vl.persona_run = personas.run
        and (app_tiene_rol_en_org('admin_organizacion', vl.organizacion_id)
          or app_tiene_rol_en_org('prevencionista', vl.organizacion_id))
    )
  )
  with check (
    app_es_super_admin()
    or exists (
      select 1 from vinculos_laborales vl
      where vl.persona_run = personas.run
        and (app_tiene_rol_en_org('admin_organizacion', vl.organizacion_id)
          or app_tiene_rol_en_org('prevencionista', vl.organizacion_id))
    )
  );

-- 3. notificaciones / auditoria_log: ya no se aceptan inserciones abiertas.

drop policy if exists ins_notificaciones on notificaciones;
create policy ins_notificaciones on notificaciones for insert to authenticated
  with check (app_es_super_admin() or usuario_id = auth.uid());

drop policy if exists ins_auditoria on auditoria_log;
create policy ins_auditoria on auditoria_log for insert to authenticated
  with check (app_es_super_admin() or usuario_id = auth.uid());

-- 4. Token aleatorio para la verificación pública de certificados, en vez
--    de numero_certificado (que embebe el RUT del titular).

alter table certificados add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists idx_certificados_token on certificados(token);
