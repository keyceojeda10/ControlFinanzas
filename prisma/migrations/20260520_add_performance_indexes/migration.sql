-- Indices de rendimiento: aceleran los filtros mas frecuentes de la app
-- (dashboard, listados de clientes/prestamos/rutas). Solo agregan indices,
-- no modifican datos ni columnas — operacion segura.

-- Cliente: filtrado por ruta y por organizacion+estado
CREATE INDEX `Cliente_rutaId_idx` ON `Cliente`(`rutaId`);
CREATE INDEX `Cliente_organizationId_estado_idx` ON `Cliente`(`organizationId`, `estado`);

-- Prestamo: filtrado por estado, organizacion+estado y rango de fechas
CREATE INDEX `Prestamo_estado_idx` ON `Prestamo`(`estado`);
CREATE INDEX `Prestamo_organizationId_estado_idx` ON `Prestamo`(`organizationId`, `estado`);
CREATE INDEX `Prestamo_createdAt_idx` ON `Prestamo`(`createdAt`);

-- Pago: filtrado por rango de fechas (dashboard) y por prestamo+fecha
CREATE INDEX `Pago_organizationId_fechaPago_idx` ON `Pago`(`organizationId`, `fechaPago`);
CREATE INDEX `Pago_prestamoId_fechaPago_idx` ON `Pago`(`prestamoId`, `fechaPago`);

-- Ruta: busqueda por cobrador y por organizacion+activo
CREATE INDEX `Ruta_cobradorId_idx` ON `Ruta`(`cobradorId`);
CREATE INDEX `Ruta_organizationId_activo_idx` ON `Ruta`(`organizationId`, `activo`);
