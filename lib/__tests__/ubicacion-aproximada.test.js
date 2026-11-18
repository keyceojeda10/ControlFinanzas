import { describe, it, expect } from 'vitest'
import { conUbicacionAproximada } from '@/lib/rutas/ubicacion-aproximada'

// El mapa grande de la ruta (18 nov 2026): el cliente sin ubicación guardada se
// pinta donde se le cobró la última vez con GPS. Solo se enseña: no se guarda.

function prismaDe(pagos) {
  return {
    pago: {
      groupBy: async ({ where }) => {
        const ids = where.prestamoId.in
        const por = new Map()
        for (const p of pagos) {
          if (!ids.includes(p.prestamoId) || p.latitud == null) continue
          const previo = por.get(p.prestamoId)
          if (!previo || p.fechaPago > previo) por.set(p.prestamoId, p.fechaPago)
        }
        return [...por].map(([prestamoId, f]) => ({ prestamoId, _max: { fechaPago: f } }))
      },
      findMany: async ({ where }) => pagos.filter((p) => where.OR.some((o) => o.prestamoId === p.prestamoId && +o.fechaPago === +p.fechaPago)),
    },
  }
}

const crudos = [
  { id: 'a', prestamos: [{ id: 'pa1' }, { id: 'pa2' }] },
  { id: 'b', prestamos: [{ id: 'pb1' }] },
  { id: 'c', prestamos: [{ id: 'pc1' }] },
]

describe('la ubicación aproximada del cliente', () => {
  it('usa el cobro con GPS más reciente de todos sus préstamos', async () => {
    const prisma = prismaDe([
      { prestamoId: 'pa1', latitud: 1, longitud: 1, fechaPago: new Date('2026-11-01') },
      { prestamoId: 'pa2', latitud: 2, longitud: 2, fechaPago: new Date('2026-11-10') },
      { prestamoId: 'pa1', latitud: 3, longitud: 3, fechaPago: new Date('2026-11-05') },
    ])
    const [a] = await conUbicacionAproximada(prisma, [{ id: 'a', latitud: null, longitud: null }], crudos, 'org')
    expect(a.ubicacionAproximada).toMatchObject({ latitud: 2, longitud: 2 })
  })

  it('no toca al que ya tiene ubicación guardada', async () => {
    const prisma = prismaDe([{ prestamoId: 'pb1', latitud: 9, longitud: 9, fechaPago: new Date('2026-11-10') }])
    const [b] = await conUbicacionAproximada(prisma, [{ id: 'b', latitud: 4, longitud: 5 }], crudos, 'org')
    expect(b.ubicacionAproximada).toBeUndefined()
    expect(b).toMatchObject({ latitud: 4, longitud: 5 })
  })

  it('sin cobros con GPS, el cliente queda como estaba', async () => {
    const [c] = await conUbicacionAproximada(prismaDe([]), [{ id: 'c', latitud: null, longitud: null }], crudos, 'org')
    expect(c.ubicacionAproximada).toBeUndefined()
  })

  it('si la consulta falla, la ruta sale igual', async () => {
    const roto = { pago: { groupBy: async () => { throw new Error('sin base') }, findMany: async () => [] } }
    const lista = [{ id: 'a', latitud: null, longitud: null }]
    expect(await conUbicacionAproximada(roto, lista, crudos, 'org')).toEqual(lista)
  })
})
