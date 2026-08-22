-- =====================================================================
-- Migración 0012: historial de cambios de centro de trabajo.
-- vinculos_laborales sólo guarda el centro ACTUAL — al editar un
-- trabajador, el valor anterior se pierde. Esta tabla registra cada
-- cambio para poder mostrar "en qué centros ha estado y cuándo" en el
-- detalle rápido de la matriz de vigencia.
-- =====================================================================

create table historial_centro_trabajo (
  id uuid primary key default gen_random_uuid(),
  persona_run text not null references personas(run) on delete cascade,
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  centro_anterior_id uuid references centros_trabajo(id) on delete set null,
  centro_nuevo_id uuid references centros_trabajo(id) on delete set null,
  cambiado_en timestamptz not null default now(),
  cambiado_por uuid references usuarios(id) on delete set null
);

create index idx_historial_centro_persona on historial_centro_trabajo(persona_run, organizacion_id);

alter table historial_centro_trabajo enable row level security;

create policy sel_historial_centro on historial_centro_trabajo for select to authenticated
  using (app_es_super_admin() or organizacion_id = any(app_organizaciones_usuario()));

create policy ins_historial_centro on historial_centro_trabajo for insert to authenticated
  with check (app_es_super_admin() or app_puede_gestionar_trabajadores());
