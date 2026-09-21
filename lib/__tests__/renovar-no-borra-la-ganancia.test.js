// lib/__tests__/renovar-no-borra-la-ganancia.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Renovar borraba ganancia, desde siempre, por dos lados (21 sep 2026):
//
//   1. El viejo se cierra con `totalAPagar = lo pagado`. Con el total por
//      debajo de lo prestado, la fracción de interés se acota a 0 y TODO lo que
//      se cobró en esa cartulina contaba como capital devuelto.
//   2. El nuevo nace con `montoPrestado` = la deuda entera, y una parte de esa
//      deuda es interés que no se cobró. Ese interés entraba como capital y no
//      se reconocía nunca.
//
// Medido en PRESTA MIL: $20.953.583 de interés cobrado borrado + $12.035.416 de
// interés sin cobrar convertido en capital, en 635 renovaciones.
//
// El dueño: «no se permite que los cálculos estén mal».
//
// La regla que fija esta prueba: el arreglo es SOLO para repartir la ganancia.
// Lo que el cliente debe, lo que se liquida al renovar, el interés que se cobra
// y lo que dice su recibo NO se mueven un peso.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'
import {
  repartirPagado, capitalEnCalle, capitalPerdido, interesGanado,
} from '@/lib/dinero/reparto'
import { interesPagoAPago, repartoDeUnPago } from '@/lib/dinero/interes-cobrado'
import {
  calcularCapitalRestante, calcularSaldoPendiente, minimoParaRenovar, interesCobrableAhora,
} from '@/lib/calculos'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')
const pago = (monto, tipo = 'completo', fecha = '2026-08-10T15:00:00Z') => ({ montoPagado: monto, tipo, fechaPago: fecha })

/* El caso real que se desglosó al peso: prestó $1.000.000 al 20 % (total
   $1.200.000), le pagaron $519.000 y renovó entregando $300.000 más. */
const ANTES = {
  id: 'viejo', modoInteres: 'fijo', montoPrestado: 1000000, totalAPagar: 1200000,
  totalPagado: 519000, pagos: [pago(519000)],
}
const CERRADO = { ...ANTES, totalAPagar: 519000, totalAPagarPrevio: 1200000, estado: 'renovado' }

// Lo que hace la ruta de renovar, con sus mismas funciones y su mismo redondeo del efectivo.
const deuda = minimoParaRenovar(ANTES)
const ENTREGA = 300000
const M2 = deuda + ENTREGA
const efectivo = (monto, minimo) => Math.ceil((monto - minimo) / 100) * 100
const arrastradoDe = (monto, minimo, original) => Math.max(0, Math.round(monto - Math.max(0, efectivo(monto, minimo)) - capitalEnCalle(original)))
const arrastrado = arrastradoDe(M2, deuda, ANTES)
const T2 = Math.round(M2 * 1.2)
const NUEVO = { id: 'nuevo', modoInteres: 'fijo', montoPrestado: M2, totalAPagar: T2, interesArrastrado: arrastrado, totalPagado: 0, pagos: [] }

describe('el préstamo que se cierra al renovar conserva su ganancia', () => {
  it('lo cobrado se reparte con el total PACTADO: 432.500 de capital y 86.500 de interés', () => {
    expect(repartirPagado(CERRADO)).toMatchObject({ capital: 432500, interes: 86500 })
  })

  it('no es capital perdido: lo que faltaba pasó al nuevo', () => {
    expect(capitalPerdido(CERRADO)).toBe(0)
  })

  it('y ya no tiene capital en la calle', () => {
    expect(capitalEnCalle(CERRADO)).toBe(0)
    expect(calcularCapitalRestante(CERRADO, { paraReparto: true })).toBe(0)
  })

  it('su interés pago a pago dice lo mismo que el total', () => {
    const filas = interesPagoAPago({ prestamo: CERRADO, pagos: CERRADO.pagos })
    expect(Math.round(filas.reduce((a, f) => a + f.interes, 0))).toBe(86500)
  })
})

