// lib/__tests__/unir-rutas.test.js
//
// Unir una ruta con otra (PRESTA MIL, 2 oct 2026: «unir la lista 9 con la 10»).
// Se ejecuta lib/rutas/fusionar.js de verdad, con lib/capital.js de verdad,
// contra una base en memoria. Lo que importa es lo que queda:
//   · los clientes al final de la otra ruta, en su orden
//   · el capital de las dos sumado en una, y el del negocio igual
//   · ⚠ que `recalcularSaldosCapital` lo lea igual que se escribió
//   · que no toque el fajo de nadie

import { describe, it, expect, beforeEach } from 'vitest'
import { unirRutas, vistaUnion, avisoDiasSinCobro } from '@/lib/rutas/fusionar'
import { recalcularSaldosCapital } from '@/lib/capital'
import { afectaElFajo, afectaCaja } from '@/lib/dinero/conciliacion'

const ORG = 'org1'
let base

function crearBase() {
  const t = { capital: [], movimientos: [], rutas: [], clientes: [], prestamos: [], visitas: [], users: [], pagosHoy: [], prestamosHoy: [], movsHoy: [], cierresHoy: [], reabiertos: [], org: { id: ORG, diasSinCobro: null, country: 'co', capitalEsEfectivo: false } }
  const cumple = (fila, where = {}) => Object.entries(where).every(([k, v]) => {
    if (k === 'cliente') return true
    if (v && typeof v === 'object' && 'notIn' in v) return !v.notIn.includes(fila[k])
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k])
    if (v === null) return fila[k] == null   // en la base, lo que no se puso es NULL
    return fila[k] === v
  })
  const elegir = (fila, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, fila[k]])) : { ...fila })
  let n = 0
  const id = () => `id${++n}`
  const db = {
    t,
    $queryRaw: async () => t.capital.map((c) => ({ id: c.id, saldo: c.saldo })),
    /* La única sentencia cruda que escribe: mover los clientes al final de la
       otra ruta, en el orden en que se veían (sin puesto primero, luego
       ordenRuta, luego nombre). El SQL de verdad se prueba en el espejo. */
    $executeRaw: async (_sql, organizationId, origenId, destinoId, inicio) => {
      const filas = t.clientes
        .filter((c) => c.organizationId === organizationId && c.rutaId === origenId)
        .sort((x, y) => ((x.ordenRuta != null) - (y.ordenRuta != null)) || ((x.ordenRuta ?? 0) - (y.ordenRuta ?? 0)) || String(x.nombre ?? '').localeCompare(String(y.nombre ?? '')))
      filas.forEach((c, i) => { c.rutaId = destinoId; c.ordenRuta = inicio + i })
      return filas.length
    },
    $transaction: async (fn) => fn(db),
    organization: { findUnique: async () => ({ ...t.org }) },
    capital: {
      findUnique: async ({ where }) => t.capital.find((c) => c.organizationId === where.organizationId) ?? null,
      create: async ({ data }) => { const c = { id: id(), ...data }; t.capital.push(c); return c },
      update: async ({ where, data }) => { const c = t.capital.find((x) => x.id === where.id); Object.assign(c, data); return c },
    },
    movimientoCapital: {
      create: async ({ data }) => { const m = { id: id(), createdAt: new Date(Date.now() + n), noMueveCapital: false, ...data }; t.movimientos.push(m); return m },
      findMany: async () => [...t.movimientos],
      count: async ({ where }) => t.movsHoy.filter((m) => m.rutaId === where.rutaId).length,
      update: async ({ where, data }) => Object.assign(t.movimientos.find((m) => m.id === where.id), data),
    },
    ruta: {
      findFirst: async ({ where, select }) => {
        const r = t.rutas.find((x) => cumple(x, where))
        if (!r) return null
        const u = t.users.find((x) => x.id === r.cobradorId)
        const fila = { ...r, cobrador: r.cobradorId ? { id: r.cobradorId, nombre: `cob ${r.cobradorId}`, activo: u?.activo !== false } : null }
        return elegir(fila, select)
      },
      findMany: async ({ where }) => t.rutas.filter((r) => cumple(r, where)),
      update: async ({ where, data }) => {
        const r = t.rutas.find((x) => x.id === where.id)
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in v) r[k] = (r[k] ?? 0) + v.increment
          else if (v && typeof v === 'object' && 'decrement' in v) r[k] = (r[k] ?? 0) - v.decrement
          else r[k] = v
        }
        return r
      },
    },
    cliente: {
      count: async ({ where }) => t.clientes.filter((c) => cumple(c, where)).length,
      aggregate: async ({ where }) => {
        const ordenes = t.clientes.filter((c) => cumple(c, where)).map((c) => c.ordenRuta).filter((o) => o != null)
        return { _max: { ordenRuta: ordenes.length ? Math.max(...ordenes) : null } }
      },
      findMany: async ({ where }) => t.clientes.filter((c) => cumple(c, where)).map((c) => ({ ...c })),
      update: async ({ where, data }) => Object.assign(t.clientes.find((c) => c.id === where.id), data),
      updateMany: async ({ where, data }) => {
        const filas = t.clientes.filter((c) => cumple(c, where))
        filas.forEach((c) => Object.assign(c, data))
        return { count: filas.length }
      },
    },
    prestamo: {
      count: async ({ where }) => (where.createdAt
        ? t.prestamosHoy.filter((p) => t.clientes.find((c) => c.id === p.clienteId)?.rutaId === where.cliente.rutaId).length
        : t.prestamos.filter((p) => p.estado === where.estado
          && t.clientes.find((c) => c.id === p.clienteId)?.rutaId === where.cliente.rutaId).length),
    },
    visitaReagendada: {
      updateMany: async ({ where, data }) => {
        const filas = t.visitas.filter((v) => cumple(v, where))
        filas.forEach((v) => Object.assign(v, data))
        return { count: filas.length }
      },
    },
    user: { findFirst: async ({ where }) => t.users.find((u) => cumple(u, where)) ?? null },
    /* Los cobros de HOY en clientes de una ruta, y los cierres de hoy. */
    pago: {
      aggregate: async ({ where }) => {
        const filas = t.pagosHoy.filter((p) => t.clientes.find((c) => c.id === p.clienteId)?.rutaId === where.prestamo.cliente.rutaId)
        return { _sum: { montoPagado: filas.reduce((a, p) => a + p.monto, 0) || null }, _count: filas.length }
      },
    },
    /* Un cierre reabierto no cuenta: la consulta pide `reabiertoEn: null`. */
    cierreCaja: {
      findFirst: async ({ where }) => (t.cierresHoy.includes(where.cobradorId)
        && !(where.reabiertoEn === null && t.reabiertos.includes(where.cobradorId)) ? { id: 'c' } : null),
    },
  }
  return db
}

