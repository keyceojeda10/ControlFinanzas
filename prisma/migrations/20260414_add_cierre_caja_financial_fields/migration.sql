-- AlterTable: persist additional financial totals in daily cash closure
ALTER TABLE `CierreCaja`
  ADD COLUMN `totalDesembolsado` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `saldoOperativo` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `saldoRealCaja` DOUBLE NOT NULL DEFAULT 0;

-- Backfill historical rows with the closest equivalent available totals
UPDATE `CierreCaja`
SET
  `saldoOperativo` = `totalRecogido` - `totalGastos`,
  `saldoRealCaja` = `totalRecogido` - `totalGastos`
WHERE 1 = 1;
