/* «LO QUE TOCA COBRAR HOY», UNA SOLA CUENTA (DETALLES-RUTAS #70).
 *
 * Seis pantallas daban cifras distintas para la misma ruta el mismo día:
 *   · Óscar, con su abono cubriendo hasta el 27, contaba en el Inicio y en la
 *     caja del cobrador y no en Rutas ni en Cobros de hoy.
 *   · Rosalba dio $10.000 de más ayer y hoy todas sumaban su cuota entera, y el
 *     porcentaje arrancaba en 6 % sin haber cobrado nada.
 * Decisión: el total dice lo que de verdad toca hoy y el avance arranca en 0 %. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loDeHoyDelPrestamo, tocaDeHoy, pagadoEnElDia, esperadoDeCartera } from '@/lib/dinero/esperado'
import { calcularMontoParaPonerseAlDia } from '@/lib/calculos'
import { avanceDeHoy } from '@/lib/adaptadores/cobros'
import { porcentajeDelDia } from '@/lib/adaptadores/rutas'
import { efectividadDe } from '@/lib/adaptadores/cobradores'
import { generarNarrativa } from '@/lib/adaptadores/narrativa'
import { adaptarPanelDinero } from '@/lib/adaptadores/panel-dinero'
import { porRutaHoy } from '@/lib/adaptadores/panel'
import { adaptarSinRuta } from '@/lib/adaptadores/rutas'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const haceDias = (n) => new Date(Date.now() - n * 86_400_000)
const CUOTA = 20_000

const diario = (extra = {}) => ({
  id: 'p', clienteId: 'c', estado: 'activo', esClavo: false, montoPrestado: 500_000, totalAPagar: 600_000,
  totalPagado: 0, abonadoCapital: 0, cuotaDiaria: CUOTA, fechaInicio: haceDias(10), diasPlazo: 30,
  frecuencia: 'diario', modoInteres: 'fijo', sinPlazo: false, proximoCobroManual: null, proximoCobroPorInteres: null,
  diaCobroSemana: null, diaCobroMes: null, diaCobroMes2: null, primerCobro: null, diasSinCobro: null,
  devengos: [], cuotasAmortizacion: [], pagos: [],
  ...extra,
})

// Lo que debería llevar pagado hasta hoy, con la cuota de hoy incluida.
const ESPERADO = calcularMontoParaPonerseAlDia(diario())

describe('la cuenta de un préstamo', () => {
  it('el punto de partida: hoy le toca y no ha pagado nada', () => {
    expect(ESPERADO).toBeGreaterThan(CUOTA)
    const r = loDeHoyDelPrestamo(diario())
    expect(r).toEqual({ cuenta: true, toca: CUOTA, falta: CUOTA, pendiente: true })
  })

  it('Óscar: con las cuotas cubiertas por adelantado no cuenta', () => {
    const oscar = diario({ totalPagado: ESPERADO + 5 * CUOTA })
    expect(loDeHoyDelPrestamo(oscar).cuenta).toBe(false)
    expect(loDeHoyDelPrestamo(oscar).toca).toBe(0)
  })

  it('Rosalba: lo que adelantó ayer baja lo que toca hoy, y le falta todo eso', () => {
    const rosalba = diario({ totalPagado: ESPERADO - CUOTA + 10_000 })
    const r = loDeHoyDelPrestamo(rosalba)
    expect(r.toca).toBe(CUOTA - 10_000)
    expect(r.falta).toBe(CUOTA - 10_000)
    expect(avanceDeHoy({ esperadoHoy: r.toca, faltaHoy: r.falta, recaudadoHoy: 0 })).toBe(0)
  })

  it('Rosalba abona hoy $5.000: lo que toca no se mueve y la falta baja', () => {
    const hoy = { montoPagado: 5_000, fechaPago: new Date(), tipo: 'completo' }
    const rosalba = diario({ totalPagado: ESPERADO - CUOTA + 10_000 + 5_000, pagos: [hoy] })
    const r = loDeHoyDelPrestamo(rosalba, { pagadoHoy: pagadoEnElDia(rosalba, new Date()) })
    expect(r.toca).toBe(CUOTA - 10_000)
    expect(r.falta).toBe(CUOTA - 15_000)
  })

  it('el que pagó su cuota hoy cuenta entera y ya no le falta nada', () => {
    const hoy = { montoPagado: CUOTA, fechaPago: new Date(), tipo: 'completo' }
    const p = diario({ totalPagado: ESPERADO, pagos: [hoy] })
    const r = loDeHoyDelPrestamo(p, { pagadoHoy: pagadoEnElDia(p, new Date()) })
    expect(r).toEqual({ cuenta: true, toca: CUOTA, falta: 0, pendiente: false })
  })

  it('el atrasado: toca UNA cuota, no toda la mora', () => {
    expect(loDeHoyDelPrestamo(diario()).toca).toBe(CUOTA)
  })

  it('un clavo, uno cancelado o uno sin préstamo no cuentan', () => {
    expect(loDeHoyDelPrestamo(diario({ esClavo: true })).cuenta).toBe(false)
    expect(loDeHoyDelPrestamo(diario({ estado: 'cancelado' })).cuenta).toBe(false)
    expect(loDeHoyDelPrestamo(null).cuenta).toBe(false)
  })

  it('el abono previo de un préstamo pasado del cuaderno no es cobro de hoy', () => {
    const p = diario({ pagos: [{ montoPagado: 90_000, fechaPago: new Date(), tipo: 'completo', nota: 'Abono previo (carga masiva)' }] })
    expect(pagadoEnElDia(p, new Date())).toBe(0)
  })

  it('`tocaDeHoy` sin tope (sin saber cuánto debe) es la cuota', () => {
    expect(tocaDeHoy({ cuota: CUOTA })).toBe(CUOTA)
    expect(tocaDeHoy({ cuota: CUOTA, pagadoHoy: 0, alDia: 0 })).toBe(0)
  })
})

describe('la caja del cobrador cuenta igual que la ruta', () => {
  it('`esperadoDeCartera` de hoy deja fuera a Óscar y le resta a Rosalba lo adelantado', () => {
    const oscar = diario({ id: 'o', totalPagado: ESPERADO + 5 * CUOTA })
    const rosalba = diario({ id: 'r', totalPagado: ESPERADO - CUOTA + 10_000 })
    const normal = diario({ id: 'n' })
    const r = esperadoDeCartera({ clientes: [{ id: 'c', diasSinCobro: null, ruta: null, prestamos: [oscar, rosalba, normal] }], org: null, festivos: [] }, new Date())
    expect(r.esperado).toBe((CUOTA - 10_000) + CUOTA)
  })
})

describe('las pantallas usan esta cuenta y no otra', () => {
  const SITIOS = {
    'app/api/dashboard/resumen/route.js': /loDeHoyDelPrestamo\(/,
    'app/api/rutas/route.js': /tocaDeHoy\(/,
    'app/api/rutas/[id]/route.js': /tocaDeHoy\(/,
    'app/api/cobros-hoy/route.js': /tocaDeHoy\(/,
    'app/api/mis-estadisticas/route.js': /loDeHoyDelPrestamo\(/,
    'app/api/cobradores/route.js': /loDeHoyDelPrestamo\(/,
    'app/api/offline/sync/route.js': /loDeHoyDelPrestamo\(/,
    'lib/asistente-cifras.js': /loDeHoyDelPrestamo\(/,
  }
  for (const [f, re] of Object.entries(SITIOS)) {
    it(f, () => {
      const src = sinComentarios(leer(f))
      expect(src).toMatch(re)
      // La suma suelta de la cuota entera ya no decide lo de hoy.
      expect(src).not.toMatch(/esperadoHoy(Total)?\s*\+=\s*p\.cuotaDiaria/)
    })
  }

  it('la caja (las cuatro consultas) trae los pagos de hoy de cada préstamo', () => {
    for (const f of ['app/api/caja/route.js', 'app/api/caja/cierre-auto/route.js', 'app/api/caja/cuadre/route.js', 'lib/caja/stats-dia.js']) {
      expect(sinComentarios(leer(f)), f).toMatch(/selectPrestamoDelDia\(\)/)
    }
  })

  it('el Inicio cuenta cobrado a quien ya no le falta nada, no a quien abonó algo', () => {
    const src = sinComentarios(leer('app/api/dashboard/resumen/route.js'))
    expect(src).toContain('if ((faltaPorCliente.get(id) ?? 0) <= 0) clientesCobradosHoy += 1')
    expect(src).not.toMatch(/pagaronHoy/)
  })

  it('el hero del Inicio mide el avance con lo que falta', () => {
    expect(leer('lib/adaptadores/panel.js')).toMatch(/avanceDeHoy\(\{ esperadoHoy: esperado, faltaHoy: faltaServidor/)
  })

  it('sin señal, `totalPagado` es el de la base y no la suma de 90 días', () => {
    expect(leer('app/api/offline/sync/route.js')).toMatch(/totalPagado: typeof p\.totalPagado === 'number'\s*\? p\.totalPagado/)
  })
})

describe('el porcentaje es el mismo en todas', () => {
  /* La mañana de Rosalba ya cobrada: tocan $30.000, le faltan $20.000 a otro, y
     alguien pagó $25.000 de su mora. Cobrado ÷ esperado diría 83 %; lo cubierto
     de lo que toca es 33 %, y eso es lo que dice la tarjeta de arriba. */
  const dia = { esperadoHoy: 30_000, faltaHoy: 20_000, recaudadoHoy: 25_000 }
  const avance = avanceDeHoy(dia)

  it('la tarjeta de arriba', () => expect(avance).toBe(33))
  it('la ficha de cada ruta', () => expect(porcentajeDelDia(dia.recaudadoHoy, dia.esperadoHoy, dia.faltaHoy)).toBe(avance))
  it('la Efectividad de Cobradores', () => expect(efectividadDe(dia.recaudadoHoy, dia.esperadoHoy, dia.faltaHoy)).toBe(avance))
  it('el panel del Inicio en PC, el día y cada ruta', () => {
    const pd = adaptarPanelDinero({ prestamos: { esperadoHoy: 30_000, faltaHoy: 20_000 }, cobros: { hoy: 25_000 } }, [{ id: 'r', nombre: 'Centro', ...dia }])
    expect(pd.hoy.pct).toBe(avance)
    expect(pd.rutas[0].pct).toBe(avance)
  })
  it('«Falta poco» dice lo que falta, no la resta', () => {
    const t = generarNarrativa({ recaudadoHoy: 100_000, recaudadoAyer: 1, esperadoHoy: 100_000, faltaHoy: 20_000, formatear: String })
    expect(t).toBe('Falta poco: 20000 para tu meta')
  })
  it('sin `faltaHoy` (una respuesta vieja) sigue la resta de siempre', () => {
    expect(porcentajeDelDia(25_000, 30_000)).toBe(83)
    expect(efectividadDe(25_000, 30_000)).toBe(83)
  })
  it('sin nada que cobrar no hay porcentaje', () => {
    expect(efectividadDe(5_000, 0, 0)).toBe(null)
    expect(porcentajeDelDia(5_000, 0, 0)).toBe(0)
  })
})

