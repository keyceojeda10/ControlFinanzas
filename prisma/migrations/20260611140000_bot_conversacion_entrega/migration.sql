-- Tracking de entregabilidad de mensajes salientes del bot de WhatsApp.
ALTER TABLE `BotConversacion`
  ADD COLUMN `wamid` VARCHAR(191) NULL,
  ADD COLUMN `estadoEntrega` VARCHAR(191) NULL,
  ADD COLUMN `estadoEntregaEn` DATETIME(3) NULL,
  ADD COLUMN `errorEntrega` TEXT NULL;

CREATE UNIQUE INDEX `BotConversacion_wamid_key` ON `BotConversacion`(`wamid`);
