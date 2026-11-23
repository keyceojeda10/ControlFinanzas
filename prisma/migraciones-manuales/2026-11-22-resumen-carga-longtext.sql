-- SolicitudCarga.resumen de TEXT (64 KB) a LONGTEXT (22 nov 2026).
-- Plan «La carga de cartera la revisa y la carga el dueño»: `resumen.creadas`
-- guarda una entrada (~90 bytes) por cada fila que el dueño ya creó, y hay
-- negocios con más de 1.400 clientes. Con TEXT la base truncaba en silencio y se
-- perdía lo creado (las filas volverían a salir como pendientes y se cargarían
-- dos veces).
--
-- Generado con (schema contra el schema anterior, sin tocar ninguna base):
--   npx prisma migrate diff --from-schema <schema.prisma anterior> --to-schema prisma/schema.prisma --script
--
-- Ensanchar no pierde datos. Aplicar ANTES del código, y comprobar el resultado:
--   SHOW COLUMNS FROM `SolicitudCarga` LIKE 'resumen';   -- Type = longtext

ALTER TABLE `SolicitudCarga` MODIFY `resumen` LONGTEXT NULL;