describe('los clientes sin ruta, con su nombre', () => {
  /* Negocio de la grabación, 19 oct: Inicio «de $296.400», Rutas $281.900. Los
     $14.500 son un cliente sin ruta: estaba en el total y en ninguna fila. */
  const rutas = [
    { id: 'a', nombre: 'Ruta Centro', esperadoHoy: 161_900, faltaHoy: 161_900, recaudadoHoy: 0 },
    { id: 'b', nombre: 'Zona Norte', esperadoHoy: 120_000, faltaHoy: 120_000, recaudadoHoy: 0 },
  ]
  const sinRuta = { esperadoHoy: 14_500, faltaHoy: 14_500, recaudadoHoy: 0, clientes: 1 }

  it('«Por ruta hoy» suma lo mismo que el total de arriba', () => {
    const b = porRutaHoy(rutas, 'CO', sinRuta)
    expect(b.meta).toMatch(/296\.400/)
    expect(b.rutas.map((r) => r.nombre)).toContain('Sin ruta')
    expect(b.rutas.find((r) => r.nombre === 'Sin ruta').id).toBe(null)
  })
  it('sin clientes sin ruta, nada cambia', () => {
    expect(porRutaHoy(rutas, 'CO', { esperadoHoy: 0 }).meta).toMatch(/281\.900/)
    expect(porRutaHoy(rutas, 'CO').rutas).toHaveLength(2)
  })
  it('un negocio sin rutas no recibe una fila «Sin ruta» sola', () => {
    expect(porRutaHoy([], 'CO', sinRuta).rutas).toHaveLength(0)
  })
  it('la ficha «Sin ruta» de Rutas dice cuánto les toca hoy', () => {
    expect(adaptarSinRuta({ totalSinRuta: 1, tocaHoySinRuta: 14_500 }, 'CO').monto).toMatch(/^hoy toca \$\s?14\.500$/)
    expect(adaptarSinRuta({ totalSinRuta: 1, tocaHoySinRuta: 0 }, 'CO').monto).toBe(null)
  })
  it('el servidor separa lo de hoy sin ruta activa, solo para quien ve todo', () => {
    const src = sinComentarios(leer('app/api/dashboard/resumen/route.js'))
    expect(src).toMatch(/const sinRutaActiva = !esCobrador && !\(p\.cliente\?\.ruta\?\.id && p\.cliente\.ruta\.activo !== false\)/)
    expect(src).toMatch(/ruta: \{ select: \{ id: true, nombre: true, diasSinCobro: true, activo: true \} \}/)
    expect(sinComentarios(leer('app/(dashboard)/dashboard/page.jsx'))).toContain('porRutaHoy(rutasData, session?.user?.country, data?.prestamos?.sinRutaHoy)')
    expect(sinComentarios(leer('app/api/rutas/recomendaciones/route.js'))).toMatch(/loDeHoyDelPrestamo\(/)
  })
})
