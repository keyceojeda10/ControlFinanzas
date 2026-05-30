-- Nombre del producto para prestamos de mercancia (gorra, reloj, etc.).
-- Columna no-destructiva y opcional (NULL). Los prestamos de dinero la dejan
-- en NULL; solo las mercancias la usan para dar referencia de que se entrego.
ALTER TABLE `Prestamo`
  ADD COLUMN `nombreProducto` VARCHAR(191) NULL;
