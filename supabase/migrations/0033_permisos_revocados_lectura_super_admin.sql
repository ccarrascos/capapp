-- La app lee permisos_revocados sólo desde /configuracion (super_admin) y
-- desde el servidor con el cliente admin (tienePermiso), así que no hay
-- motivo para que cualquier autenticado conozca qué permisos se revocaron.

drop policy if exists sel_permisos_revocados on permisos_revocados;

create policy sel_permisos_revocados on permisos_revocados for select to authenticated
  using (app_es_super_admin());
