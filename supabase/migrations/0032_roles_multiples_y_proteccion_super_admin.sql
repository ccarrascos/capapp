-- =====================================================================
-- 1) Escalamiento de privilegios: mod_usuario_roles deja que un
--    admin_organizacion inserte/edite cualquier fila de usuario_roles de su
--    organización, y app_es_super_admin() sólo mira el nombre del rol (no
--    la organización). Llamando directo a la API, un admin_organizacion
--    podía asignarse super_admin a sí mismo. Este trigger lo impide: sólo un
--    super_admin (o el service role / SQL editor, auth.uid() nulo) puede
--    asignar, cambiar o quitar el rol super_admin.
-- =====================================================================

create or replace function app_proteger_rol_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super uuid;
begin
  if auth.uid() is null or app_es_super_admin() then
    return coalesce(new, old);
  end if;

  select id into v_super from roles where nombre = 'super_admin';

  if (tg_op in ('INSERT', 'UPDATE') and new.rol_id = v_super)
     or (tg_op in ('UPDATE', 'DELETE') and old.rol_id = v_super) then
    raise exception 'Sólo un super administrador puede asignar o quitar el rol de super administrador.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_usuario_roles_proteger_super_admin
  before insert or update or delete on usuario_roles
  for each row execute function app_proteger_rol_super_admin();

-- =====================================================================
-- 2) Varios roles por cuenta: usuario_roles ya lo permitía (una fila por
--    rol). El índice único original incluye centro_trabajo_id, que es NULL
--    para casi todos los roles — y en Postgres dos NULL no chocan en un
--    unique, así que se podía repetir el mismo rol en la misma organización.
-- =====================================================================

create unique index if not exists uq_usuario_roles_sin_centro
  on usuario_roles (usuario_id, rol_id, coalesce(organizacion_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where centro_trabajo_id is null;
