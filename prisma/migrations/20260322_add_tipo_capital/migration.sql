-- AlterTable: Add 'capital' to TipoPago enum
ALTER TABLE `Pago` MODIFY COLUMN `tipo` ENUM('completo', 'parcial', 'capital') NOT NULL;