describe('el préstamo nuevo sabe cuánto de su deuda es interés', () => {
  it('la deuda que absorbe es 681.000 y 113.500 de ella es interés sin cobrar', () => {
    expect(deuda).toBe(681000)
    expect(arrastrado).toBe(113500)
  })

  it('tu plata en la calle es lo que seguía afuera más lo que entregaste', () => {
    // 567.500 del viejo + 300.000 nuevos. NO los 981.000 de la cartulina.
    expect(capitalEnCalle(NUEVO)).toBe(867500)
    expect(calcularCapitalRestante(NUEVO, { paraReparto: true })).toBe(867500)
  })

  it('LA CADENA ENTERA reconoce lo que de verdad se ganó, al peso', () => {
    const pagado = { ...NUEVO, totalPagado: T2, pagos: [pago(T2)] }
    const ganancia = interesGanado(CERRADO) + interesGanado(pagado)
    // Entró 519.000 + T2; salió 1.000.000 + 300.000. La diferencia es la ganancia.
    expect(ganancia).toBe(519000 + T2 - 1000000 - ENTREGA)
    expect(capitalEnCalle(pagado)).toBe(0)
  })

  it('los pesos del redondeo del efectivo salen del interés, no se inventan', () => {
    // Entregar $119.355 sale como $119.400: esos $45 son capital que salió de la caja.
    const monto = deuda + 119355
    expect(efectivo(monto, deuda)).toBe(119400)
    expect(arrastradoDe(monto, deuda, ANTES)).toBe(113500 - 45)
  })

  it('un nuevo que era TODO interés tiene capital cero, no el de la cartulina', () => {
    // Quien financia un saldo que ya solo era interés: `null` hacía que los que
    // suman cayeran al `?? p.montoPrestado` y contaran la deuda como capital.
    const soloInteres = { modoInteres: 'fijo', montoPrestado: 200000, totalAPagar: 240000, interesArrastrado: 200000, totalPagado: 0, pagos: [] }
    expect(calcularCapitalRestante(soloInteres, { paraReparto: true })).toBe(0)
    expect(capitalEnCalle(soloInteres)).toBe(0)
  })
})

describe('⚠ la DEUDA no se mueve un peso', () => {
  const sin = { ...NUEVO, interesArrastrado: null, totalPagado: 400000, pagos: [pago(400000)] }
  const con = { ...sin, interesArrastrado: arrastrado }

  it('saldo, capital de la deuda, mínimo para renovar e interés cobrable, idénticos', () => {
    expect(calcularSaldoPendiente(con)).toBe(calcularSaldoPendiente(sin))
    expect(calcularCapitalRestante(con)).toBe(calcularCapitalRestante(sin))
    expect(minimoParaRenovar(con)).toBe(minimoParaRenovar(sin))
    expect(interesCobrableAhora(con)).toEqual(interesCobrableAhora(sin))
  })

  it('el total pactado del viejo no cambia lo que se liquida de un préstamo vivo', () => {
    // `totalAPagarPrevio` solo existe en los cerrados; aun así, la deuda no lo lee.
    const vivo = { ...ANTES, totalAPagarPrevio: 999999 }
    expect(calcularSaldoPendiente(vivo)).toBe(calcularSaldoPendiente(ANTES))
    expect(calcularCapitalRestante(vivo)).toBe(calcularCapitalRestante(ANTES))
    expect(minimoParaRenovar(vivo)).toBe(minimoParaRenovar(ANTES))
  })

  it('el recibo del cliente habla de SU deuda: no separa el interés arrastrado', () => {
    const pagos = [{ ...pago(200000), id: 'g1' }]
    const conA = repartoDeUnPago({ prestamo: { ...NUEVO, pagos }, pagos, pagoId: 'g1' })
    const sinA = repartoDeUnPago({ prestamo: { ...NUEVO, interesArrastrado: null, pagos }, pagos, pagoId: 'g1' })
    expect(conA).toEqual(sinA)
  })

  it('pero el recibo reimpreso de la cartulina cerrada ya no dice «interés $0»', () => {
    const pagos = [{ ...pago(519000), id: 'g1' }]
    expect(repartoDeUnPago({ prestamo: { ...CERRADO, pagos }, pagos, pagoId: 'g1' }))
      .toEqual({ interes: 86500, capital: 432500 })
  })
})

describe('con tabla, lo que la tabla llama capital lleva dentro el interés arrastrado', () => {
  /* Tabla de 2 cuotas sobre una deuda de 100.000 de la que 20.000 era interés
     de la cartulina anterior: cada cuota paga 10.000 de interés de tabla y
     50.000 de «capital», y de esos 50.000 el 20 % es interés arrastrado. */
  const cuotas = [
    { numeroPeriodo: 1, cuotaTotal: 60000, capital: 50000, interes: 10000 },
    { numeroPeriodo: 2, cuotaTotal: 60000, capital: 50000, interes: 10000 },
  ]
  const conTabla = {
    modoInteres: 'lineal', montoPrestado: 100000, totalAPagar: 120000, interesArrastrado: 20000,
    cuotasAmortizacion: cuotas, totalPagado: 60000, pagos: [pago(60000)],
  }

  it('una cuota: 10.000 de tabla + 10.000 arrastrados = 20.000 de interés', () => {
    expect(repartirPagado(conTabla)).toMatchObject({ interes: 20000, capital: 40000 })
  })

  it('pago a pago dice lo mismo', () => {
    const filas = interesPagoAPago({ prestamo: conTabla, cuotas, pagos: conTabla.pagos })
    expect(Math.round(filas[0].interes)).toBe(20000)
  })

  it('y el capital en la calle sale igual por las dos funciones', () => {
    // 80.000 de capital de verdad − 40.000 devueltos.
    expect(capitalEnCalle(conTabla)).toBe(40000)
    expect(calcularCapitalRestante(conTabla, { paraReparto: true })).toBe(40000)
  })

  it('la deuda de la tabla no cambia', () => {
    expect(calcularCapitalRestante(conTabla)).toBe(calcularCapitalRestante({ ...conTabla, interesArrastrado: null }))
  })
})

