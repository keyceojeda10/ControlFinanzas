-- AlterTable: User - add puedeDesembolsarLinea
ALTER TABLE `User` ADD COLUMN `puedeDesembolsarLinea` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: LineaCredito
CREATE TABLE `LineaCredito` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `cupoMaximo` DOUBLE NOT NULL,
    `tasaInteres` DOUBLE NOT NULL,
    `modoInteres` VARCHAR(191) NOT NULL DEFAULT 'fijo_mensual',
    `diaCorte` INTEGER NOT NULL DEFAULT 30,
    `pagoMinimoPct` DOUBLE NOT NULL DEFAULT 0,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'activa',
    `creadoPorId` VARCHAR(191) NULL,
    `notas` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LineaCredito_organizationId_idx`(`organizationId`),
    INDEX `LineaCredito_clienteId_idx`(`clienteId`),
    INDEX `LineaCredito_organizationId_estado_idx`(`organizationId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: DesembolsoLinea
CREATE TABLE `DesembolsoLinea` (
    `id` VARCHAR(191) NOT NULL,
    `lineaCreditoId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `monto` DOUBLE NOT NULL,
    `nota` VARCHAR(191) NULL,
    `registradoPorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DesembolsoLinea_lineaCreditoId_idx`(`lineaCreditoId`),
    INDEX `DesembolsoLinea_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: PagoLinea
CREATE TABLE `PagoLinea` (
    `id` VARCHAR(191) NOT NULL,
    `lineaCreditoId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `corteLineaId` VARCHAR(191) NULL,
    `montoTotal` DOUBLE NOT NULL,
    `montoAInteres` DOUBLE NOT NULL,
    `montoACapital` DOUBLE NOT NULL,
    `metodoPago` VARCHAR(191) NULL,
    `cobradorId` VARCHAR(191) NULL,
    `latitud` DOUBLE NULL,
    `longitud` DOUBLE NULL,
    `nota` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PagoLinea_lineaCreditoId_idx`(`lineaCreditoId`),
    INDEX `PagoLinea_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: CorteLinea
CREATE TABLE `CorteLinea` (
    `id` VARCHAR(191) NOT NULL,
    `lineaCreditoId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `periodo` VARCHAR(191) NOT NULL,
    `fechaCorte` DATETIME(3) NOT NULL,
    `saldoAnterior` DOUBLE NOT NULL,
    `totalDesembolsos` DOUBLE NOT NULL,
    `interesesGenerados` DOUBLE NOT NULL,
    `totalCargos` DOUBLE NOT NULL,
    `totalPagado` DOUBLE NOT NULL,
    `saldoNuevo` DOUBLE NOT NULL,
    `pagoMinimo` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CorteLinea_lineaCreditoId_periodo_key`(`lineaCreditoId`, `periodo`),
    INDEX `CorteLinea_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LineaCredito` ADD CONSTRAINT `LineaCredito_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LineaCredito` ADD CONSTRAINT `LineaCredito_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DesembolsoLinea` ADD CONSTRAINT `DesembolsoLinea_lineaCreditoId_fkey` FOREIGN KEY (`lineaCreditoId`) REFERENCES `LineaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DesembolsoLinea` ADD CONSTRAINT `DesembolsoLinea_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PagoLinea` ADD CONSTRAINT `PagoLinea_lineaCreditoId_fkey` FOREIGN KEY (`lineaCreditoId`) REFERENCES `LineaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PagoLinea` ADD CONSTRAINT `PagoLinea_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PagoLinea` ADD CONSTRAINT `PagoLinea_corteLineaId_fkey` FOREIGN KEY (`corteLineaId`) REFERENCES `CorteLinea`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CorteLinea` ADD CONSTRAINT `CorteLinea_lineaCreditoId_fkey` FOREIGN KEY (`lineaCreditoId`) REFERENCES `LineaCredito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CorteLinea` ADD CONSTRAINT `CorteLinea_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
