import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { prestamoYaCreado, VENTANA_REINTENTO_MS } from '@/lib/prestamos/ya-creado'

// Final review de «La carga de cartera la revisa y la carga el dueño» (23 nov
// 2026), I4. El cliente con cédula `SIN-C_<solicitud>_<fila>` es de UNA sola
// fila de la carga del dueño: cualquier préstamo vivo con la misma huella es el
// que esa fila ya creó, aunque haya pasado más de 15 minutos (el reintento del
// piloto llegó tarde y se creaba otra vez). Los demás clientes siguen con la
// ventana corta: prestarle lo mismo días después es legítimo.

const AHORA = Date.parse('2026-11-23T15:00:00.000Z')
const fecha = new Date('2026-11-23T05:00:00.000Z')

/* Una base de mentira que aplica el `where` que de verdad manda la función. */
function base(prestamos) {
  return {
    prestamo: {
      findMany: async ({ where }) => prestamos.filter((p) => p.organizationId === where.organizationId
        && p.clienteId === where.clienteId
        && (where.estado?.not == null || p.estado !== where.estado.not)
        && (where.createdAt?.gte == null || p.createdAt >= where.createdAt.gte)),
    },
  }
}
const prestamo = (over = {}) => ({
  id: 'p1', organizationId: 'o1', clienteId: 'c1', estado: 'activo', montoPrestado: 500000, fechaInicio: fecha,
  frecuencia: 'diario', createdAt: new Date(AHORA - VENTANA_REINTENTO_MS - 5 * 60000), ...over,
})
const pedir = (over = {}) => ({ organizationId: 'o1', clienteId: 'c1', montoPrestado: 500000, fechaInicio: fecha, frecuencia: 'diario', ...over })

describe('prestamoYaCreado', () => {
  it('⚠ cliente SIN-C_: encuentra el préstamo con la misma huella aunque pasara la ventana', async () => {
    const r = await prestamoYaCreado(base([prestamo()]), pedir({ cedula: 'SIN-C_s1_1-0' }), AHORA)
    expect(r?.id).toBe('p1')
  })

  it('cliente SIN-C_: un cancelado no cuenta', async () => {
    const r = await prestamoYaCreado(base([prestamo({ estado: 'cancelado' })]), pedir({ cedula: 'SIN-C_s1_1-0' }), AHORA)
    expect(r).toBeNull()
  })

  it('cliente SIN-C_: otra huella (otro monto) no es el mismo préstamo', async () => {
    const r = await prestamoYaCreado(base([prestamo({ montoPrestado: 400000 })]), pedir({ cedula: 'SIN-C_s1_1-0' }), AHORA)
    expect(r).toBeNull()
  })

  it('cliente con cédula real: pasada la ventana NO es el reintento (se crea otro)', async () => {
    const r = await prestamoYaCreado(base([prestamo()]), pedir({ cedula: '1032456789' }), AHORA)
    expect(r).toBeNull()
  })

  it('el `SIN-<NOMBRE>` de la carga masiva tampoco se salta la ventana', async () => {
    const r = await prestamoYaCreado(base([prestamo()]), pedir({ cedula: 'SIN-CARLOS-PEREZ' }), AHORA)
    expect(r).toBeNull()
  })

  it('cliente con cédula real: dentro de la ventana sí lo reconoce', async () => {
    const r = await prestamoYaCreado(base([prestamo({ createdAt: new Date(AHORA - 60000) })]), pedir({ cedula: '1032456789' }), AHORA)
    expect(r?.id).toBe('p1')
  })

  it('solo mira los préstamos de ESE negocio', async () => {
    const r = await prestamoYaCreado(base([prestamo({ organizationId: 'o2' })]), pedir({ cedula: 'SIN-C_s1_1-0' }), AHORA)
    expect(r).toBeNull()
  })

  it('la ruta le pasa la cédula del cliente', () => {
    const src = readFileSync('app/api/prestamos/route.js', 'utf8')
    const i = src.indexOf('await prestamoYaCreado(prisma, {')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, src.indexOf('})', i))).toMatch(/cedula: cliente\.cedula/)
  })
})
