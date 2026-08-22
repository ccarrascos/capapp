-- =====================================================================
-- Migración 0013: token de credencial QR por vínculo laboral.
-- Permite imprimir una etiqueta (credencial/casco) con un QR que enlaza
-- a una página pública de solo lectura con el estado de capacitación del
-- trabajador — sin exponer su RUT en la URL ni requerir sesión.
-- =====================================================================

alter table vinculos_laborales
  add column qr_token uuid not null default gen_random_uuid();

create unique index idx_vinculos_qr_token on vinculos_laborales(qr_token);
