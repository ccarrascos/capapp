-- =====================================================================
-- Migración 0019: sólo un super administrador puede activar/desactivar
-- una organización (ej. por falta de pago).
--
-- La política mod_organizaciones ya permite que un admin_organizacion
-- edite los datos de su propia organización (dirección, logo, etc.) — eso
-- es correcto y se mantiene. Pero sin esta protección adicional, ese mismo
-- admin_organizacion podría reactivarse a sí mismo llamando directamente a
-- la API si su organización fuera desactivada por falta de pago, ya que
-- `activo` es sólo una columna más dentro de esa misma fila. Un trigger
-- BEFORE UPDATE bloquea cualquier cambio a `activo` que no venga de un
-- super_admin, sin tocar el resto de los campos que sí puede editar.
-- =====================================================================

create or replace function app_proteger_activo_organizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activo is distinct from old.activo and not app_es_super_admin() then
    raise exception 'Sólo un super administrador puede activar o desactivar una organización.';
  end if;
  return new;
end;
$$;

create trigger trg_organizaciones_proteger_activo
  before update on organizaciones
  for each row execute function app_proteger_activo_organizacion();
