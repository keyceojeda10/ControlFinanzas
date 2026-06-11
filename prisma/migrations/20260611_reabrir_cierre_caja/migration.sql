-- Reapertura de cierre de caja: mientras la caja del cobrador esta cerrada
-- (CierreCaja existe y reabiertoEn es NULL), el endpoint de pagos rechaza
-- nuevos abonos. Reabrir deja rastro de quien y cuando.
ALTER TABLE `CierreCaja`
  ADD COLUMN `reabiertoEn` DATETIME(3) NULL,
  ADD COLUMN `reabiertoPorId` VARCHAR(191) NULL;
