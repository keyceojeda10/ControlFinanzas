-- Agregar country y timezone a Organization
-- country: ISO 3166-1 alpha-2 en minusculas (default 'co' = Colombia)
-- timezone: solo se usa cuando el pais tiene multiples zonas (USA, Mexico). NULL = inferir del pais.
ALTER TABLE `Organization` ADD COLUMN `country` VARCHAR(2) NOT NULL DEFAULT 'co';
ALTER TABLE `Organization` ADD COLUMN `timezone` VARCHAR(50) NULL;
