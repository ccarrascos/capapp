-- =====================================================================
-- Migración 0002: la vista matriz_vigencia_capacitacion debe ejecutarse
-- con los privilegios de quien consulta (security_invoker), no del
-- owner (postgres, que tiene BYPASSRLS). Sin esto, cualquier usuario
-- autenticado vería trabajadores de todas las organizaciones.
-- =====================================================================

alter view matriz_vigencia_capacitacion set (security_invoker = true);
