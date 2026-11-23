/* ══ EL PRÉSTAMO QUE YA SE CREÓ EN EL INTENTO ANTERIOR ══════════════════════
 *
 * Piloto del 22 nov 2026 (task-8, check C). El navegador corta `POST
 * /api/prestamos` a los 8 s (`lib/fetch-timeout.js`) aunque el servidor siga y
 * lo cree: la pantalla dice «no se pudo» y, al tocar «Crear» otra vez, el mismo
 * préstamo se creaba dos veces, con dos desembolsos. Una deuda cobrada doble.
 *
 * Solo lo pide quien sabe que está reintentando lo mismo: la carga que revisa
 * el dueño (`LoteFotos` en modo solicitud) manda `idempotente: true`. Sin esa
 * marca la ruta no cambia: prestarle dos veces lo mismo al mismo cliente el
 * mismo día es legítimo en el formulario de siempre.
 *
 * El mismo préstamo = mismo cliente del mismo negocio y misma huella
 * (`huellaPrestamo`: monto, fecha de inicio AAAA-MM-DD y frecuencia), creado
 * hace menos de 15 minutos y no cancelado. La ventana es corta a propósito:
 * es la de un reintento, no la de un préstamo nuevo días después.
 */
import { huellaPrestamo } from '@/lib/carga-masiva'

export const VENTANA_REINTENTO_MS = 15 * 60 * 1000

/**
 * El préstamo ya creado con esa huella, o null.
 * `fechaInicio` es la fecha como la guarda la ruta (`new Date('AAAA-MM-DDT05:00:00.000Z')`).
 */
export async function prestamoYaCreado(db, { organizationId, clienteId, montoPrestado, fechaInicio, frecuencia }, ahora = Date.now()) {
  if (!(fechaInicio instanceof Date) || Number.isNaN(fechaInicio.getTime())) return null
  const huella = huellaPrestamo({ montoPrestado, fechaInicio, frecuencia })
  const recientes = await db.prestamo.findMany({
    where: {
      organizationId, clienteId,
      estado: { not: 'cancelado' },
      createdAt: { gte: new Date(ahora - VENTANA_REINTENTO_MS) },
    },
    orderBy: { createdAt: 'asc' },
  })
  return recientes.find((p) => huellaPrestamo(p) === huella) ?? null
}
