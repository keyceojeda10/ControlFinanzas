-- Añade permiso para que el cobrador vea el saldo en caja actual (mismo que el owner)
ALTER TABLE `User` ADD COLUMN `puedeVerSaldoCaja` BOOLEAN NOT NULL DEFAULT false;
