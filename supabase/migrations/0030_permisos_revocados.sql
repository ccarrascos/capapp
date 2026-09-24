-- Permisos por rol administrables desde /configuracion (sólo super_admin).
--
-- El catálogo de acciones y el máximo de roles de cada una viven en código
-- (src/lib/permisos-catalogo.ts) y coinciden con lo que las políticas RLS
-- permiten hoy. Esta tabla guarda sólo las REVOCACIONES: una fila (rol,
-- accion) quita ese permiso a ese rol. Sin filas, todo funciona como antes.
-- No se puede otorgar más de lo que RLS permite, por construcción.

create table permisos_revocados (
  rol rol_nombre not null,
  accion text not null,
  revocado_en timestamptz not null default now(),
  revocado_por uuid references usuarios(id),
  primary key (rol, accion),
  -- super_admin siempre conserva todo: es el resguardo para poder revertir.
  constraint chk_permisos_revocados_no_super_admin check (rol <> 'super_admin')
);

alter table permisos_revocados enable row level security;

create policy sel_permisos_revocados on permisos_revocados for select to authenticated
  using (true);

create policy adm_permisos_revocados on permisos_revocados for all to authenticated
  using (app_es_super_admin())
  with check (app_es_super_admin());
