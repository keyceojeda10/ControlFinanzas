// lib/__tests__/quitar-renovacion.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Si el cobrador se equivoca renovando una cartulina que no es, uno le pueda
//  quitar el préstamo pero el saldo viejo siga quedando, porque es un saldo que
//  todavía toca cobrarlo.» — el dueño de PRESTA MIL, 14 ago 2026.
//
// Medido contra producción ese día: 26 renovaciones borradas ($21.435.900 de
// saldo evaporado) + 14 canceladas ($1.619.000), en 10 negocios distintos.
//
// Lo que estas pruebas cuidan son las tres formas de volver a romperlo:
//
//   1. Que renovar vuelva a pisar `totalAPagar` sin guardar el número. Es la
//      causa: sin el previo, el saldo viejo no se puede devolver NUNCA, y
//      ninguna prueba de borrado lo notaría porque el borrado sí "funciona".
//   2. Que se arregle borrar y se deje cancelar (o al revés). Ya pasó con el
//      comprobante: mismo fallo reportado dos días seguidos por arreglar una
//      sola vía.
//   3. Que el reverso de capital vuelva a devolver `montoPrestado` entero. En
//      una renovación solo salió la diferencia; devolver el monto mete en la
//      caja plata que nunca salió de ella.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { revivirPrestamoRenovado, efectivoQueSalio, mensajeBorrarPrestamo } from '@/lib/dinero/revertir-renovacion'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// Un Prisma de mentira: registra lo que se le pide y devuelve lo que le pongas.
function txFalso({ viejo = null, movimiento = null } = {}) {
  const escrituras = []
  return {
    escrituras,
    prestamo: {
      findFirst: async () => viejo,
      update: async (args) => { escrituras.push(args); return args },
    },
    movimientoCapital: { findFirst: async () => movimiento },
  }
}

describe('el saldo viejo vuelve al quitar la renovación', () => {
  const nuevo = { id: 'nuevo1', renovadoDeId: 'viejo1', organizationId: 'org1' }

  it('devuelve el total anterior y lo deja activo', async () => {
    const tx = txFalso({
      viejo: { id: 'viejo1', estado: 'completado', totalAPagar: 30000, totalAPagarPrevio: 80000 },
    })
    const r = await revivirPrestamoRenovado(tx, nuevo)

    expect(r).toEqual({ id: 'viejo1', totalAPagar: 80000, devuelto: 50000 })
    expect(tx.escrituras[0].data).toEqual({
      totalAPagar: 80000,
      estado: 'activo',
      totalAPagarPrevio: null,
    })
  })

  it('los $50.000 del ejemplo del dueño, al peso', async () => {
    /* «Un cliente que tiene un saldo de 50 mil y va y lo renueva.» Debía 80.000,
       había pagado 30.000: le quedaban 50.000 que es lo que tiene que reaparecer. */
    const tx = txFalso({
      viejo: { id: 'viejo1', estado: 'completado', totalAPagar: 30000, totalAPagarPrevio: 80000 },
    })
    const { devuelto } = await revivirPrestamoRenovado(tx, nuevo)
    expect(devuelto).toBe(50000)
  })

  it('borra el previo, para que renovar dos veces no lo duplique', async () => {
    const tx = txFalso({
      viejo: { id: 'viejo1', estado: 'completado', totalAPagar: 30000, totalAPagarPrevio: 80000 },
    })
    await revivirPrestamoRenovado(tx, nuevo)
    expect(tx.escrituras[0].data.totalAPagarPrevio).toBeNull()
  })

  it('un préstamo normal no toca nada', async () => {
    const tx = txFalso()
    expect(await revivirPrestamoRenovado(tx, { id: 'x', organizationId: 'org1' })).toBeNull()
    expect(tx.escrituras).toHaveLength(0)
  })

  it('⚠ sin total previo NO revive: sería inventarle una deuda', async () => {
    /* Dos casos caen aquí y en los dos tocar el estado sería peor:
       las renovaciones anteriores a este arreglo (el número ya se perdió) y las
       hechas sobre una cartulina que ya estaba en cero. */
    const tx = txFalso({
      viejo: { id: 'viejo1', estado: 'completado', totalAPagar: 30000, totalAPagarPrevio: null },
    })
    expect(await revivirPrestamoRenovado(tx, nuevo)).toBeNull()
    expect(tx.escrituras).toHaveLength(0)
  })

  it('si el préstamo anterior ya no existe, no revienta', async () => {
    const tx = txFalso({ viejo: null })
    expect(await revivirPrestamoRenovado(tx, nuevo)).toBeNull()
  })
})

