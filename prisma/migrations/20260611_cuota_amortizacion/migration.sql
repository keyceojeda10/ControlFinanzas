-- Tabla de amortizacion para prestamos en modoInteres = 'lineal' (cuota
-- decreciente: capital constante por periodo + interes sobre saldo restante).
-- Tabla nueva, no afecta columnas existentes de Prestamo.
CREATE TABLE `CuotaAmortizacion` (
  `id` VARCHAR(191) NOT NULL,
  `prestamoId` VARCHAR(191) NOT NULL,
  `numeroPeriodo` INTEGER NOT NULL,
  `capital` DOUBLE NOT NULL,
  `interes` DOUBLE NOT NULL,
  `cuotaTotal` DOUBLE NOT NULL,
  `saldoRestante` DOUBLE NOT NULL,
  `pagado` DOUBLE NOT NULL DEFAULT 0,
  `fechaEsperada` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CuotaAmortizacion_prestamoId_numeroPeriodo_key`(`prestamoId`, `numeroPeriodo`),
  INDEX `CuotaAmortizacion_prestamoId_idx`(`prestamoId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CuotaAmortizacion`
  ADD CONSTRAINT `CuotaAmortizacion_prestamoId_fkey`
  FOREIGN KEY (`prestamoId`) REFERENCES `Prestamo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
