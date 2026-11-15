-- La nota del crédito (15 nov 2026). Soporte de un cliente: «una nota que
-- coloque uno ahí cuando se hace el crédito … y cuando le va a cobrar ahí
-- aparece la nota».
--
-- Generado con:
--   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
--
-- NULL y sin default: null es «no se escribió nada».

ALTER TABLE `Prestamo` ADD COLUMN `nota` TEXT NULL;
