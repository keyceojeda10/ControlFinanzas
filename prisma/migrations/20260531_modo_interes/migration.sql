-- Modo de interes por prestamo. Columna no-destructiva.
-- Default 'proporcional' para que TODOS los prestamos existentes queden
-- marcados como legacy (se calcularon con la formula vieja dias/30 y no se
-- deben recalcular). Los prestamos NUEVOS recibiran su modo explicito desde
-- el wizard (fijo por defecto en el schema).
ALTER TABLE `Prestamo`
  ADD COLUMN `modoInteres` VARCHAR(191) NOT NULL DEFAULT 'proporcional';
