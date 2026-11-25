-- =====================================================================
-- Migración 0034: endurecimiento Zero Trust (auditoría 2026-11-19).
--
-- 1. modulos: solo gestión puede escribir (antes cualquier rol de la org).
-- 2. usuarios: el dueño no puede tocar activo/run/dv/email/clave temporal
--    ni apuntar avatar_url fuera de Storage vía API directa.
-- 3. Una cuenta desactivada pierde todo permiso en RLS (no sólo en la app).
-- 4. organizaciones.logo_url sólo desde Storage; un admin ya no puede
--    borrar (DELETE) su propia organización.
-- 5. Límites de tamaño/MIME en buckets; RPC interna con EXECUTE acotado.
-- 6. Contador atómico de intentos (login y recuperación) con bloqueo
--    exponencial: elimina la condición de carrera de leer y luego escribir.
--
-- EJECUTAR ANTES de desplegar el código que llama a
-- app_consumir_intento (login/actions.ts), o el login dejará de funcionar.
-- =====================================================================

-- 1. modulos ----------------------------------------------------------

drop policy if exists mod_modulos on modulos;
create policy mod_modulos on modulos for all to authenticated
  using (app_es_super_admin() or exists (
    select 1 from cursos c where c.id = modulos.curso_id
      and c.organizacion_id is not null
      and (app_tiene_rol_en_org('admin_organizacion', c.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', c.organizacion_id))
  ))
  with check (app_es_super_admin() or exists (
    select 1 from cursos c where c.id = modulos.curso_id
      and c.organizacion_id is not null
      and (app_tiene_rol_en_org('admin_organizacion', c.organizacion_id)
        or app_tiene_rol_en_org('prevencionista', c.organizacion_id))
  ));

-- 2. usuarios: columnas protegidas -------------------------------------

create or replace function app_proteger_campos_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Service role (auth.uid() nulo) y super_admin pasan; el resto sólo edita
  -- nombres/apellidos/teléfono/avatar de su propia fila.
  if auth.uid() is null or app_es_super_admin() then
    return new;
  end if;
  if new.activo is distinct from old.activo
     or new.run is distinct from old.run
     or new.dv is distinct from old.dv
     or new.email is distinct from old.email
     or new.password_temporal_expira_en is distinct from old.password_temporal_expira_en then
    raise exception 'Campo protegido.';
  end if;
  if new.avatar_url is not null
     and new.avatar_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/' then
    raise exception 'avatar_url inválida.';
  end if;
  return new;
end $$;

drop trigger if exists trg_usuarios_proteger_campos on usuarios;
create trigger trg_usuarios_proteger_campos before update on usuarios
  for each row execute function app_proteger_campos_usuario();

-- 3. Cuenta desactivada = sin permisos en RLS ---------------------------

create or replace function app_es_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_roles ur
      join roles r on r.id = ur.rol_id
      join usuarios u on u.id = ur.usuario_id
    where ur.usuario_id = auth.uid() and r.nombre = 'super_admin' and u.activo
  );
$$;

create or replace function app_organizaciones_usuario() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct ur.organizacion_id), '{}')
  from usuario_roles ur join usuarios u on u.id = ur.usuario_id
  where ur.usuario_id = auth.uid() and ur.organizacion_id is not null and u.activo;
$$;

create or replace function app_tiene_rol_en_org(p_rol rol_nombre, p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_roles ur
      join roles r on r.id = ur.rol_id
      join usuarios u on u.id = ur.usuario_id
    where ur.usuario_id = auth.uid() and r.nombre = p_rol
      and ur.organizacion_id = p_org and u.activo
  );
$$;

-- 4. organizaciones: logo_url sólo de Storage; sin DELETE para admin_org --

create or replace function app_validar_logo_url() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.logo_url is not null
     and new.logo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/logos/' then
    raise exception 'logo_url inválida.';
  end if;
  return new;
end $$;

drop trigger if exists trg_org_validar_logo on organizaciones;
create trigger trg_org_validar_logo before insert or update of logo_url on organizaciones
  for each row execute function app_validar_logo_url();

drop policy if exists mod_organizaciones on organizaciones;
create policy ins_organizaciones on organizaciones for insert to authenticated
  with check (app_es_super_admin());
create policy upd_organizaciones on organizaciones for update to authenticated
  using (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', id))
  with check (app_es_super_admin() or app_tiene_rol_en_org('admin_organizacion', id));
create policy del_organizaciones on organizaciones for delete to authenticated
  using (app_es_super_admin());

-- 5. Storage y RPC ------------------------------------------------------

update storage.buckets set file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
update storage.buckets set file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'logos';
update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ] where id = 'materiales';

revoke execute on function app_ventana_por_vencer(uuid) from public, anon;
grant execute on function app_ventana_por_vencer(uuid) to authenticated;

-- 6. Contador atómico de intentos con bloqueo exponencial ---------------

alter table intentos_login add column if not exists bloqueos int not null default 0;

-- Consume un intento ANTES de verificar la clave. Devuelve true si el
-- intento está permitido, false si la clave está bloqueada o se excedió el
-- máximo (en cuyo caso inicia/extiende el bloqueo: ventana x 5^bloqueos
-- minutos, tope 24 h: 15, 75, 375… con la ventana por defecto). El row lock
-- serializa ráfagas paralelas.
create or replace function app_consumir_intento(
  p_run text, p_dv text, p_max int, p_ventana_min int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamptz := now();
  v_fila intentos_login%rowtype;
  v_vigente boolean;
  v_n int;
begin
  delete from intentos_login where ultimo_intento < v_ahora - interval '24 hours';

  insert into intentos_login (run, dv, intentos, ultimo_intento)
    values (p_run, p_dv, 0, v_ahora)
    on conflict (run, dv) do nothing;

  select * into v_fila from intentos_login where run = p_run and dv = p_dv for update;

  if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > v_ahora then
    return false;
  end if;

  v_vigente := v_fila.ultimo_intento > v_ahora - make_interval(mins => p_ventana_min)
    and not (v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta <= v_ahora);
  v_n := (case when v_vigente then v_fila.intentos else 0 end) + 1;

  if v_n > p_max then
    update intentos_login set
      intentos = v_n,
      ultimo_intento = v_ahora,
      bloqueos = v_fila.bloqueos + 1,
      -- El exponente se acota antes de calcular: 5^14 ya no cabe en int y
      -- un RUT atacado sin pausa dejaría el login lanzando error.
      bloqueado_hasta = v_ahora + make_interval(
        mins => least(p_ventana_min * power(5, least(v_fila.bloqueos, 6))::int, 1440))
    where run = p_run and dv = p_dv;
    return false;
  end if;

  update intentos_login set intentos = v_n, ultimo_intento = v_ahora
    where run = p_run and dv = p_dv;
  return true;
end $$;

revoke execute on function app_consumir_intento(text, text, int, int) from public, anon, authenticated;
grant execute on function app_consumir_intento(text, text, int, int) to service_role;
