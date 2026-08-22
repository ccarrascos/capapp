-- =====================================================================
-- Migración 0010: corrige la política UPDATE de `personas`.
-- Un upsert (INSERT ... ON CONFLICT DO UPDATE) exige que se cumplan tanto
-- la política de INSERT como la de UPDATE, aunque no haya un conflicto
-- real — así lo aplica Postgres para no revelar si la fila ya existía.
-- La política anterior exigía un vínculo laboral YA EXISTENTE, lo que
-- bloqueaba el alta de una persona nueva (sin vínculo todavía). La
-- identidad de una persona no está acotada por organización — el control
-- por organización ya lo hace vinculos_laborales — así que basta con que
-- quien edita tenga el rol de gestión, igual que en el INSERT.
-- =====================================================================

drop policy if exists upd_personas on personas;

create policy upd_personas on personas for update to authenticated
  using (app_es_super_admin() or app_puede_gestionar_trabajadores())
  with check (app_es_super_admin() or app_puede_gestionar_trabajadores());
