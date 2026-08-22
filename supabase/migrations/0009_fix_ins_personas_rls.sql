-- =====================================================================
-- Migración 0009: corrige la política INSERT de `personas`.
-- La política original consultaba usuario_roles directamente dentro del
-- WITH CHECK, en vez de a través de una función SECURITY DEFINER como el
-- resto de las políticas (app_es_super_admin, app_tiene_rol_en_org) — eso
-- somete la subconsulta a la RLS propia de usuario_roles, en vez de
-- evaluarse con privilegios elevados, y puede rechazar inserciones válidas.
-- =====================================================================

create or replace function app_puede_gestionar_trabajadores()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuario_roles ur join roles r on r.id = ur.rol_id
    where ur.usuario_id = auth.uid()
      and r.nombre in ('admin_organizacion', 'prevencionista')
  );
$$;

drop policy if exists ins_personas on personas;

create policy ins_personas on personas for insert to authenticated
  with check (app_es_super_admin() or app_puede_gestionar_trabajadores());
