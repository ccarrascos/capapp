-- =====================================================================
-- Migración 0027: sexo de la persona
--
-- Se agrega junto a fecha_nacimiento (migración 0007) porque comparte el
-- mismo propósito: reportes demográficos de la matriz de cumplimiento
-- (distribución etaria y por sexo en Analítica). Opcional — las personas
-- ya registradas quedan sin dato hasta que se edite su ficha.
-- =====================================================================

create type sexo_persona as enum ('masculino', 'femenino', 'otro');

alter table personas add column sexo sexo_persona;

comment on column personas.sexo is 'Sexo de la persona, para reportes demográficos. Opcional.';
