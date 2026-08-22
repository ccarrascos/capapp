-- =====================================================================
-- Migración 0011: logo de la organización.
-- Bucket público (solo lectura) para mostrarlo sin URLs firmadas en el
-- encabezado y en los certificados; solo super_admin o admin_organizacion
-- de esa organización pueden escribir en su propia carpeta ({organizacion_id}/...).
-- =====================================================================

alter table organizaciones add column logo_url text;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy sel_logos on storage.objects for select to public
  using (bucket_id = 'logos');

create policy ins_logos on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion'::rol_nombre, (storage.foldername(name))[1]::uuid)
    )
  );

create policy upd_logos on storage.objects for update to authenticated
  using (
    bucket_id = 'logos' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion'::rol_nombre, (storage.foldername(name))[1]::uuid)
    )
  );

create policy del_logos on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos' and (
      app_es_super_admin()
      or app_tiene_rol_en_org('admin_organizacion'::rol_nombre, (storage.foldername(name))[1]::uuid)
    )
  );
