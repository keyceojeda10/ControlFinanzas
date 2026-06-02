-- Wompi: pasarela de pago de suscripcion para Colombia (Nequi).
-- Campos en Suscripcion para registrar pagos hechos con Wompi.
-- Columnas no-destructivas (nullable). No afecta suscripciones existentes (MercadoPago).
ALTER TABLE `Suscripcion`
  ADD COLUMN `gatewayPago` VARCHAR(191) NULL,
  ADD COLUMN `wompiTransactionId` VARCHAR(191) NULL,
  ADD COLUMN `wompiReference` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Suscripcion_wompiTransactionId_key` ON `Suscripcion`(`wompiTransactionId`);
