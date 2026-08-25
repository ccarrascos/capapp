-- =====================================================================
-- Migración 0022: evita cursos duplicados dentro de una misma organización.
--
-- "Nuevo curso (plantilla DS44)" no comprobaba si ya existía un curso con
-- ese nombre — un doble clic (o volver a usar el botón sin darse cuenta de
-- que el curso ya estaba creado) generaba una segunda fila idéntica. La
-- app ahora valida antes de insertar; este índice es la barrera de
-- respaldo a nivel de base de datos, por si dos solicitudes llegan a la
-- vez. Sólo aplica a cursos con organización (los de un OAL/OTEC externo
-- no tienen organizacion_id y pueden compartir nombre entre clientes).
-- =====================================================================

create unique index if not exists idx_cursos_nombre_unico_por_org
  on cursos (organizacion_id, lower(trim(nombre)))
  where organizacion_id is not null;
