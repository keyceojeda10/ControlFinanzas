/* LA TANDA DEL 19 OCT (día de grabación con cf-v1177): DETALLES-CAJA #29-#34,
 * DETALLES-RUTAS #72-#77, DETALLES-COBRADORES #1-#4 y DETALLES-CARTERA #8. */
import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fraseDeLoQueQueda } from '@/lib/caja/queda-en-la-ruta'
import { agruparCajaPorRuta } from '@/lib/adaptadores/caja-por-ruta'
import { numeroDeCuotas, tablaDe } from '@/lib/dinero/tabla'
import { calcularDiasMora, calcularMontoEnMora } from '@/lib/calculos'
import { filtrarPrestamosGuardados } from '@/lib/adaptadores/filtro-prestamos'
import { filaDeCobro } from '@/lib/adaptadores/cobros'
import { paradasDeRuta } from '@/lib/adaptadores/ruta'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

describe('Caja #30 · «Le queda en la ruta» solo con capital propio, y con sus sumandos', () => {
  it('el servidor no la manda si alguna ruta no lleva capital propio', () => {
    const api = sinComentarios(leer('app/api/caja/cobrador/[id]/route.js'))
    expect(api).toMatch(/const todasConCapitalPropio = rutas\.length > 0 && rutas\.every\(\(r\) => r\.capitalHabilitado\)/)
    expect(api).toMatch(/if \(!todasConCapitalPropio\) \{\s*cuentaRuta\.quedaEnLaRuta = null/)
  })
  it('los sumandos dan la cifra exacta: lo que no cuadra se nombra', () => {
    const api = sinComentarios(leer('app/api/caja/cobrador/[id]/route.js'))
    expect(api).toMatch(/const resto = cuentaRuta\.quedaEnLaRuta - sumandos\.reduce/)
    expect(api).toMatch(/if \(resto !== 0\) sumandos\.push\(\{ id: 'otros', monto: resto \}\)/)
  })
  it('la frase dice cada sumando con su nombre y su signo', () => {
    expect(fraseDeLoQueQueda([
      { id: 'entregar', monto: 49700 }, { id: 'base', monto: 300000 }, { id: 'cuenta', monto: 14200 }, { id: 'prestadoDigital', monto: -50000 },
    ], fmt)).toBe('Lo de entregar ($49.700) más la base de la ruta, que se queda con él ($300.000) más lo que entró a la cuenta (no lo trae en billetes) ($14.200) menos lo que prestó por transferencia ($50.000).')
    expect(fraseDeLoQueQueda([{ id: 'entregar', monto: -124800 }, { id: 'cuenta', monto: 14200 }], fmt))
      .toBe('Lo que hay que reponerle (−$124.800) más lo que entró a la cuenta (no lo trae en billetes) ($14.200).')
    // Sin nada más que lo de entregar no hay nada que explicar.
    expect(fraseDeLoQueQueda([{ id: 'entregar', monto: 49700 }], fmt)).toBe('')
  })
  it('la pantalla: el bloque solo con cifra, y «Disponible» solo con capital propio', () => {
    const ui = sinComentarios(leer('components/caja/CajaCobradorDetalle.jsx'))
    expect(ui).toContain('{cr.quedaEnLaRuta != null && (cr.explicacionQuedaEnLaRuta?.length ?? 0) > 1 && (')
    expect(ui).toContain('{fraseDeLoQueQueda(cr.explicacionQuedaEnLaRuta, formatMoney)}')
    expect(ui).toContain('{ruta.rutaId && ruta.capitalHabilitado && (')
  })
})

describe('Caja #29 · «N de M cobros» de Por ruta cuenta como Rutas', () => {
  const pagos = [
    { rutaId: 'r1', rutaNombre: 'Centro', clienteId: 'a', montoPagado: 20000, metodoPago: 'efectivo' },
    { rutaId: 'r1', rutaNombre: 'Centro', clienteId: 'b', montoPagado: 32000, metodoPago: 'efectivo' },
  ]
  const rutas = [{ id: 'r1', nombre: 'Centro', cobrosHoy: 8, cobradosHoy: 1, esperadoHoy: 100000 }]
  it('con /api/rutas de hoy, el numerador es el del servidor (un abono no es cobrado)', () => {
    const [f] = agruparCajaPorRuta(pagos, rutas)
    expect(f.subtitulo).toContain('1 de 8 cobros')
  })
  it('otro día no cruza los pagos de ese día con los cobros de hoy', () => {
    const [f] = agruparCajaPorRuta(pagos, rutas, undefined, [], null, null, { esHoy: false })
    expect(f.subtitulo).not.toMatch(/de 8/)
    expect(f.esperado).toBe(null)
  })
  it('la caja manda `cobradosHoy` y dice si el día escogido es hoy', () => {
    const src = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    expect((src.match(/cobrosHoy: r\.cobrosHoy, cobradosHoy: r\.cobradosHoy/g) ?? []).length).toBe(2)
    expect(src).toContain('{ esHoy: fechaSeleccionada === getColombiaDateStr() },')
  })
})

describe('Caja #32-#34 · los textos', () => {
  it('#32 el Coteo sin abonos no habla de una renovación que no hubo', () => {
    expect(leer('components/caja/CajaCobradorDetalle.jsx')).toContain("'Nadie abonó al renovar: es lo que cobró'")
    expect(leer('app/(dashboard)/caja/page.jsx')).toContain("'Nadie abonó al renovar: es lo que cobró'")
  })
  it('#33 dice cuánto falta o sobra, con tilde', () => {
    const src = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    expect(src).toContain('`Faltan ${formatMoney(recaudadoRegistrado - Number(totalRecogido))} para lo que dice la app (${formatMoney(recaudadoRegistrado)}).`')
    expect(src).toContain('`Sobran ${formatMoney(Number(totalRecogido) - recaudadoRegistrado)} sobre lo que dice la app (${formatMoney(recaudadoRegistrado)}).`')
    expect(src).not.toMatch(/continua\./)
  })
  it('#34 «no coinciden» solo para quien ya entregó', () => {
    const src = sinComentarios(leer('components/caja/CuadreDia.jsx'))
    expect(src).toContain('const sinEntregar = pendientesFilas.filter((f) => f.entregadoReportado == null).length')
    expect(src).toMatch(/todavía no entrega/)
    expect(src).not.toMatch(/no coincide\{/)
  })
})

describe('Cartera #8 · «De una vez» con varias cuotas tiene su vencido', () => {
  // Luz Marina: 8 oct, diario, $9.600 × 25, 8 abonadas. El 19 oct, 2 vencidas.
  const luz = {
    id: 'x', estado: 'activo', modoInteres: 'unico', frecuencia: 'diario', montoPrestado: 200000, tasaInteres: 20,
    totalAPagar: 240000, cuotaDiaria: 9600, diasPlazo: 25, fechaInicio: new Date('2026-10-08T17:00:00Z'),
    totalPagado: 76800, abonadoCapital: 0, pagos: [], cuotasAmortizacion: [], devengos: [], sinPlazo: false,
  }
  it('las cuotas son total ÷ cuota; el de un solo pago sigue siendo uno', () => {
    expect(numeroDeCuotas(luz)).toBe(25)
    expect(numeroDeCuotas({ ...luz, cuotaDiaria: 240000 })).toBe(1)
    expect(numeroDeCuotas({ ...luz, cuotaDiaria: 0 })).toBe(1)
    expect(tablaDe(luz)).toHaveLength(25)
  })
  it('lo vencido son las cuotas que dicen los días de atraso', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T15:00:00Z'))
    try {
      expect(calcularDiasMora(luz, [])).toBe(2)
      expect(calcularMontoEnMora(luz, [])).toBe(19200)
      // Con el domingo libre va al día, y lo vencido también lo dice.
      expect(calcularDiasMora(luz, [0])).toBe(0)
      expect(calcularMontoEnMora(luz, [0])).toBe(0)
    } finally { vi.useRealTimers() }
  })
})

describe('Rutas #73 · «Atraso» de la ficha sin la cuota de hoy', () => {
  it('es lo vencido (la cifra de la ruta por dentro), con lo que lee la tabla derivada', () => {
    const src = sinComentarios(leer('app/api/rutas/route.js'))
    expect(src).toContain('atrasoRuta += calcularMontoEnMora(prestamo, diasExcluidos, festivos)')
    expect(src).not.toContain('atrasoRuta += calcularMontoParaPonerseAlDia(')
    expect(src).toMatch(/fechaFin: true/)
  })
})

describe('Rutas #72 · «Mañana» es a quién le toca mañana', () => {
  const inicioHoy = new Date('2026-10-19T05:00:00Z')
  const dia = (d) => new Date(inicioHoy.getTime() + d * 86400000)
  const lista = [
    { id: 'sinPagar', estado: 'activo', diasMora: 0, proximoCobro: dia(0), cobraEn: [0, 1, 2, 3] },
    { id: 'yaPago', estado: 'activo', diasMora: 0, proximoCobro: dia(1), cobraEn: [0, 1, 2, 3] },
    { id: 'atrasado', estado: 'activo', diasMora: 6, proximoCobro: dia(-6), cobraEn: [0, 1, 2, 3] },
    { id: 'oscar', estado: 'activo', diasMora: 0, proximoCobro: dia(8), cobraEn: [0, 1, 2, 3] },
    { id: 'semanal', estado: 'activo', diasMora: 0, proximoCobro: dia(3), cobraEn: [3] },
    { id: 'clavo', estado: 'activo', esClavo: true, diasMora: 0, proximoCobro: dia(0), cobraEn: [0, 1, 2, 3] },
  ]
  it('sin conexión: el que no ha pagado, el que pagó y el atrasado; no el cubierto ni el semanal', () => {
    const ids = filtrarPrestamosGuardados(lista, { est: 'venceManana', inicioHoy }).map((p) => p.id).sort()
    expect(ids).toEqual(['atrasado', 'sinPagar', 'yaPago'])
  })
  it('el semanal sale el día que le toca', () => {
    expect(filtrarPrestamosGuardados(lista, { est: 'vence3', inicioHoy }).map((p) => p.id)).toContain('semanal')
  })
  it('sin `cobraEn` (copia vieja) sigue la regla de antes', () => {
    const viejos = lista.map(({ cobraEn, ...p }) => p)
    expect(filtrarPrestamosGuardados(viejos, { est: 'venceManana', inicioHoy }).map((p) => p.id)).toEqual(['yaPago'])
  })
  it('el servidor manda `cobraEn` y lo usa con la misma regla', () => {
    const src = sinComentarios(leer('app/api/prestamos/route.js'))
    expect(src).toContain('cobraEn:          [0, 1, 2, 3].filter((d) => tocaCobrarEn(p, new Date(Date.now() + d * 86400000), diasExcluidos, festivos)),')
    expect(src).toContain('return !p.esClavo && p.cobraEn.includes(ventanaDesde) && dias <= ventanaDesde')
  })
})

describe('Rutas #74-#77 · Cobros de hoy cobra con la hoja de la ruta', () => {
  it('la página usa AtajosCobro y ya no el modal propio', () => {
    const src = sinComentarios(leer('app/(dashboard)/cobros-hoy/page.jsx'))
    expect(src).toContain('<AtajosCobro')
    expect(src).not.toMatch(/monto > modalPago\.cuota/)
    expect(src).not.toMatch(/Elige cual cobrar|Registrar 1 cuota para|aún debe mas/)
    // La cuota exacta es completa; cualquier otra cifra, un abono por esa cifra.
    expect(src).toContain("const tipoPago = montoFinal === (cuotaOriginal ?? cuota) ? 'completo' : 'parcial'")
    // Lo que el modal viejo avisaba no se pierde.
    expect(src).toMatch(/pr\.esBalloon \? 'Es la última cuota/)
    expect(src).toMatch(/pr\.cuotaExtraHoy && Number\(pr\.montoCuotaExtra\) > 0/)
    expect(src).toContain('onNoPago={(pr, motivo) => registrarNoPago(pr.id, motivo)}')
  })
  it('el API manda lo que la hoja necesita, también del clavo', () => {
    const src = sinComentarios(leer('app/api/cobros-hoy/route.js'))
    expect((src.match(/montoParaPonerseAlDia: /g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((src.match(/pagadoHoy: montoPagadoHoy > 0,/g) ?? []).length).toBe(2)
  })
  it('#76 el «Otro monto» de la hoja lleva el punto de los miles', () => {
    expect(sinComentarios(leer('components/pantallas/AtajosCobro.jsx'))).toContain('value={montoParaMostrar(monto, pais)}')
  })
})

describe('Cobradores #1-#4 · el ranking sale de los cobros', () => {
  const src = sinComentarios(leer('app/api/reportes/scorecard/route.js'))
  it('recaudado y días trabajados de sus pagos, no de los cierres', () => {
    expect(src).toContain('const totalRecaudado = Math.round(misPagos.reduce((a, p) => a + (Number(p.montoPagado) || 0), 0))')
    expect(src).toContain('const diasTrabajados = diasConPago.size')
    expect(src).not.toMatch(/misCierres\.reduce\(\(a, c\) => a \+ \(c\.totalRecogido/)
  })
  it('los 30 días llegan hasta el final de hoy', () => {
    expect(src).toContain('fechaPago: { gte: desde, lt: finHoy },')
    expect(src).not.toMatch(/fechaPago: \{ gte: desde, lte: hasta \}/)
  })
  it('eficiencia: de lo que tocaba cada día, cuánto se cobró, con tope por día', () => {
    expect(src).toContain('cubierto += Math.min(tocaba, cobradoPorRutaDia.get(')
  })
  it('#2 la mora con la consulta compartida y los días sin cobro del préstamo', () => {
    expect(src).toContain('select: { ...selectPrestamoDelDia(), clienteId: true, ultimoPagoAt: true },')
    expect(src).toContain('calcularDiasMora(p, obtenerDiasSinCobro(cliente, ruta, org, p), festivos)')
  })
  it('#3 y #4: primer cobro en 12 horas y porcentajes con coma', () => {
    expect(src).toMatch(/\$\{h24 < 12 \? 'a\. m\.' : 'p\. m\.'\}/)
    const ui = sinComentarios(leer('app/(dashboard)/cobradores/ranking/page.jsx'))
    expect(ui).toContain('label="Primer cobro del día"')
    expect(ui).toContain("`${Number(m.pagosConGps ?? 0).toFixed(1).replace('.', ',')}%`")
  })
})

describe('«Clavo», la palabra del prestamista (Carlos, 19 oct 2026)', () => {
  it('el aviso de la hoja de cobro dice «marcado como clavo»', () => {
    const f = filaDeCobro({ id: 'c', nombre: 'X', tieneClavo: true })
    expect(f.avisos.map((a) => a.texto)).toContain('Tiene un préstamo marcado como clavo')
  })
  it('en la ruta, el que solo tiene el clavo no repite el aviso (lo dice su pastilla)', () => {
    const { filas: [p] } = paradasDeRuta([{ id: 'c', nombre: 'X', tieneClavo: true, cobroPendienteHoy: false, saldoTotal: 900000, prestamosActivos: [{ id: 'x', esClavo: true, saldoPendiente: 900000 }] }])
    expect(p.zona).toBe('clavo')
    expect((p.avisos ?? []).some((a) => /clavo/i.test(a.texto))).toBe(false)
  })
  it('las pantallas ya no dicen «perdido» del clavo', () => {
    const textos = [
      'lib/adaptadores/ruta.js', 'lib/adaptadores/cobros.js', 'components/cf/primitivos.jsx',
      'app/(dashboard)/clavos/page.jsx', 'app/(dashboard)/prestamos/[id]/page.jsx', 'components/pantallas/Gestion.jsx',
      'components/layout/BottomNav.jsx', 'components/armazon/BarraLateral.jsx', 'components/layout/Sidebar.jsx',
      'components/pantallas/PantallaMas.jsx', 'app/(dashboard)/prestamos/page.jsx', 'app/(dashboard)/clientes/page.jsx',
    ].map((f) => sinComentarios(leer(f))).join('\n')
    expect(textos).not.toMatch(/'Perdidos'|'Préstamos perdidos'|>Perdido<|dado por perdido|Mover a perdidos|Sacar de perdidos|Dar por perdido|Darlo por perdido|Seguir cobrando/)
  })
})
