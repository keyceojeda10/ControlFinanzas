-- Capital por ruta (refinamiento): marca de "ajuste de arranque de ruta".
-- Un MovimientoCapital con ajusteArranqueRuta=true solo afecta la sub-bolsa
-- de la ruta (Ruta.saldoCapital), NO el saldo global de la organizacion.
-- Sirve para descontar los prestamos ya activos al inyectar capital a una ruta,
-- sin descuadrar el saldo global (que ya es historicamente correcto).
-- Columna no-destructiva (default false).
ALTER TABLE `MovimientoCapital`
  ADD COLUMN `ajusteArranqueRuta` BOOLEAN NOT NULL DEFAULT false;
