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
  const t = { cambios: [], capital: [], movimientos: [], rutas: [], clientes: [], prestamos: [], visitas: [], users: [], pagosHoy: [], prestamosHoy: [], movsHoy: [], cierresHoy: [], reabiertos: [], org: { id: ORG, diasSinCobro: null, country: 'co', capitalEsEfectivo: false } }
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
    $executeRaw: async (sql, ...valores) => {
      const orden = (x, y) => ((x.ordenRuta != null) - (y.ordenRuta != null)) || ((x.ordenRuta ?? 0) - (y.ordenRuta ?? 0)) || String(x.nombre ?? '').localeCompare(String(y.nombre ?? ''))
      /* «Arriba»: la ruta destino entera se corre detrás de los N que llegan,
         en el orden en que se ve. */
      if (!sql.join('?').includes('c.rutaId')) {
        const [organizationId, destinoId, n] = valores
        const filas = t.clientes.filter((c) => c.organizationId === organizationId && c.rutaId === destinoId).sort(orden)
        filas.forEach((c, i) => { c.ordenRuta = n + i })
        return filas.length
      }
      const [organizationId, origenId, destinoId, inicio] = valores
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
    cambioRuta: { createMany: async ({ data }) => { t.cambios.push(...data); return { count: data.length } } },
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
      /* «Lo cobrado» sin recargos ni descuentos, como la caja; contar, todos. */
      aggregate: async ({ where }) => {
        const filas = t.pagosHoy.filter((p) => t.clientes.find((c) => c.id === p.clienteId)?.rutaId === where.prestamo.cliente.rutaId
          && !(where.tipo?.notIn ?? []).includes(p.tipo))
        return { _sum: { montoPagado: filas.reduce((a, p) => a + p.monto, 0) || null } }
      },
      count: async ({ where }) => t.pagosHoy.filter((p) => t.clientes.find((c) => c.id === p.clienteId)?.rutaId === where.prestamo.cliente.rutaId).length,
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
  it('cada cliente que pasa queda anotado: de qué ruta venía (con su nombre) y a cuál llegó', async () => {
    /* «Saber que este cliente era de la ruta 10» (el dueño, 3 oct 2026). Se
       anota ANTES de moverlos, con el nombre copiado: la #9 queda archivada. */
    await unir()
    expect(base.t.cambios.map((c) => c.clienteId).sort()).toEqual(['a0', 'a1', 'a2'])
    expect(base.t.cambios.every((c) => c.deRutaId === 'r9' && c.deRutaNombre === 'RUTA #9'
      && c.aRutaId === 'r10' && c.motivo === 'union' && c.usuarioId === 'dueno' && c.organizationId === ORG)).toBe(true)
  })

  it('«arriba»: los que llegan van primero y la #10 entera se corre detrás, sin puesto incluidos', async () => {
    /* «Que le pueda elegir si quiere meter todos esos clientes nuevos arriba de
        la ruta o debajo» (PRESTA MIL, 3 oct 2026). Un cliente de la #10 SIN
        puesto sale el primero de su ruta: sumarles N a los que tienen puesto lo
        dejaba encima de los que llegan. */
    base.t.clientes.push({ id: 'bx', organizationId: ORG, rutaId: 'r10', ordenRuta: null, nombre: 'ZZ', estado: 'activo', createdAt: new Date(6) })
    const r = await unir({ posicion: 'inicio' })
    expect(r.clientes).toBe(3)
    const enLa10 = base.t.clientes.filter((c) => c.rutaId === 'r10').sort((x, y) => x.ordenRuta - y.ordenRuta).map((c) => c.id)
    expect(enLa10).toEqual(['a0', 'a1', 'a2', 'bx', 'b0', 'b1'])
    expect(new Set(base.t.clientes.filter((c) => c.rutaId === 'r10').map((c) => c.ordenRuta)).size).toBe(6)
  })

  it('una posición que no es «inicio» ni «final» no une nada', async () => {
    const r = await unir({ posicion: 'medio' })
    expect(r.status).toBe(400)
    expect(ruta('r9').activo).toBe(true)
  })

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

  describe('#39 · la #10 nunca tuvo capital propio', () => {
    /* Su `saldoCapital` era la cuenta de lo que movieron sus préstamos con la
       plata del negocio. Al activarle el capital con el de la #9, arranca en
       cero: queda SOLO lo que llega (decisión de Carlos, 18 oct 2026). */
    beforeEach(() => { ruta('r10').capitalHabilitado = false; ruta('r10').saldoCapital = -2_300_000 })

    it('queda con el capital de la #9 y nada más; el del negocio no cambia', async () => {
      await unir()
      expect(ruta('r10')).toMatchObject({ saldoCapital: 573000, capitalHabilitado: true })
      expect(base.t.capital[0].saldo).toBe(5_000_000)
      const [empieza, alNegocio] = base.t.movimientos
      expect(empieza).toMatchObject({ tipo: 'ajuste', monto: 2_300_000, rutaId: 'r10', referenciaTipo: 'ruta', ajusteArranqueRuta: false })
      expect(alNegocio).toMatchObject({ tipo: 'ajuste', monto: 2_300_000, rutaId: null, referenciaTipo: 'ruta', ajusteArranqueRuta: false })
      expect(empieza.descripcion).toBe('Unión de rutas: RUTA #10 empieza su capital propio')
      for (const m of base.t.movimientos) expect(afectaElFajo(m)).toBe(false)
    })

    it('con la cuenta en positivo, también arranca en cero', async () => {
      ruta('r10').saldoCapital = 400000
      await unir()
      expect(ruta('r10').saldoCapital).toBe(573000)
      expect(base.t.capital[0].saldo).toBe(5_000_000)
    })

    it('la vista lo dice antes de unir: de $0 a lo que llega', async () => {
      const v = await vistaUnion(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r10' })
      expect(v.destino.capital).toBe(0)
      expect(v.capitalDespues).toBe(573000)
    })

    it('⚠ el recálculo lo deja igual', async () => {
      base.t.capital[0].saldo = 573000 - 2_300_000
      ruta('r9').saldoCapital = 0; ruta('r10').saldoCapital = 0
      const { registrarMovimientoCapital } = await import('@/lib/capital')
      await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'inyeccion', monto: 573000, rutaId: 'r9', descripcion: 'x' })
      await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'desembolso', monto: 2_300_000, rutaId: 'r10', descripcion: 'x' })
      base.t.capital[0].saldo = 573000 - 2_300_000
      await unir()
      const antes = { r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }
      expect(antes).toEqual({ r9: 0, r10: 573000, global: 573000 - 2_300_000 })
      await recalcularSaldosCapital(base, { organizationId: ORG })
      expect({ r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }).toEqual(antes)
    })

    it('si la #9 tampoco llevaba capital, la #10 no se toca', async () => {
      ruta('r9').capitalHabilitado = false
      await unir()
      expect(ruta('r10')).toMatchObject({ saldoCapital: -2_300_000, capitalHabilitado: false })
      expect(base.t.movimientos).toHaveLength(0)
    })
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

  it('si un mismo cobrador tenía las dos y se queda, no hay clientes «nuevos» para él', async () => {
    ruta('r9').cobradorId = 'carlos'
    const r = await unir()
    expect(r.clientesNuevosParaElCobrador).toBe(0)
  })

  it('«Hoy ya se cobraron» no suma recargos ni descuentos (como la caja), pero un recargo solo sí bloquea', async () => {
    base.t.pagosHoy.push({ clienteId: 'a0', monto: 50000, tipo: 'completo' }, { clienteId: 'a0', monto: 9000, tipo: 'recargo' })
    expect((await unir()).error).toMatch(/^Hoy ya se cobraron \$50\.000 en RUTA #9/)
    base.t.pagosHoy.length = 0
    base.t.pagosHoy.push({ clienteId: 'a1', monto: 9000, tipo: 'recargo' })
    expect((await unir()).error).toMatch(/^Hoy ya hubo movimiento en RUTA #9/)
  })

  it('un cobrador desactivado no se ofrece como el que ya cobra', async () => {
    base.t.users.find((u) => u.id === 'carlos').activo = false
    const v = await vistaUnion(base, { organizationId: ORG, origenId: 'r9', destinoId: 'r10' })
    expect(v.destino.cobrador).toBeNull()
    // Pero la pantalla sabe que había uno, para decidir igual que el servidor si «cambia».
    expect(v.destino.cobradorId).toBe('carlos')
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

/* ══ DETALLES-RUTAS #8 y #10 (cf-v1172) ═════════════════════════════════════
   Las mismas piezas de lib/rutas/traslado.js que usa la unión, con
   lib/capital.js de verdad: el préstamo que cambia de ruta cambia de bolsa, y la
   ruta que empieza su capital arranca en cero. */
describe('#8 · el cliente con préstamos que cambia de ruta', () => {
  const r9 = () => ({ id: 'r9', nombre: 'RUTA #9', capitalHabilitado: true })
  const r10 = () => ({ id: 'r10', nombre: 'RUTA #10', capitalHabilitado: true })

  it('de una ruta con capital a otra con capital: la de origen recupera lo que le deben', async () => {
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    const r = await pasarPrestamosDeRuta(base, {
      organizationId: ORG, destino: r10(), usuarioId: 'dueno',
      movidos: [{ prestamoId: 'p1', saldo: 60000, origen: r9() }, { prestamoId: 'p2', saldo: 40000, origen: r9() }],
    })
    expect(r.trasladado).toEqual([{ origen: 'RUTA #9', monto: 100000, prestamos: 2 }])
    expect(ruta('r9').saldoCapital).toBe(573000 + 100000)
    expect(ruta('r10').saldoCapital).toBe(279000 - 100000)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
    const [vuelve, sale] = base.t.movimientos
    expect(vuelve).toMatchObject({ tipo: 'ajuste', rutaId: 'r9', monto: 100000, referenciaTipo: 'ruta', ajusteArranqueRuta: false, descripcion: 'Traslado de clientes: 2 préstamos de RUTA #9 pasan a RUTA #10' })
    expect(sale).toMatchObject({ tipo: 'ajuste', rutaId: 'r10', monto: 100000, referenciaTipo: 'ruta', descripcion: 'Traslado de clientes: RUTA #10 se queda con 2 préstamos de RUTA #9' })
    for (const m of base.t.movimientos) expect(afectaElFajo(m)).toBe(false)
  })

  it('y aunque haya dicho «sin reservar»: eso es solo para lo que viene del negocio', async () => {
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: r10(), reservar: false, usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 1000, origen: r9() }] })
    expect(ruta('r9').saldoCapital).toBe(574000)
  })

  it('a una ruta sin capital o sin ruta: la recupera del negocio', async () => {
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: null, usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 50000, origen: r9() }] })
    expect(ruta('r9').saldoCapital).toBe(623000)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
    expect(base.t.movimientos[1]).toMatchObject({ rutaId: null, descripcion: 'Traslado de clientes: el negocio se queda con 1 préstamo de RUTA #9' })
    expect(base.t.movimientos[0].descripcion).toBe('Traslado de clientes: 1 préstamo de RUTA #9 pasa a la plata del negocio')
  })

  it('de la plata del negocio a una ruta con capital: la reserva, solo si se pidió', async () => {
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: r10(), reservar: false, usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 30000, origen: null }] })
    expect(base.t.movimientos).toHaveLength(0)
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: r10(), reservar: true, usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 30000, origen: { id: 'rx', nombre: 'X', capitalHabilitado: false } }] })
    expect(base.t.movimientos).toHaveLength(1)
    expect(base.t.movimientos[0]).toMatchObject({ tipo: 'desembolso', ajusteArranqueRuta: true, referenciaTipo: 'prestamo', referenciaId: 'p1', rutaId: 'r10', monto: 30000 })
    expect(ruta('r10').saldoCapital).toBe(249000)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
  })

  it('a una ruta sin capital desde la plata del negocio, o a la misma ruta: nada', async () => {
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: { id: 'rx', nombre: 'X', capitalHabilitado: false }, reservar: true, usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 30000, origen: null }] })
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: r9(), usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 30000, origen: r9() }] })
    expect(base.t.movimientos).toHaveLength(0)
  })

  it('⚠ el recálculo lo deja igual', async () => {
    base.t.capital[0].saldo = 852000
    ruta('r9').saldoCapital = 0; ruta('r10').saldoCapital = 0
    const { registrarMovimientoCapital } = await import('@/lib/capital')
    await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'inyeccion', monto: 573000, rutaId: 'r9', descripcion: 'x' })
    await registrarMovimientoCapital(base, { organizationId: ORG, tipo: 'inyeccion', monto: 279000, rutaId: 'r10', descripcion: 'x' })
    base.t.capital[0].saldo = 852000
    const { pasarPrestamosDeRuta } = await import('@/lib/rutas/traslado')
    await pasarPrestamosDeRuta(base, { organizationId: ORG, destino: r10(), usuarioId: 'd', movidos: [{ prestamoId: 'p1', saldo: 100000, origen: r9() }] })
    const antes = { r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }
    expect(antes).toEqual({ r9: 673000, r10: 179000, global: 852000 })
    await recalcularSaldosCapital(base, { organizationId: ORG })
    expect({ r9: ruta('r9').saldoCapital, r10: ruta('r10').saldoCapital, global: base.t.capital[0].saldo }).toEqual(antes)
  })
})

