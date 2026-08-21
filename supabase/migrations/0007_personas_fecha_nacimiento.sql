alter table personas add column fecha_nacimiento date;

comment on column personas.fecha_nacimiento is 'Fecha de nacimiento, para reportes de cumplimiento por rango etario.';
