import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mesesPagados, tocaSegundoMes, DESCUENTO_SEGUNDO_MES } from '@/lib/seguimiento/segundo-mes'
import { precioConDescuento, DESCUENTO_NEQUI } from '@/lib/seguimiento/reglas'
import { mostrarLineaCupo, umbralPendiente, beneficiosDeSubir, diferenciaMensual, planSiguiente } from '@/lib/cupo-clientes'
import { debeAbrirseHojaAno } from '@/lib/aviso-pagar-ano'
import { mesYAno } from '@/lib/precio-desde-estado'

const D = (s) => new Date(s)

describe('el segundo mes a mitad de precio', () => {
  it('cuenta MESES pagados: dos pagos a menos de 10 días son el mismo periodo', () => {
    const m = (fecha, periodo = 'mensual') => ({ fecha, periodo })
    expect(mesesPagados([])).toBe(0)
    expect(mesesPagados([m('2026-10-01T15:00:00Z')])).toBe(1)
    // cambio de plan a los 3 días: sigue siendo el primer mes
    expect(mesesPagados([m('2026-10-01T15:00:00Z'), m('2026-10-04T15:00:00Z')])).toBe(1)
    expect(mesesPagados([m('2026-10-01T15:00:00Z'), m('2026-10-31T15:00:00Z')])).toBe(2)
    // ⚠ el caso real del 1 nov: UN pago trimestral no es «el primer mes»
    expect(mesesPagados([m('2026-09-14T21:00:00Z', 'trimestral')])).toBe(3)
    expect(mesesPagados([m('2026-10-01T15:00:00Z'), m('2026-10-03T15:00:00Z', 'anual')])).toBe(12)
  })

  const base = { meses: 1, tieneFuente: false, gateway: 'wompi', vencimiento: '2026-11-12T05:00:00Z' }

  it('le toca a quien va en su primer mes pagado, a mano, en Wompi, antes de vencer', () => {
    expect(tocaSegundoMes({ ...base, ahora: D('2026-11-10T15:00:00Z') })).toBe(true)
  })

  it('a tiempo es hasta que termina el día en que vence, en Bogotá', () => {
    // 12 nov 23:30 en Bogotá = 13 nov 04:30 UTC: todavía es el 12
    expect(tocaSegundoMes({ ...base, vencimiento: '2026-11-12T20:00:00Z', ahora: D('2026-11-13T04:30:00Z') })).toBe(true)
    // 13 nov 00:30 en Bogotá: ya se venció
    expect(tocaSegundoMes({ ...base, vencimiento: '2026-11-12T20:00:00Z', ahora: D('2026-11-13T05:30:00Z') })).toBe(false)
  })

  it('no le toca al que ya tiene el cobro automático, ni en el tercer mes, ni sin Wompi', () => {
    const ahora = D('2026-11-10T15:00:00Z')
    expect(tocaSegundoMes({ ...base, tieneFuente: true, ahora })).toBe(false)
    expect(tocaSegundoMes({ ...base, meses: 2, ahora })).toBe(false)
    expect(tocaSegundoMes({ ...base, meses: 3, ahora })).toBe(false)
    expect(tocaSegundoMes({ ...base, meses: 0, ahora })).toBe(false)
    expect(tocaSegundoMes({ ...base, gateway: 'mercadopago', ahora })).toBe(false)
  })

  it('cobra la mitad con el mismo redondeo del servidor', () => {
    expect(DESCUENTO_SEGUNDO_MES).toBe(0.5)
    expect(precioConDescuento(39000, DESCUENTO_SEGUNDO_MES)).toBe(19500)
    expect(precioConDescuento(59000, DESCUENTO_SEGUNDO_MES)).toBe(29500)
    // el 35 % de siempre no cambia
    expect(precioConDescuento(39000)).toBe(Math.round(39000 * (1 - DESCUENTO_NEQUI) / 100) * 100)
  })

  it('la oferta del Nequi usa el 50 % en esta ventana y no se suma a otra', () => {
    const src = readFileSync('lib/seguimiento/oferta-nequi.js', 'utf8')
    expect(src).toMatch(/seg\?\.ofertaNequi !== 'aplicada'\s*\n\s*&& await enSegundoMes\(/)
    expect(src).toMatch(/precioConDescuento\(lista, descuento\)/)
    // las tres rutas guardan el medio ANTES de llamar: sin esto nunca entraría
    expect(src).toMatch(/ignorarFuente: true/)
  })
})

describe('el cupo de clientes', () => {
  const uso = (usado, limite = 100, plan = 'starter') => ({ plan, clientes: { usado, limite } })

  it('la línea gris sale desde el 85 % y no en el plan más alto', () => {
    expect(mostrarLineaCupo(uso(84))).toBe(false)
    expect(mostrarLineaCupo(uso(85))).toBe(true)
    expect(mostrarLineaCupo(uso(9000, 10000, 'professional'))).toBe(false)
    expect(mostrarLineaCupo(null)).toBe(false)
  })

  it('la hoja sale dos veces: al cruzar el 85 % y el 95 %, nunca dos seguidas', () => {
    expect(umbralPendiente(uso(86), [])).toBe(0.85)
    expect(umbralPendiente(uso(86), [0.85])).toBe(null)
    expect(umbralPendiente(uso(96), [0.85])).toBe(0.95)
    // entra ya pasado el 95 %: solo la del 95
    expect(umbralPendiente(uso(97), [])).toBe(0.95)
    expect(umbralPendiente(uso(97), [0.85, 0.95])).toBe(null)
  })

  it('del Inicial vende los reportes y el Excel, no solo los clientes', () => {
    const b = beneficiosDeSubir('starter')
    expect(b.nombre).toBe('Básico')
    const titulos = b.lista.map((x) => x.titulo)
    expect(titulos[0]).toBe('Reportes de tu negocio')
    expect(titulos).toContain('Toda tu cartera en Excel')
    expect(titulos[titulos.length - 1]).toBe('Hasta 450 clientes')
  })

  it('del Básico al Crecimiento vende el cobrador, las rutas y Lucas', () => {
    const titulos = beneficiosDeSubir('basic').lista.map((x) => x.titulo)
    expect(titulos).toContain('1 cobrador con su propia cuenta')
    expect(titulos).toContain('Hasta 3 rutas')
    expect(titulos).toContain('Lucas, el asistente')
  })

  it('la diferencia es la del país, y dice «más al mes», no «más que hoy»', () => {
    expect(diferenciaMensual('starter', 'co')).toEqual({ diferencia: 20000, precioSiguiente: 59000 })
    expect(planSiguiente('professional')).toBe(null)
    const src = readFileSync('components/plan/CupoClientes.jsx', 'utf8')
    expect(src).toMatch(/>Todo esto por solo</)
    expect(src).not.toMatch(/más que hoy/)
  })
})

describe('el año a la vista', () => {
  const estado = {
    planPagado: true, diasRestantes: 3, fechaVencimiento: '2026-11-04T05:00:00Z',
    proximoCobro: { plan: 'starter', monto: 39000 }, inicioPeriodo: '2026-11-04T05:00:00Z',
    ofertaNequi: null, ofertaSegundoMes: false, cobroAutomatico: { activo: false },
  }

  it('la hoja sale a quien paga a mano, entre 2 y 5 días antes de vencer', () => {
    expect(debeAbrirseHojaAno(estado, { rol: 'owner' })).toBe(true)
    expect(debeAbrirseHojaAno({ ...estado, diasRestantes: 1 }, { rol: 'owner' })).toBe(false)
    expect(debeAbrirseHojaAno({ ...estado, diasRestantes: 6 }, { rol: 'owner' })).toBe(false)
    expect(debeAbrirseHojaAno(estado, { rol: 'cobrador' })).toBe(false)
  })

  it('no le sale a quien tiene cobro automático, ni en el primer mes (tiene el 50 %), ni en prueba', () => {
    expect(debeAbrirseHojaAno({ ...estado, cobroAutomatico: { activo: true } }, { rol: 'owner' })).toBe(false)
    expect(debeAbrirseHojaAno({ ...estado, ofertaSegundoMes: true }, { rol: 'owner' })).toBe(false)
    expect(debeAbrirseHojaAno({ ...estado, planPagado: false }, { rol: 'owner' })).toBe(false)
  })

  it('las cifras son las del checkout: 10 meses por 12', () => {
    const p = mesYAno(estado, 'co')
    expect(p.mes).toBe(39000)
    expect(p.ano).toBe(390000)
    expect(p.ahorroAno).toBe(78000)
    expect(p.anoAlMes).toBe(32500)
  })

  it('la pantalla del plan llega con el año puesto desde la hoja', () => {
    const src = readFileSync('app/(dashboard)/configuracion/plan/page.jsx', 'utf8')
    expect(src).toMatch(/searchParams\.get\('periodo'\)/)
    expect(src).toMatch(/periodoUrl && periodoUrl !== 'mensual'\) \? 'unico'/)
    expect(src).toMatch(/: periodoEfectivo === 'anual' \? 'Pagar el año'/)
  })
})
