-- El acceso al sistema pasa a ser por RUT en vez de correo (art. 16 DS 44:
-- el trabajador se identifica ante la fiscalización por su RUN). El correo
-- se mantiene como dato de contacto y como identificador interno ante
-- Supabase Auth, pero deja de pedirse en el formulario de ingreso.

alter table usuarios add column run text;
alter table usuarios add column dv text;

create unique index usuarios_run_key on usuarios (run) where run is not null;

comment on column usuarios.run is 'RUN sin puntos ni DV. Identificador de acceso (login). Para cuentas de rol trabajador coincide con personas.run.';
comment on column usuarios.dv is 'Dígito verificador del RUN de acceso.';
