-- =====================================================================
-- Migración 0008: foto de perfil del usuario.
-- Bucket público (solo lectura) para que el avatar se pueda mostrar sin
-- URLs firmadas; cada usuario solo puede escribir en su propia carpeta
-- ({usuario_id}/...), identificada por auth.uid().
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy sel_avatars on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy ins_avatars on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy upd_avatars on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy del_avatars on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
