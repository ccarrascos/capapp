-- =====================================================================
-- Migración 0003: materiales didácticos (Anexo Metodológico, punto 5)
-- Manual del participante, manual del facilitador, material por módulo,
-- y evidencia de entrega del manual a cada trabajador inscrito.
-- =====================================================================

-- 1. Columnas nuevas -----------------------------------------------------

alter table cursos
  add column manual_participante_path text,
  add column manual_facilitador_path text;

alter table modulos
  add column material_path text;

alter table inscripciones
  add column manual_entregado boolean not null default false,
  add column manual_entregado_fecha date;

-- 2. Bucket de almacenamiento ---------------------------------------------
-- Ruta: {organizacion_id}/cursos/{curso_id}/... — privado, con RLS.

insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', false)
on conflict (id) do nothing;

-- 3. RLS sobre storage.objects para el bucket 'materiales' ----------------

create policy sel_materiales on storage.objects for select to authenticated
  using (
    bucket_id = 'materiales' and (
      app_es_super_admin()
      or (storage.foldername(name))[1]::uuid = any(app_organizaciones_usuario())
    )
  );

create policy ins_materiales on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materiales' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion', (storage.foldername(name))[1]::uuid)
      or app_tiene_rol_en_org('prevencionista', (storage.foldername(name))[1]::uuid)
    )
  );

create policy upd_materiales on storage.objects for update to authenticated
  using (
    bucket_id = 'materiales' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion', (storage.foldername(name))[1]::uuid)
      or app_tiene_rol_en_org('prevencionista', (storage.foldername(name))[1]::uuid)
    )
  );

create policy del_materiales on storage.objects for delete to authenticated
  using (
    bucket_id = 'materiales' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion', (storage.foldername(name))[1]::uuid)
      or app_tiene_rol_en_org('prevencionista', (storage.foldername(name))[1]::uuid)
    )
  );
