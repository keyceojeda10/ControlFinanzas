-- Agrega 'pendiente' al enum EstadoSuscripcion para representar suscripciones
-- recurrentes creadas en MercadoPago que aun no han sido autorizadas por el pagador.
ALTER TABLE `Suscripcion`
  MODIFY COLUMN `estado` ENUM('activa', 'vencida', 'cancelada', 'pendiente') NOT NULL DEFAULT 'activa';
