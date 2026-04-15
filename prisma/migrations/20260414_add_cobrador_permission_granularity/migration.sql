-- Granular permissions for cobradores
ALTER TABLE `User`
  ADD COLUMN `puedeGestionarPrestamos` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `puedeReportarGastos` BOOLEAN NOT NULL DEFAULT true;

-- Backfill: existing cobradores who could create loans keep loan-management access
UPDATE `User`
SET `puedeGestionarPrestamos` = `puedeCrearPrestamos`
WHERE `rol` = 'cobrador';
