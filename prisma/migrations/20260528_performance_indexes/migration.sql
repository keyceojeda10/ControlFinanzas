-- Indices compuestos adicionales para mejorar listados y consultas frecuentes.
-- Cero riesgo: solo aceleran lecturas, no afectan integridad de datos.

-- Caja diaria: pagos del cobrador en una fecha (filtro mas comun en /api/caja).
CREATE INDEX `Pago_organizationId_cobradorId_fechaPago_idx`
  ON `Pago`(`organizationId`, `cobradorId`, `fechaPago`);

-- Listado de clientes por ruta y estado (cobrador filtra por sus rutas).
CREATE INDEX `Cliente_organizationId_rutaId_estado_idx`
  ON `Cliente`(`organizationId`, `rutaId`, `estado`);

-- Cobradores activos por organizacion (usado en listados de cobradores y rutas).
CREATE INDEX `User_organizationId_rol_activo_idx`
  ON `User`(`organizationId`, `rol`, `activo`);