describe('#10 · la ruta que empieza su capital arranca en cero', () => {
  it('su cuenta interna vuelve al negocio; el capital del negocio no cambia', async () => {
    const { empezarCapitalPropio } = await import('@/lib/rutas/traslado')
    ruta('r10').capitalHabilitado = false; ruta('r10').saldoCapital = -649933
    const viejo = await empezarCapitalPropio(base, { organizationId: ORG, ruta: ruta('r10'), usuarioId: 'd' })
    expect(viejo).toBe(-649933)
    expect(ruta('r10').saldoCapital).toBe(0)
    expect(base.t.capital[0].saldo).toBe(5_000_000)
    expect(base.t.movimientos.map((m) => m.descripcion)).toEqual([
      'Capital propio: RUTA #10 empieza su capital propio',
      'Capital propio: lo que RUTA #10 movía con la plata del negocio queda en el negocio',
    ])
    for (const m of base.t.movimientos) expect(afectaElFajo(m)).toBe(false)
  })
  it('en cero no apunta nada', async () => {
    const { empezarCapitalPropio } = await import('@/lib/rutas/traslado')
    ruta('r10').saldoCapital = 0
    expect(await empezarCapitalPropio(base, { organizationId: ORG, ruta: ruta('r10'), usuarioId: 'd' })).toBe(0)
    expect(base.t.movimientos).toHaveLength(0)
  })
  it('lo que alguien teclea con «Capital propio» sigue siendo plata', () => {
    expect(afectaElFajo({ tipo: 'inyeccion', monto: 1, saldoAnterior: 0, saldoNuevo: 1, descripcion: 'Capital propio para la ruta' })).toBe(true)
    expect(afectaElFajo({ tipo: 'ajuste', monto: 1, saldoAnterior: 0, saldoNuevo: 1, descripcion: 'Traslado de clientes a la ruta 3' })).toBe(true)
  })
})
