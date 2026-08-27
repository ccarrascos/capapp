-- =====================================================================
-- Migración 0025: las políticas SELECT de `cursos` y `modulos` eran
-- `using (true)` desde la migración inicial y nunca se corrigieron —
-- cualquier usuario autenticado, de cualquier organización, podía leer
-- el catálogo completo de cursos (y sus módulos) de TODAS las
-- organizaciones vía el cliente de Supabase directo, sin pasar por la
-- UI ni por ningún filtro de la app.
--
-- Se preserva el acceso de facilitadores "solo facilitador" (sin fila
-- en usuario_roles, sólo facilitadores.usuario_id) al catálogo de su
-- propia organización — el mismo patrón que ya usa sel_ediciones.
-- =====================================================================

drop policy if exists sel_cursos on cursos;
create policy sel_cursos on cursos for select to authenticated
  using (
    app_es_super_admin()
    or organizacion_id = any(app_organizaciones_usuario())
    or exists (
      select 1 from facilitadores f
      where f.usuario_id = auth.uid() and f.organizacion_id = cursos.organizacion_id
    )
  );

drop policy if exists sel_modulos on modulos;
create policy sel_modulos on modulos for select to authenticated
  using (
    app_es_super_admin()
    or exists (
      select 1 from cursos c
      where c.id = modulos.curso_id
        and (
          c.organizacion_id = any(app_organizaciones_usuario())
          or exists (
            select 1 from facilitadores f
            where f.usuario_id = auth.uid() and f.organizacion_id = c.organizacion_id
          )
        )
    )
  );
