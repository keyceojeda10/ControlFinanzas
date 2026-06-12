-- Agregar campo interesPagado a CuotaAmortizacion para trackear pagos parciales de solo interes
ALTER TABLE `CuotaAmortizacion` ADD COLUMN `interesPagado` DOUBLE NOT NULL DEFAULT 0;

-- Agregar tipo de pago 'intereses' al enum TipoPago
ALTER TABLE `Pago` MODIFY COLUMN `tipo` ENUM('completo','parcial','capital','recargo','descuento','liquidacion','intereses') NOT NULL;
