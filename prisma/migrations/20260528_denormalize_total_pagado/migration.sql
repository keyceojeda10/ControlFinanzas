-- Denormalizar totalPagado y ultimoPagoAt en Prestamo
-- Evita iterar todos los pagos en cada lectura de listados.
-- Es no destructivo: las columnas tienen default y son opcionales.

ALTER TABLE `Prestamo` ADD COLUMN `totalPagado` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `Prestamo` ADD COLUMN `ultimoPagoAt` DATETIME(3) NULL;

-- Poblar valores iniciales sumando pagos validos (excluyendo recargo y descuento).
UPDATE `Prestamo` p
SET totalPagado = COALESCE((
  SELECT SUM(montoPagado)
  FROM `Pago`
  WHERE prestamoId = p.id
    AND tipo NOT IN ('recargo', 'descuento')
), 0);

UPDATE `Prestamo` p
SET ultimoPagoAt = (
  SELECT MAX(fechaPago)
  FROM `Pago`
  WHERE prestamoId = p.id
    AND tipo NOT IN ('recargo', 'descuento')
);

-- Indice nuevo en Prestamo: prestamos del cliente filtrados por estado.
CREATE INDEX `Prestamo_organizationId_clienteId_estado_idx`
  ON `Prestamo`(`organizationId`, `clienteId`, `estado`);
