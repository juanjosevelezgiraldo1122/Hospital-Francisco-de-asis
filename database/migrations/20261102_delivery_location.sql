-- Ejecutar una sola vez sobre la base hospital_francisco_asis ya desplegada.
-- Adiciona coordenadas de destino sin alterar los pedidos existentes.
ALTER TABLE solicitud_envio
  ADD COLUMN LATITUD_ENTREGA DECIMAL(10,7) NULL AFTER DIRECCION_ENTREGA;

-- Ejecutar esta segunda instruccion despues de confirmar que la latitud existe.
ALTER TABLE solicitud_envio
  ADD COLUMN LONGITUD_ENTREGA DECIMAL(10,7) NULL AFTER LATITUD_ENTREGA;
