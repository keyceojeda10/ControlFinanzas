-- Relacion para mostrar quien reabrio un cierre de caja (auditoria visible en UI)
ALTER TABLE `CierreCaja`
  ADD CONSTRAINT `CierreCaja_reabiertoPorId_fkey`
  FOREIGN KEY (`reabiertoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `CierreCaja_reabiertoPorId_idx` ON `CierreCaja`(`reabiertoPorId`);
