/* LUCAS DICE LO MISMO QUE EL INICIO.
 *
 * Medido en el espejo el 20 sep 2026: su «meta diaria» era la suma de TODAS las
 * cuotas de la cartera —un domingo le dijo $65.588.500 a un negocio al que ese
 * día le tocaba cobrar $0—, la mora difería en 3 de 8 negocios porque su `select`
 * no pedía el día de cobro ni los devengos, y «intereses ya cobrados» era
 * capital-primero. Ahora cada cifra sale de la función que usa la pantalla. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { cifrasDeLaCartera, rotulosDeLosSieteDias, SELECT_PRESTAMO_DE_LUCAS } from '@/lib/asistente-cifras'
import { sinEmojis, REGLAS_DE_VOZ } from '@/lib/asistente-voz'
import { tienePeriodoEsperadoHoy } from '@/lib/calculos'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const HOY_DOW = new Date(Date.now() - 5 * 3600e3).getUTCDay()
const haceDias = (n) => new Date(Date.now() - n * 86_400_000)

const diario = (id, extra = {}) => ({
  id, clienteId: `c-${id}`, estado: 'activo', montoPrestado: 1_000_000, totalAPagar: 1_200_000,
  totalPagado: 0, abonadoCapital: 0, cuotaDiaria: 40_000, fechaInicio: haceDias(10), diasPlazo: 30,
  frecuencia: 'diario', modoInteres: 'fijo', sinPlazo: false, proximoCobroManual: null,
  diaCobroSemana: null, diaCobroMes: null, diaCobroMes2: null, primerCobro: null, diasSinCobro: null,
  devengos: [], cuotasAmortizacion: [], pagos: [],
  cliente: { id: `c-${id}`, nombre: `Cliente ${id}`, diasSinCobro: null, ruta: null },
  ...extra,
})

describe('la meta de hoy es lo que TOCA hoy, no la suma de las cuotas', () => {
  const abierto = diario('a')
  // Mismo préstamo, pero su cliente no se cobra el día de la semana que es hoy.
  const cerradoHoy = diario('b', { cliente: { id: 'c-b', nombre: 'Cerrado Hoy', diasSinCobro: JSON.stringify([HOY_DOW]), ruta: null } })
  const r = cifrasDeLaCartera({ prestamos: [abierto, cerradoHoy], org: { diasSinCobro: null }, festivos: [] })

  it('usa la misma función que el Inicio, préstamo a préstamo', () => {
    const esperado = [abierto].filter((p) => tienePeriodoEsperadoHoy(p, false, [], [])).reduce((n, p) => n + p.cuotaDiaria, 0)
    expect(r.esperadoHoy).toBe(esperado)
  })

  it('al que hoy no se le cobra no entra, aunque su cuota exista', () => {
    expect(r.esperadoHoy).toBeLessThan(abierto.cuotaDiaria + cerradoHoy.cuotaDiaria)
    expect(r.faltanHoy.lista.map((f) => f.nombre)).not.toContain('Cerrado Hoy')
  })

  it('un día sin nadie a quien cobrar da CERO, que es un dato', () => {
    const vacio = cifrasDeLaCartera({ prestamos: [cerradoHoy], org: null, festivos: [] })
    expect(vacio.esperadoHoy).toBe(0)
    expect(vacio.clientesConCobroHoy).toBe(0)
  })
})

describe('quién falta y quién cobró', () => {
  const p1 = diario('1'), p2 = diario('2')
  const r = cifrasDeLaCartera({
    prestamos: [p1, p2], org: null, festivos: [],
    pagosDeHoy: [
      { montoPagado: 40_000, cobradorId: 'u1', cobrador: { nombre: 'Juan' }, prestamo: { clienteId: 'c-1' } },
      { montoPagado: 15_000, cobradorId: 'u1', cobrador: { nombre: 'Juan' }, prestamo: { clienteId: 'c-x' } },
    ],
  })

  it('el que ya pagó hoy no «falta»', () => {
    if (r.clientesConCobroHoy === 0) return // hoy es día cerrado para todos: nada que afirmar
    expect(r.clientesCobradosHoy).toBe(1)
    expect(r.faltanHoy.lista.map((f) => f.nombre)).toEqual(['Cliente 2'])
    expect(r.faltanHoy.monto).toBe(40_000)
  })

  it('lo cobrado se agrupa por cobrador y suma lo cobrado', () => {
    expect(r.cobroHoy).toBe(55_000)
    expect(r.cobradoPorCobrador).toEqual([{ nombre: 'Juan', monto: 55_000, cobros: 2 }])
    expect(r.cobradoPorCobrador.reduce((n, c) => n + c.monto, 0)).toBe(r.cobroHoy)
  })

  it('un cliente con dos préstamos es UNA visita', () => {
    const dos = cifrasDeLaCartera({ prestamos: [diario('1'), diario('1b', { clienteId: 'c-1', cliente: p1.cliente })], org: null, festivos: [] })
    expect(dos.clientesActivos).toBe(1)
    expect(dos.clientesConCobroHoy).toBeLessThanOrEqual(1)
  })
})

describe('el interés cobrado es el del sistema, no capital-primero', () => {
  it('$600.000 cobrados de un 1.000.000 → 1.200.000 ya traen $100.000 de interés', () => {
    const p = diario('i', { totalPagado: 600_000, pagos: [{ montoPagado: 600_000, tipo: 'completo', fechaPago: haceDias(2) }] })
    const r = cifrasDeLaCartera({ prestamos: [p], org: null, festivos: [] })
    expect(r.interesesYaCobrados).toBe(100_000)   // capital-primero decía 0
    expect(r.interesesPorCobrar).toBe(100_000)
  })
})

describe('los siete días llevan su nombre de verdad', () => {
  it('un miércoles, la ventana empieza el jueves pasado', () => {
    const miercoles = new Date(Date.UTC(2026, 8, 16, 15))
    expect(rotulosDeLosSieteDias(miercoles)).toEqual(['jueves', 'viernes', 'sábado', 'domingo', 'lunes', 'ayer', 'hoy'])
  })
})

describe('sin emojis, y sin romper lo demás', () => {
  it('quita el pictograma y el hueco que deja', () => {
    expect(sinEmojis('¡Hola! 👋 Vas bien 💪, llevas $1.200.000')).toBe('¡Hola! Vas bien, llevas $1.200.000')
    expect(sinEmojis('👨‍👩‍👧 familia 🇨🇴 ok ✅.')).toBe('familia ok.')
  })
  it('respeta cifras, el menos tipográfico, las flechas de texto y la sangría de las listas', () => {
    const t = 'Debe −$50.000 → cobra hoy\n- Pedro: $5.000\n  - detalle'
    expect(sinEmojis(t)).toBe(t)
  })
  it('no revienta con vacío', () => {
    expect(sinEmojis('')).toBe('')
    expect(sinEmojis(null)).toBe('')
  })
})

describe('el hilo: el contexto y el chat usan esto', () => {
  const lucas = leer('lib/asistente.js')
  const ruta = leer('app/api/asistente/route.js')

  it('ya no existe la suma de todas las cuotas', () => {
    expect(lucas).not.toContain('cuotaDiariaTotal')
    expect(lucas).not.toContain('Meta diaria esperada')
    expect(lucas).toContain('HOY TOCA COBRAR: ${fmt(kpis.esperadoHoy)}')
  })

  it('los dos contextos —dueño y cobrador— salen de la misma función y sin clavos', () => {
    expect(lucas.match(/cifrasDeLaCartera\(\{/g)?.length).toBe(2)
    expect(lucas.match(/\.\.\.SELECT_PRESTAMO_DE_LUCAS,/g)?.length).toBe(2)
    expect(lucas.match(/esClavo: false,/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('el select pide lo que leen las funciones de cálculo', () => {
    for (const campo of ['diaCobroSemana', 'diaCobroMes', 'diaCobroMes2', 'primerCobro', 'diasSinCobro', 'sinPlazo', 'totalPagado', 'abonadoCapital', 'modoInteres', 'devengos', 'cuotasAmortizacion'])
      expect(SELECT_PRESTAMO_DE_LUCAS, campo).toHaveProperty(campo)
  })

  it('la ganancia del mes es interés menos gastos, y el prompt lo dice', () => {
    expect(lucas).toContain('gananciaMes: interesGanadoMes - gastosMes')
    expect(lucas).toContain('select: SELECT_PARA_INTERES')
    expect(lucas).toContain('Nunca recaudado menos gastos')
  })

  it('las reglas de voz van en los dos prompts y todo texto sale limpio', () => {
    expect(REGLAS_DE_VOZ).toContain('No uses emojis')
    expect(lucas.match(/\$\{REGLAS_DE_VOZ\}/g)?.length).toBe(2)
    const emisiones = ruta.match(/JSON\.stringify\(\{ token: [^'}][^}]*\}\)/g) ?? []
    const vivas = emisiones.filter((e) => !e.includes('delta.content'))
    expect(vivas.length).toBeGreaterThanOrEqual(4)
    for (const e of vivas) expect(e).toContain('sinEmojis(')
  })

  it('la sugerencia «llevo X % de mi meta» mide contra lo de hoy', () => {
    expect(leer('app/api/asistente/uso/route.js')).toContain('ctx.kpis.cobroHoy / ctx.kpis.esperadoHoy')
  })
})

describe('la mora urgente va por cliente, no por préstamo', () => {
  it('tres préstamos atrasados de la misma persona son UN renglón, con la suma', () => {
    const atrasado = (id) => diario(id, { clienteId: 'c-m', fechaInicio: haceDias(60), cliente: { id: 'c-m', nombre: 'La Misma', diasSinCobro: null, ruta: null } })
    const r = cifrasDeLaCartera({ prestamos: [atrasado('m1'), atrasado('m2'), atrasado('m3')], org: null, festivos: [] })
    expect(r.clientesMora).toBe(1)
    expect(r.moraUrgente).toHaveLength(1)
    expect(r.moraUrgente[0]).toMatchObject({ nombre: 'La Misma', prestamosEnMora: 3, saldo: 3 * 1_200_000 })
  })
})
