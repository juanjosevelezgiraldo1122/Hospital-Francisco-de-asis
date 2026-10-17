-- Run once against the existing hospital_francisco_asis database.
-- Additive only: existing orders and records remain unchanged.
ALTER TABLE solicitud_envio
  ADD COLUMN EMAIL_CONTACTO VARCHAR(254) NULL AFTER TELEFONO_CONTACTO,
  ADD COLUMN NOTAS_ENTREGA VARCHAR(500) NULL AFTER EMAIL_CONTACTO;
