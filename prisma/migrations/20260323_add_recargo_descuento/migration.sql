-- AlterTable: add recargo and descuento to TipoPago enum
ALTER TABLE `Pago` MODIFY COLUMN `tipo` ENUM('completo', 'parcial', 'capital', 'recargo', 'descuento') NOT NULL;
