// Los KPIs por RUTA del detalle de caja.
//
// El dueño con más cobradores los pidió completos: inicio del día, cobrado,
// prestado, seguros, recargos y la gestión (cobrados, activos, nuevos,
// renovaciones) — **de cada ruta**, no sumados. Con tres rutas, «2 clientes
// nuevos» no dice en cuál entraron.
//
// Lo que se vigila aquí es la ARITMÉTICA, que es lo que puede mentir:
//  · lo de cada ruta tiene que sumar el total de arriba,
//  · el efectivo y lo digital tienen que sumar lo cobrado,
//  · los recargos NO pueden colarse en lo cobrado.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const api = readFileSync(
  join(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')
const comp = readFileSync(
  join(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ── La aritmética, con datos ───────────────────────────────────────────────
// Se replica el reparto del endpoint: cada pago cae en la ruta de SU cliente.
function repartir(cobros, recargos) {
  const porRuta = new Map()
  const b = (id) => {
    if (!porRuta.has(id)) porRuta.set(id, { cobrado: 0, efectivo: 0, digital: 0, recargos: 0, nRecargos: 0 })
    return porRuta.get(id)
  }
  for (const p of cobros) {
    const f = b(p.ruta)
    f.cobrado += p.monto
    if (p.metodo === 'transferencia') f.digital += p.monto
    else f.efectivo += p.monto
  }
  for (const r of recargos) { const f = b(r.ruta); f.recargos += r.monto; f.nRecargos += 1 }
  return porRuta
}

describe('lo de cada ruta suma el total del cobrador', () => {
  const cobros = [
    { ruta: 'r1', monto: 30000, metodo: 'efectivo' },
    { ruta: 'r1', monto: 20000, metodo: 'transferencia' },
    { ruta: 'r2', monto: 45000, metodo: 'efectivo' },
  ]

  it('el cobrado por ruta cuadra con el total', () => {
    const m = repartir(cobros, [])
    const suma = [...m.values()].reduce((a, f) => a + f.cobrado, 0)
    expect(suma).toBe(95000)
    expect(m.get('r1').cobrado).toBe(50000)
    expect(m.get('r2').cobrado).toBe(45000)
  })

  it('efectivo + digital = cobrado, en CADA ruta', () => {
    // Si esto falla, al cobrador se le pide un fajo que no corresponde.
    for (const f of repartir(cobros, []).values()) {
      expect(f.efectivo + f.digital).toBe(f.cobrado)
    }
  })

  it('lo que no dice el método cuenta como efectivo', () => {
    // Los pagos viejos (antes de T08-01) no traen `metodoPago`. Contarlos como
    // digital le quitaría al cobrador plata que sí tiene en la mano.
    const m = repartir([{ ruta: 'r1', monto: 10000, metodo: null }], [])
    expect(m.get('r1').efectivo).toBe(10000)
    expect(m.get('r1').digital).toBe(0)
  })
})

describe('los recargos no son plata que entró', () => {
  it('no suman al cobrado de la ruta', () => {
    const m = repartir(
      [{ ruta: 'r1', monto: 30000, metodo: 'efectivo' }],
      [{ ruta: 'r1', monto: 770000 }],
    )
    // El caso real de una captura: recargos $770.000 sobre $355.000 cobrados.
    // Si se sumaran, la ruta diría que entró plata que nadie entregó.
    expect(m.get('r1').cobrado).toBe(30000)
    expect(m.get('r1').recargos).toBe(770000)
  })

  it('van con su conteo, para poder revisarlos', () => {
    const m = repartir([], [{ ruta: 'r1', monto: 1000 }, { ruta: 'r1', monto: 2000 }])
    expect(m.get('r1').nRecargos).toBe(2)
    expect(m.get('r1').recargos).toBe(3000)
  })
})

describe('el servidor manda las cifras por ruta', () => {
  it('cada ruta lleva su apertura, su partición y sus recargos', () => {
    for (const campo of ['saldoApertura', 'cobradoEfectivo', 'cobradoDigital', 'recargosDia', 'recargosCantidad']) {
      expect(api, `falta ${campo} en porRutaMap`).toMatch(new RegExp(`${campo}:`))
    }
  })

  it('la gestión viaja POR RUTA, no solo sumada', () => {
    expect(api).toMatch(/gestionPorRuta/)
    expect(api).toMatch(/gestion: r\.rutaId/)
  })

  it('la fila «Otros» lleva los mismos campos que una ruta de verdad', () => {
    // Si le faltara alguno, la pantalla pintaría «undefined» justo en la fila
    // que agrupa lo que no se supo clasificar.
    const i = api.indexOf("nombre: 'Otros'")
    expect(i).toBeGreaterThan(-1)
    const bloque = api.slice(i, i + 400)
    for (const campo of ['saldoApertura', 'cobradoEfectivo', 'cobradoDigital', 'recargosDia']) {
      expect(bloque, `«Otros» sin ${campo}`).toMatch(new RegExp(`${campo}:`))
    }
  })

  it('los recargos se leen como FILAS, para poder repartirlos por ruta', () => {
    // Eran un `aggregate`, que no trae la ruta. Si alguien lo revierte, el
    // reparto se queda en cero sin fallar.
    expect(sinComentarios(api)).toMatch(/tipo: 'recargo'/)
    expect(sinComentarios(api)).not.toMatch(/aggregate\(\{\s*where:\s*\{\s*\.\.\.wherePagoCaja,\s*tipo: 'recargo'/)
  })

  it('el cliente se pide con su id, para contar personas y no pagos', () => {
    // Sin el `id`, dos pagos del mismo cliente cuentan como dos personas.
    expect(api).toMatch(/cliente: \{ select: \{ id: true, nombre: true/)
  })
})

describe('la pantalla pinta la gestión de la ruta', () => {
  it('están los cuatro cuadros', () => {
    const t = sinComentarios(comp)
    for (const r of ['Cobrados', 'Activos', 'Nuevos', 'Renovó']) {
      expect(t, `falta el cuadro «${r}»`).toMatch(new RegExp(`'${r}'`))
    }
  })

  it('el cero se pinta apagado, no se esconde', () => {
    // Mismo criterio que el tablero del cobrador: un cero informa.
    expect(sinComentarios(comp)).toMatch(/k\.val > 0 \? 'var\(--cf-ink\)' : 'var\(--cf-ink-3\)'/)
  })

  it('la partición solo sale si hubo digital', () => {
    // En una ruta 100% efectivo la línea sobra.
    expect(sinComentarios(comp)).toMatch(/ruta\.cobradoDigital \?\? 0\) > 0/)
  })
})
