-- DropForeignKey
ALTER TABLE `GrupoCobro` DROP FOREIGN KEY `GrupoCobro_rutaId_fkey`;

-- DropIndex
DROP INDEX `GrupoCobro_rutaId_idx` ON `GrupoCobro`;

-- AlterTable: remove rutaId from GrupoCobro
ALTER TABLE `GrupoCobro` DROP COLUMN `rutaId`;
