-- Permiso: el cobrador puede reabrir su caja sin esperar aprobacion del owner
ALTER TABLE `User`
  ADD COLUMN `puedeReabrirCajaSinAprobacion` BOOLEAN NOT NULL DEFAULT false;

-- Solicitud de reapertura de caja (pendiente de aprobacion del owner)
ALTER TABLE `CierreCaja`
  ADD COLUMN `solicitudReaperturaEn` DATETIME(3) NULL,
  ADD COLUMN `solicitudReaperturaPorId` VARCHAR(191) NULL;

ALTER TABLE `CierreCaja`
  ADD CONSTRAINT `CierreCaja_solicitudReaperturaPorId_fkey`
  FOREIGN KEY (`solicitudReaperturaPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `CierreCaja_solicitudReaperturaPorId_idx` ON `CierreCaja`(`solicitudReaperturaPorId`);