beforeEach(() => {
  base = crearBase()
  const t = base.t
  t.capital.push({ id: 'cap', organizationId: ORG, saldo: 5_000_000 })
  t.rutas.push(
    { id: 'r9', organizationId: ORG, nombre: 'RUTA #9', activo: true, saldoCapital: 573000, capitalHabilitado: true, diasSinCobro: '[0]', cobradorId: 'camilo' },
    { id: 'r10', organizationId: ORG, nombre: 'RUTA #10', activo: true, saldoCapital: 279000, capitalHabilitado: true, diasSinCobro: null, cobradorId: 'carlos' },
  )
  t.users.push(
    { id: 'camilo', organizationId: ORG, rol: 'cobrador', activo: true, nombre: 'cob camilo' },
    { id: 'carlos', organizationId: ORG, rol: 'cobrador', activo: true, nombre: 'cob carlos' },
  )
  // RUTA #10: dos clientes en el puesto 0 y 1. RUTA #9: tres, con su orden.
  t.clientes.push(
    { id: 'b0', organizationId: ORG, rutaId: 'r10', ordenRuta: 0, estado: 'activo', createdAt: new Date(1) },
    { id: 'b1', organizationId: ORG, rutaId: 'r10', ordenRuta: 1, estado: 'activo', createdAt: new Date(2) },
    { id: 'a2', organizationId: ORG, rutaId: 'r9', ordenRuta: 2, estado: 'activo', createdAt: new Date(3) },
    { id: 'a0', organizationId: ORG, rutaId: 'r9', ordenRuta: 0, estado: 'activo', createdAt: new Date(4) },
    { id: 'a1', organizationId: ORG, rutaId: 'r9', ordenRuta: 1, estado: 'activo', createdAt: new Date(5) },
  )
  t.prestamos.push({ id: 'p1', clienteId: 'a0', estado: 'activo' }, { id: 'p2', clienteId: 'a1', estado: 'activo' })
  t.visitas.push(
    { id: 'v1', organizationId: ORG, rutaId: 'r9', estado: 'pendiente' },
    { id: 'v2', organizationId: ORG, rutaId: 'r9', estado: 'completada' },
  )
})

