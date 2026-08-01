-- «Cómo prestas por defecto» — Configuración.
--
-- Generado con:
--   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
--
-- Se guarda el SQL en vez de aplicarlo a mano PORQUE ESTE PROYECTO YA SE QUEMÓ
-- ASÍ: al añadir una columna por SQL sin actualizar schema.prisma, el cliente de
-- Prisma queda desincronizado y revienta con «Unknown argument» EN RUNTIME —no
-- en el build—, y esa vez tumbó la creación de préstamos. Aquí el SQL sale del
-- propio schema, así que no pueden divergir.
--
-- Los tres van NULL, sin default: null significa «este negocio no ha dicho cómo
-- presta». Un default en la columna haría que las 337 organizaciones que ya
-- existen parecieran haber elegido «diario al 20%» cuando ninguna lo hizo.

ALTER TABLE `organization` ADD COLUMN `frecuenciaDefault` VARCHAR(191) NULL,
    ADD COLUMN `modoInteresDefault` VARCHAR(191) NULL,
    ADD COLUMN `tasaDefault` DOUBLE NULL;