describe('la ruta de renovar apunta el interés arrastrado', () => {
  const ruta = src('app/api/prestamos/[id]/renovar/route.js')

  it('con el reparto, ANTES de cerrar el viejo, y con el efectivo que de verdad sale', () => {
    expect(ruta).toMatch(/const capitalQueSigueAfuera = capitalEnCalle\(original\)/)
    // Con el efectivo REDONDEADO que sale de la caja (`diferencia`), no con la resta exacta.
    expect(ruta).toMatch(/const interesArrastrado = Math\.max\(0, Math\.round\(montoFinal - Math\.max\(0, diferencia\) - capitalQueSigueAfuera\)\)/)
    expect(ruta).toMatch(/\.\.\.\(interesArrastrado > 0 \? \{ interesArrastrado \} : \{\}\)/)
    // Se mide antes del update que reescribe `totalAPagar` del viejo.
    expect(ruta.indexOf('capitalEnCalle(original)')).toBeLessThan(ruta.indexOf('totalAPagarPrevio: original.totalAPagar'))
  })
})

describe('analíticas no cuenta la renovación como capital perdido', () => {
  it('el SQL usa las dos piezas del reparto', () => {
    const a = src('app/api/dashboard/analiticas/route.js')
    expect(a).toMatch(/SUM\(\$\{Prisma\.raw\(CAPITAL_REAL\)\} - \$\{Prisma\.raw\(TOTAL_REPARTO\)\}\) as monto/)
    expect(a).not.toMatch(/SUM\(montoPrestado - totalAPagar\)/)
  })
})

describe('⚠ quien carga un préstamo con su monto y su total pide también las dos piezas', () => {
  /* Un campo que no se pide vale `undefined`, no da error y decide en silencio:
     sin `totalAPagarPrevio` el reparto vuelve a borrar la ganancia del viejo y
     nadie se entera. Esta es la guarda que impide que la consulta número 37 nazca
     ciega. */
  function ficheros(dir, acc = []) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (e === 'node_modules' || e === '__tests__' || e.startsWith('.')) continue
      if (statSync(p).isDirectory()) ficheros(p, acc)
      else if (/\.(js|jsx|mjs)$/.test(e)) acc.push(p)
    }
    return acc
  }
  const todos = [...ficheros(resolve(process.cwd(), 'app')), ...ficheros(resolve(process.cwd(), 'lib'))]

  function objetosCon(s) {
    const out = []
    const re = /montoPrestado\s*:\s*true/g
    let m
    while ((m = re.exec(s))) {
      let d = 0, i = m.index
      for (; i >= 0; i--) { const c = s[i]; if (c === '}') d++; else if (c === '{') { if (d === 0) break; d-- } }
      let j = m.index; d = 0
      for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { if (d === 0) break; d-- } }
      let top = ''; d = 0
      for (let k = i + 1; k < j; k++) { const c = s[k]; if (c === '{') { d++; continue } if (c === '}') { d--; continue } if (d === 0) top += c }
      out.push({ top, antes: s.slice(Math.max(0, i - 12), i), linea: s.slice(0, m.index).split('\n').length })
    }
    return out
  }

  it('encuentra las consultas', () => {
    const n = todos.reduce((a, f) => a + objetosCon(readFileSync(f, 'utf8')).length, 0)
    expect(n).toBeGreaterThan(30)
  })

  it('ninguna pide `montoPrestado` y `totalAPagar` sin `...CAMPOS_DEL_REPARTO`', () => {
    const culpables = []
    for (const f of todos) {
      for (const o of objetosCon(readFileSync(f, 'utf8'))) {
        if (!/totalAPagar\s*:\s*true/.test(o.top)) continue
        if (/_(sum|avg|min|max|count)\s*:\s*$/.test(o.antes)) continue // agregados
        if (/\.\.\.CAMPOS_DEL_REPARTO/.test(o.top)) continue
        culpables.push(`${f.replace(process.cwd() + '/', '')}:${o.linea}`)
      }
    }
    expect(culpables, `estas consultas repartirían la ganancia a ciegas:\n  ${culpables.join('\n  ')}`).toHaveLength(0)
  })
})
