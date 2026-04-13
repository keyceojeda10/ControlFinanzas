-- CreateTable
CREATE TABLE `GrupoCobro` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `rutaId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GrupoCobro_rutaId_idx`(`rutaId`),
    INDEX `GrupoCobro_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: add grupoCobroId to Cliente
ALTER TABLE `Cliente` ADD COLUMN `grupoCobroId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Cliente_grupoCobroId_idx` ON `Cliente`(`grupoCobroId`);

-- AddForeignKey
ALTER TABLE `GrupoCobro` ADD CONSTRAINT `GrupoCobro_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GrupoCobro` ADD CONSTRAINT `GrupoCobro_rutaId_fkey` FOREIGN KEY (`rutaId`) REFERENCES `Ruta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Cliente` ADD CONSTRAINT `Cliente_grupoCobroId_fkey` FOREIGN KEY (`grupoCobroId`) REFERENCES `GrupoCobro`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
