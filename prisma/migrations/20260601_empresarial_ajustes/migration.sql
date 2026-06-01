-- Ajustes plan empresarial: editar cierre (auditoria) + capital por ruta.
-- Todas las columnas son nullable o con default; migracion no-destructiva.

-- B: editar cierre de caja — auditoria de ultima edicion
ALTER TABLE `CierreCaja`
  ADD COLUMN `editadoEn` DATETIME(3) NULL,
  ADD COLUMN `editadoPorId` VARCHAR(191) NULL;

-- A: capital por ruta — movimiento etiquetado por ruta + saldo denormalizado por ruta
ALTER TABLE `MovimientoCapital`
  ADD COLUMN `rutaId` VARCHAR(191) NULL;

ALTER TABLE `Ruta`
  ADD COLUMN `saldoCapital` DOUBLE NOT NULL DEFAULT 0;

CREATE INDEX `MovimientoCapital_organizationId_rutaId_createdAt_idx`
  ON `MovimientoCapital`(`organizationId`, `rutaId`, `createdAt`);
