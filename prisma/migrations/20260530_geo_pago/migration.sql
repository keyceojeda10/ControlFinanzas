-- Geolocalizacion del pago (MVP). Columnas nullable: no rompe pagos viejos.
ALTER TABLE `Pago`
  ADD COLUMN `latitud` DOUBLE NULL,
  ADD COLUMN `longitud` DOUBLE NULL;