const unir = (extra = {}) => unirRutas(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r10', usuarioId: 'dueno', ...extra })
const ruta = (rid) => base.t.rutas.find((r) => r.id === rid)

describe('unir la RUTA #9 con la #10', () => {
  it('los clientes van al final de la #10, en el orden que traían', async () => {
    const r = await unir()
    expect(r.clientes).toBe(3)
    const enLa10 = base.t.clientes.filter((c) => c.rutaId === 'r10').sort((x, y) => x.ordenRuta - y.ordenRuta).map((c) => c.id)
    expect(enLa10).toEqual(['b0', 'b1', 'a0', 'a1', 'a2'])
  })

  it('el capital de la #9 pasa entero a la #10; el del negocio no cambia', async () => {
    await unir()
    expect(ruta('r10').saldoCapital).toBe(852000)
    expect(ruta('r9').saldoCapital).toBe(0)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
    const [sale, entra] = base.t.movimientos
    expect(sale).toMatchObject({ tipo: 'ajuste', monto: 573000, rutaId: 'r9', ajusteArranqueRuta: false })
    expect(entra).toMatchObject({ tipo: 'ajuste', monto: 573000, rutaId: 'r10', ajusteArranqueRuta: false })
    expect(sale.descripcion).toBe('Unión de rutas: pasa a RUTA #10')
    expect(entra.descripcion).toBe('Unión de rutas: llega de RUTA #9')
  })

  it('⚠ el recálculo del capital lee el traslado igual que se escribió', async () => {
    /* Con los saldos de cada ruta salidos de sus propios movimientos, para que
       el recálculo tenga de dónde reconstruirlos. */
    base.t.capital[0].saldo = 852000
    ruta('r9').saldoCapital = 0; ruta('r10').saldoCapital = 0
    const { registrarMovimientoCapital } = await import('@/lib/capital')
    await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'inyeccion', monto: 573000, rutaId: 'r9', descripcion: 'x' })
    await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'inyeccion', monto: 279000, rutaId: 'r10', descripcion: 'x' })
    base.t.capital[0].saldo = 852000 + 852000 - 852000
    await unir()
    const antes = { r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }
    await recalcularSaldosCapital(base, { organizationId: ORG })
    expect({ r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }).toEqual(antes)
    expect(antes.r10).toBe(852000)
  })

  it('⚠ no toca el fajo de ningún cobrador, pero sí la bolsa', async () => {
    await unir()
    for (const m of base.t.movimientos) {
      expect(afectaElFajo(m)).toBe(false)
      expect(afectaCaja(m)).toBe(true)
    }
  })

  it('capital negativo: también se traslada, al revés', async () => {
    ruta('r9').saldoCapital = -120000
    await unir()
    expect(ruta('r10').saldoCapital).toBe(279000 - 120000)
    expect(ruta('r9').saldoCapital).toBe(0)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
  })

  it('sin capital en la ruta, no se apunta nada', async () => {
    ruta('r9').saldoCapital = 0
    await unir()
    expect(base.t.movimientos).toHaveLength(0)
  })

  it('la #9 queda archivada y sin cobrador; las visitas pendientes pasan a la #10', async () => {
    await unir()
    expect(ruta('r9')).toMatchObject({ activo: false, cobradorId: null })
    expect(base.t.visitas.find((v) => v.id === 'v1').rutaId).toBe('r10')
    expect(base.t.visitas.find((v) => v.id === 'v2').rutaId).toBe('r9')
  })

  it('quién la cobra: el de la #10 si no se dice; el que se elija; o nadie', async () => {
    await unir()
    expect(ruta('r10').cobradorId).toBe('carlos')
  })

  it('…o Camilo, si el dueño lo elige', async () => {
    await unir({ cobradorId: 'camilo' })
    expect(ruta('r10').cobradorId).toBe('camilo')
  })

  it('…o nadie', async () => {
    await unir({ cobradorId: null })
    expect(ruta('r10').cobradorId).toBe(null)
  })

  it('un cobrador que no existe no pasa, y no se toca nada', async () => {
    const r = await unir({ cobradorId: 'fantasma' })
    expect(r.status).toBe(400)
    expect(ruta('r9').activo).toBe(true)
    expect(base.t.clientes.filter((c) => c.rutaId === 'r9')).toHaveLength(3)
  })

  it('no se une una ruta consigo misma, ni con una archivada', async () => {
    expect((await unirRutas(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r9' })).status).toBe(400)
    ruta('r10').activo = false
    expect((await unir()).status).toBe(409)
  })

  it('una ruta de otro negocio no se encuentra', async () => {
    ruta('r10').organizationId = 'otro'
    expect((await unir()).status).toBe(404)
  })
})

describe('⚠ cobros de hoy en la ruta que se une', () => {
  it('sin cobros hoy, se une sin esperar a nadie', async () => {
    expect((await unir()).error).toBeUndefined()
  })

  it('con cobros hoy y las cajas abiertas, NO se une y dice quién tiene que cerrar', async () => {
    base.t.pagosHoy.push({ clienteId: 'a0', monto: 50000 }, { clienteId: 'a1', monto: 30000 })
    const r = await unir()
    expect(r.status).toBe(409)
    expect(r.error).toBe('Hoy ya se cobraron $80.000 en RUTA #9. Para que no salga en dos cajas, cierren la caja de hoy cob camilo y cob carlos antes de unir.')
    expect(ruta('r9').activo).toBe(true)
    expect(base.t.clientes.filter((c) => c.rutaId === 'r9')).toHaveLength(3)
  })

  it('con solo uno cerrado, pide el que falta', async () => {
    base.t.pagosHoy.push({ clienteId: 'a0', monto: 50000 })
    base.t.cierresHoy.push('camilo')
    const r = await unir()
    expect(r.error).toMatch(/cierre la caja de hoy cob carlos antes de unir/)
  })

  it('con los dos cerrados, se une', async () => {
    base.t.pagosHoy.push({ clienteId: 'a0', monto: 50000 })
    base.t.cierresHoy.push('camilo', 'carlos')
    expect((await unir()).error).toBeUndefined()
    expect(ruta('r9').activo).toBe(false)
  })

  it('los cobros de hoy de la OTRA ruta no bloquean', async () => {
    base.t.pagosHoy.push({ clienteId: 'b0', monto: 50000 })
    expect((await unir()).error).toBeUndefined()
  })

  it('⚠ un PRÉSTAMO de hoy también bloquea, aunque no haya cobros', async () => {
    base.t.prestamosHoy.push({ clienteId: 'a1' })
    const r = await unir()
    expect(r.status).toBe(409)
    expect(r.error).toMatch(/^Hoy ya hubo movimiento en RUTA #9/)
  })

  it('⚠ una inyección o retiro de hoy en la ruta también bloquea', async () => {
    base.t.movsHoy.push({ rutaId: 'r9' })
    expect((await unir()).status).toBe(409)
  })

  it('⚠ un cierre REABIERTO no cuenta como cerrado', async () => {
    base.t.pagosHoy.push({ clienteId: 'a0', monto: 50000 })
    base.t.cierresHoy.push('camilo', 'carlos')
    base.t.reabiertos.push('carlos')
    const r = await unir()
    expect(r.error).toMatch(/cierre la caja de hoy cob carlos/)
  })

  it('⚠ cambiarle el cobrador a la #10 con movimiento de hoy en ella: no', async () => {
    base.t.pagosHoy.push({ clienteId: 'b0', monto: 50000 })
    const r = await unir({ cobradorId: 'camilo' })
    expect(r.status).toBe(409)
    expect(r.error).toBe('Hoy ya hubo movimiento en RUTA #10: para cambiarle el cobrador, une mañana o deja a cob carlos.')
    expect(ruta('r10').cobradorId).toBe('carlos')
  })

  it('…pero dejando a Carlos, sí', async () => {
    base.t.pagosHoy.push({ clienteId: 'b0', monto: 50000 })
    expect((await unir({ cobradorId: 'carlos' })).error).toBeUndefined()
  })
})

describe('lo que la revisión del 2 oct encontró', () => {
  it('⚠ una ruta sin capital propio no le pasa su saldo a la otra', async () => {
    ruta('r9').capitalHabilitado = false
    ruta('r9').saldoCapital = -900000
    await unir()
    expect(base.t.movimientos).toHaveLength(0)
    expect(ruta('r10').saldoCapital).toBe(279000)
  })

  it('⚠ los clientes conservan sus días sin cobro (no cambia su mora hacia atrás)', async () => {
    base.t.clientes.find((c) => c.id === 'a2').diasSinCobro = '[6]'   // uno con días propios
    await unir()
    const dias = Object.fromEntries(base.t.clientes.filter((c) => c.id.startsWith('a')).map((c) => [c.id, c.diasSinCobro]))
    expect(dias).toEqual({ a0: '[0]', a1: '[0]', a2: '[6]' })
    // Los de la #10 no se tocan.
    expect(base.t.clientes.find((c) => c.id === 'b0').diasSinCobro).toBeUndefined()
  })

  it('con los mismos días en las dos, no se anota nada', async () => {
    ruta('r10').diasSinCobro = '[0]'
    await unir()
    expect(base.t.clientes.find((c) => c.id === 'a0').diasSinCobro).toBeUndefined()
  })

  it('la ruta archivada pierde el capital propio, para que Capital no la ofrezca', async () => {
    await unir()
    expect(ruta('r9').capitalHabilitado).toBe(false)
  })

  it('si se queda Camilo, los clientes nuevos para él son los que tenía la #10', async () => {
    const r = await unir({ cobradorId: 'camilo' })
    expect(r).toMatchObject({ clientes: 3, clientesNuevosParaElCobrador: 2, cobradorAnteriorDestino: 'carlos', cobradorOrigen: 'camilo' })
  })

  it('un cobrador desactivado no se ofrece como el que ya cobra', async () => {
    base.t.users.find((u) => u.id === 'carlos').activo = false
    const v = await vistaUnion(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r10' })
    expect(v.destino.cobrador).toBeNull()
  })
})

describe('lo que se enseña antes de confirmar', () => {
  it('clientes, préstamos activos y el capital de las dos', async () => {
    const v = await vistaUnion(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r10' })
    expect(v).toMatchObject({ clientes: 3, prestamos: 2, capitalDespues: 852000 })
    expect(v.origen).toMatchObject({ nombre: 'RUTA #9', capital: 573000 })
    expect(v.destino).toMatchObject({ nombre: 'RUTA #10', capital: 279000 })
  })

  it('⚠ avisa si los clientes cambian de días sin cobro', () => {
    const a = { nombre: 'RUTA #9', diasSinCobro: '[0]' }
    const b = { nombre: 'RUTA #10', diasSinCobro: null }
    expect(avisoDiasSinCobro(a, b, { diasSinCobro: null }))
      .toBe('En RUTA #9 no se cobra los domingos y en RUTA #10 se cobra todos los días. Sus clientes siguen como estaban: a cada uno se le deja anotado que no se cobra los domingos, así no cambian sus cuotas ni su atraso.')
    // Si el negocio ya no cobra domingos, la #10 tampoco: no hay nada que avisar.
    expect(avisoDiasSinCobro(a, b, { diasSinCobro: '[0]' })).toBeNull()
  })
})
