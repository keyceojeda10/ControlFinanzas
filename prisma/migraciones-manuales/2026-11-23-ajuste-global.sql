-- Tabla de interruptores globales del sistema (23 nov 2026).
-- Tarea 10 del plan «La carga de cartera la revisa y la carga el dueño»: el
-- «modo rápido» se enciende y se apaga para todos desde el panel del superadmin,
-- sin desplegar. Sin fila = encendido (decisión del dueño); '0' = apagado.
--
-- Generado con (schema contra el schema anterior, sin tocar ninguna base):
--   npx prisma migrate diff --from-schema <schema.prisma anterior> --to-schema prisma/schema.prisma --script
--
-- Tabla nueva: no toca datos. Aplicar ANTES del código y comprobar el resultado:
--   SHOW CREATE TABLE `AjusteGlobal`;   -- clave VARCHAR(64) PRIMARY KEY

CREATE TABLE `AjusteGlobal` (
    `clave` VARCHAR(64) NOT NULL,
    `valor` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `actualizadoPorId` VARCHAR(191) NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
