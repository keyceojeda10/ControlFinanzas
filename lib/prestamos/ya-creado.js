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
 *
 * ⚠ SALVO EL CLIENTE DE UNA SOLA FILA (final review, 23 nov 2026). La cédula
 * `SIN-C_…` (`marcadorDeFila`) sale de la solicitud y de la fila: ese cliente es
 * de esa fila y de nadie más, así que un préstamo vivo con la misma huella es el
 * que la fila ya creó, haya pasado el tiempo que haya pasado. Con la ventana, el
 * reintento que llegaba a los 20 minutos creaba el segundo.
 */
import { huellaPrestamo } from '@/lib/carga-masiva'
import { PREFIJO_FILA } from '@/lib/carga-asesor/al-lote'

export const VENTANA_REINTENTO_MS = 15 * 60 * 1000

/**
 * El préstamo ya creado con esa huella, o null.
 * `fechaInicio` es la fecha como la guarda la ruta (`new Date('AAAA-MM-DDT05:00:00.000Z')`).
 * `cedula` es la del cliente: con `SIN-C_` no hay ventana (ver arriba).
 */
export async function prestamoYaCreado(db, { organizationId, clienteId, montoPrestado, fechaInicio, frecuencia, cedula }, ahora = Date.now()) {
  if (!(fechaInicio instanceof Date) || Number.isNaN(fechaInicio.getTime())) return null
  const huella = huellaPrestamo({ montoPrestado, fechaInicio, frecuencia })
  const deUnaFila = typeof cedula === 'string' && cedula.startsWith(PREFIJO_FILA)
  const recientes = await db.prestamo.findMany({
    where: {
      organizationId, clienteId,
      estado: { not: 'cancelado' },
      ...(!deUnaFila && { createdAt: { gte: new Date(ahora - VENTANA_REINTENTO_MS) } }),
    },
    orderBy: { createdAt: 'asc' },
  })
  return recientes.find((p) => huellaPrestamo(p) === huella) ?? null
}
