-- La contraseña temporal que se envía por correo (alta de cuenta, "dar
-- acceso" a un trabajador, o un nuevo acceso solicitado tras caducar)
-- debe dejar de servir 72 horas después de enviarse, para limitar la
-- ventana de exposición de una clave que viaja en texto plano por email.
-- null = no hay una contraseña temporal pendiente (cuenta nunca tuvo una,
-- o ya inició sesión con ella y quedó liberada).
alter table usuarios add column password_temporal_expira_en timestamptz;