describe('⚠ el reverso devuelve lo que SALIÓ, no el monto del préstamo', () => {
  it('en una renovación, solo la diferencia entregada', async () => {
    /* Renovar $50.000 de saldo en un préstamo de $200.000: salieron $150.000.
       Devolver 200.000 metía $50.000 en la caja que nunca salieron de ella. */
    const tx = txFalso({ movimiento: { monto: 150000 } })
    expect(await efectivoQueSalio(tx, { id: 'n', organizationId: 'o', montoPrestado: 200000 })).toBe(150000)
  })

  it('en un préstamo normal coincide con el monto', async () => {
    const tx = txFalso({ movimiento: { monto: 200000 } })
    expect(await efectivoQueSalio(tx, { id: 'n', organizationId: 'o', montoPrestado: 200000 })).toBe(200000)
  })

  it('sin movimiento (préstamos viejos) se cae al monto, como antes', async () => {
    const tx = txFalso({ movimiento: null })
    expect(await efectivoQueSalio(tx, { id: 'n', organizationId: 'o', montoPrestado: 200000 })).toBe(200000)
  })
})

describe('⚠ renovar guarda el número antes de pisarlo', () => {
  const src = leer('app/api/prestamos/[id]/renovar/route.js')

  it('escribe totalAPagarPrevio en el mismo update que pisa totalAPagar', () => {
    const bloque = src.match(/totalAPagarPrevio[\s\S]{0,200}?\}/)?.[0] ?? ''
    expect(bloque, 'ya no se guarda el total anterior').toBeTruthy()
    expect(bloque).toMatch(/totalAPagarPrevio:\s*original\.totalAPagar/)
    expect(bloque).toMatch(/totalAPagar:\s*Math\.round\(totalPagadoViejo\)/)
  })

  it('la columna existe en el esquema', () => {
    expect(leer('prisma/schema.prisma')).toMatch(/totalAPagarPrevio\s+Float\?/)
  })
})

describe('⚠ las DOS vías de quitar el préstamo, no una', () => {
  const src = leer('app/api/prestamos/[id]/route.js')

  it('eliminar revive el anterior', () => {
    const del = src.slice(src.indexOf('export async function DELETE'))
    expect(del).toMatch(/revivirPrestamoRenovado\(tx, p\)/)
  })

  it('cancelar también', () => {
    // Anclado en el código, no en un comentario: `leer` los quita.
    const cancelar = src.slice(src.indexOf('export async function PATCH'), src.indexOf('export async function DELETE'))
    expect(cancelar).toMatch(/revivirPrestamoRenovado\(tx, p\)/)
  })

  it('y ninguna de las dos devuelve montoPrestado a ciegas', () => {
    const del = src.slice(src.indexOf('export async function DELETE'))
    expect(del).toMatch(/efectivoQueSalio\(tx, p\)/)
    expect(del, 'volvió a reversar el monto entero').not.toMatch(/monto:\s*p\.montoPrestado,\s*\n\s*direccion:\s*'ingreso'/)
  })
})

describe('se avisa ANTES de borrar, no después', () => {
  const viejo = { id: 'v', totalAPagar: 30000, totalAPagarPrevio: 80000 }
  const renovacion = { id: 'n', renovadoDeId: 'v' }

  it('dice cuánto saldo vuelve', () => {
    const m = mensajeBorrarPrestamo([viejo, renovacion], 'n')
    expect(m).toMatch(/vuelve el préstamo anterior/)
    expect(m).toMatch(/50\.000/)
  })

  it('un préstamo normal conserva el aviso de siempre', () => {
    const m = mensajeBorrarPrestamo([{ id: 'x' }], 'x')
    expect(m).toBe('¿Eliminar este préstamo y todos sus pagos? Esta acción no se puede deshacer.')
  })

  it('⚠ en las renovaciones viejas avisa que el saldo NO volverá', () => {
    /* Los 40 casos ya rotos y cualquiera renovado antes de este arreglo. Prometer
       que vuelve sería mentir; callarlo es lo que causó el reporte. */
    const m = mensajeBorrarPrestamo([{ id: 'v', totalAPagar: 0, totalAPagarPrevio: null }, renovacion], 'n')
    expect(m).toMatch(/no volverá solo/)
  })
})
