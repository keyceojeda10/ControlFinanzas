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
import { paradasDeRuta, cierreYaHecho, diferenciaDelCierre } from '@/lib/adaptadores/ruta'
import { causasDeDescuadre } from '@/lib/adaptadores/cuadre'
import { textoDeFila } from '@/lib/adaptadores/actividad'
import { filasDeMovimientos, descripcionDeMovimiento, descripcionDeCuadre, descripcionConNotaNueva } from '@/lib/adaptadores/movimientos-capital'

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

describe('Caja #35-#39 (19 oct, tarde)', () => {
  it('#35 un día pasado cierra en SU saldo: el de hoy menos lo que se movió después', () => {
    const src = sinComentarios(leer('lib/caja/stats-dia.js'))
    expect(src).toContain('where: { organizationId, createdAt: { gte: fin } },')
    expect(src).toContain('saldoCapitalActual = Number(cap.saldo || 0) - loQueSeMovio(despues)')
  })
  it('#36 sin capital propio la plata vuelve al capital del negocio', () => {
    const ui = sinComentarios(leer('components/caja/CajaCobradorDetalle.jsx'))
    expect(ui).toContain("`Volvió al capital ${cr.quedaEnLaRuta != null ? 'de la ruta' : 'del negocio'}`")
  })
  it('#38 al confirmar se parte de lo que el cobrador entregó, y se dice', () => {
    const ui = sinComentarios(leer('components/caja/CuadreDia.jsx'))
    expect(ui).toContain('setMontoRecibido(String(fila.efectivoRecibido ?? fila.entregadoReportado ?? fila.recaudadoSistema ?? 0))')
    expect(ui).toMatch(/\{modal\.nombre\} dice que entrega \{formatMoney\(modal\.entregadoReportado\)\}/)
    expect(ui).toContain("f.efectivoRecibido == null && f.entregadoReportado != null ? 'Entregó' : 'Recibido'")
    expect(causasDeDescuadre('falta').map((c) => c.titulo)).toContain('Lo trae mañana')
  })
  it('#39 la meta de la dueña cuenta a los que cobra ella: sin ruta y rutas sin cobrador', () => {
    const src = sinComentarios(leer('lib/caja/stats-dia.js'))
    expect(src).toContain("? { OR: [{ rutaId: null }, { ruta: { activo: true, OR: [{ cobradorId }, { cobradorId: null }] } }] }")
  })
  it('#37 y #40 las tildes', () => {
    expect(leer('app/(dashboard)/caja/page.jsx')).toContain("'Guardar corrección'")
    expect(leer('components/layout/CompletarTelefonoModal.jsx')).toContain('Recordar más tarde')
  })
})

describe('Capital de una ruta y el Historial (19 oct, noche)', () => {
  it('#9 la tanda no lleva artículo: «confirmó 2 cuadres en un minuto»', () => {
    expect(textoDeFila({ cuantos: 2, accion: 'confirmar_cuadre', duracionTexto: 'en un minuto' }, 'Confirmó el cuadre')).toBe('confirmó 2 cuadres en un minuto')
    expect(textoDeFila({ cuantos: 3, accion: 'registrar_pago', duracionTexto: 'en 4 minutos' }, 'Registró pago')).toBe('registró 3 pagos en 4 minutos')
  })
  it('#43 el desglose de una ruta que empezó desde cero cuenta desde la marca', () => {
    const src = sinComentarios(leer('lib/capital.js'))
    expect(src).toContain('const desdeSiempre = movs.filter((m) => !puestasEnCero.has(m.rutaId))')
    expect(src).toContain('for (const m of [...desdeSiempre, ...desglosados]) {')
  })
  it('#44 la ruta por dentro dice su capital si lo lleva', () => {
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toContain('capital={ruta.capitalHabilitado ? formatMoney(ruta.saldoCapital ?? 0) : null} />')
    expect(leer('components/pantallas/DetalleRuta.jsx')).toContain('Capital de la ruta · disponible para prestar')
  })
  it('#45 la pareja de la puesta en cero va en una sola fila, en cero', () => {
    const t = '2026-10-19T19:10:00.000Z'
    const filas = filasDeMovimientos([
      { id: '1', tipo: 'ajuste', referenciaTipo: 'ruta', monto: 333200, createdAt: t, descripcion: 'Capital propio: lo que Zona Norte movía con la plata del negocio queda en el negocio' },
      { id: '2', tipo: 'ajuste', referenciaTipo: 'ruta', monto: 333200, createdAt: t, descripcion: 'Capital propio: Zona Norte empieza su capital propio' },
      { id: '3', tipo: 'inyeccion', monto: 1000000, createdAt: t, descripcion: 'Plata para Zona Norte' },
    ])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ enCero: true, monto: 0, descripcion: 'Zona Norte empieza su capital propio · no cambia tu capital' })
    expect(filas[1].id).toBe('3')
  })
  it('#45 el cuadre, en palabras: los viejos al pintarse y los nuevos desde el origen', () => {
    expect(descripcionDeMovimiento({ descripcion: 'Cuadre de caja Camilo Ortiz (2026-10-19): faltante - Lo trae mañana' }))
      .toMatch(/^Faltante en el cuadre de Camilo Ortiz \(19 (de )?oct\.?\) · Lo trae mañana$/)
    expect(descripcionDeMovimiento({ descripcion: 'Gasto: Gasolina' })).toBe('Gasto: Gasolina')
    // El origen escribe con el mismo constructor que lee los viejos.
    expect(descripcionDeCuadre({ titulo: 'Faltante', nombre: 'Camilo Ortiz', fecha: '2026-10-19', nota: 'Lo trae mañana' }))
      .toMatch(/^Faltante en el cuadre de Camilo Ortiz \(19 (de )?oct\.?\) · Lo trae mañana$/)
    const api = sinComentarios(leer('app/api/caja/cuadre/route.js'))
    expect(api).toMatch(/descripcion: descripcionDeCuadre\(\{\s*titulo: yaAsentado !== 0 \? 'Corrección del cuadre' : \(falta < 0 \? 'Faltante' : 'Sobrante'\),\s*nombre: cobrador\.nombre, fecha, nota: item\.nota,/)
  })
  it('#42 «Ver detalle» compara lo entregado con lo que tenía en la mano', () => {
    const src = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    // Desde el #78 la resta es `diferenciaDelCierre`: cuadrado, manda lo que contó el dueño.
    expect(src).toContain('const { tenia, entrego, dif } = diferenciaDelCierre(cierre)')
    expect(src).toMatch(/Tenía en la mano \{formatMoney\(tenia\)\} · entregó \{formatMoney\(entrego\)\}/)
    expect(src).not.toMatch(/diferencia vs cierre/)
  })

  // ── #46 · La fila en cero lleva el saldo de DESPUÉS de los dos asientos ──
  // Cifras del espejo (Zona Norte, 19 oct): 5.400.467 → 5.067.267 → 5.400.467.
  const empieza = { id: 'l9', tipo: 'ajuste', referenciaTipo: 'ruta', monto: 333200, saldoAnterior: 5400467, saldoNuevo: 5067267, descripcion: 'Capital propio: Zona Norte empieza su capital propio' }
  const queda = { id: '8s', tipo: 'ajuste', referenciaTipo: 'ruta', monto: 333200, saldoAnterior: 5067267, saldoNuevo: 5400467, descripcion: 'Capital propio: lo que Zona Norte movía con la plata del negocio queda en el negocio' }
  const cuadre = { id: 'gy', tipo: 'ajuste', referenciaTipo: 'cierre_cuadre', monto: 7800, saldoAnterior: 5408267, saldoNuevo: 5400467, createdAt: '2026-10-19T18:35:39.057Z', descripcion: 'Faltante en el cuadre de Camilo Ortiz (19 oct)' }
  it('#46 con horas distintas: el saldo es el del último asiento, el de la fila anterior', () => {
    const filas = filasDeMovimientos([
      { ...queda, createdAt: '2026-10-19T19:01:31.364Z' },
      { ...empieza, createdAt: '2026-10-19T19:01:29.815Z' },
      cuadre,
    ])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ enCero: true, monto: 0, saldoAnterior: 5400467, saldoNuevo: 5400467 })
    expect(filas[0].saldoNuevo).toBe(filas[1].saldoNuevo)
  })
  it('#46 con la misma hora: el último es el que se escribió encima del otro, en cualquier orden', () => {
    const t = '2026-10-19T19:10:00.000Z'
    for (const par of [[{ ...empieza, createdAt: t }, { ...queda, createdAt: t }], [{ ...queda, createdAt: t }, { ...empieza, createdAt: t }]]) {
      const [fila] = filasDeMovimientos(par)
      expect(fila).toMatchObject({ enCero: true, saldoAnterior: 5400467, saldoNuevo: 5400467 })
    }
    // Ruta con la cuenta en negativo: los signos al revés, la misma regla.
    const e2 = { ...empieza, createdAt: t, saldoAnterior: 1000000, saldoNuevo: 1200000 }
    const q2 = { ...queda, createdAt: t, saldoAnterior: 1200000, saldoNuevo: 1000000 }
    expect(filasDeMovimientos([e2, q2])[0].saldoNuevo).toBe(1000000)
  })

  // ── #47 · Editar el cuadre cambia la nota también en Capital ──
  it('#47 la nota nueva entra en cada asiento sin cambiar lo que fue cada uno', () => {
    const datos = { nombre: 'Camilo Ortiz', fecha: '2026-10-19', nota: 'Lo trae mañana, con la ruta' }
    const falto = { saldoAnterior: 5408267, saldoNuevo: 5400467, descripcion: 'Faltante en el cuadre de Camilo Ortiz (19 oct) · Lo trae mañanaLos trae mañana con la ruta' }
    expect(descripcionConNotaNueva(falto, datos)).toMatch(/^Faltante en el cuadre de Camilo Ortiz \(19 (de )?oct\.?\) · Lo trae mañana, con la ruta$/)
    // El del formato viejo, el de la grabación del espejo.
    const viejo = { ...falto, descripcion: 'Cuadre de caja Camilo Ortiz (2026-10-19): faltante - Lo trae mañanaLos trae mañana con la ruta' }
    expect(descripcionConNotaNueva(viejo, datos)).toBe(descripcionConNotaNueva(falto, datos))
    const correccion = { saldoAnterior: 5400467, saldoNuevo: 5405467, descripcion: 'Corrección del cuadre en el cuadre de Camilo Ortiz (19 oct) · Error al contar' }
    expect(descripcionConNotaNueva(correccion, datos)).toMatch(/^Corrección del cuadre en el cuadre de Camilo Ortiz .* · Lo trae mañana, con la ruta$/)
    const sobro = { saldoAnterior: 100, saldoNuevo: 5100, descripcion: 'Sobrante en el cuadre de Camilo Ortiz (19 oct)' }
    expect(descripcionConNotaNueva(sobro, { ...datos, nota: '' })).toMatch(/^Sobrante en el cuadre de Camilo Ortiz \(19 (de )?oct\.?\)$/)
  })
  it('#47 el cuadre reescribe el texto de los asientos del cierre dentro de la misma transacción, antes del importe', () => {
    const api = sinComentarios(leer('app/api/caja/cuadre/route.js'))
    const tx = api.slice(api.indexOf('await prisma.$transaction(async (tx) => {'))
    expect(tx).toMatch(/select: \{ id: true, monto: true, saldoAnterior: true, saldoNuevo: true, descripcion: true \}/)
    const escribe = tx.indexOf('await tx.movimientoCapital.update({ where: { id: m.id }, data: { descripcion } })')
    expect(escribe).toBeGreaterThan(0)
    expect(tx.indexOf('descripcionConNotaNueva(m, { nombre: cobrador.nombre, fecha, nota: item.nota })')).toBeLessThan(escribe)
    // Antes de `if (falta === 0) return`: si no, editar SOLO la nota no la cambiaba.
    expect(escribe).toBeLessThan(tx.indexOf('if (falta === 0) return'))
    expect(escribe).toBeLessThan(tx.indexOf('await registrarMovimientoCapital(tx, {'))
    // La cuenta del importe sigue siendo la de siempre.
    expect(tx).toContain('const falta = diferenciaRecibido - yaAsentado')
  })
})

describe('DETALLES-RUTAS #78 · El cierre en la ruta: lo que tenía que entregar contra lo que entregó', () => {
  const cifras = fmt
  // Cifras del espejo, 19 oct.
  const andres = { totalEsperado: 161900, totalRecogido: 63500, diferencia: -98400, enLaManoSistema: 63500, efectivoRecibido: 63500, diferenciaRecibido: 0, confirmadoEn: '2026-10-19T18:34:54.483Z' }
  const camilo = { totalEsperado: 120000, totalRecogido: 60000, diferencia: -60000, enLaManoSistema: 67800, efectivoRecibido: 60000, diferenciaRecibido: -7800, confirmadoEn: '2026-10-19T18:52:50.070Z' }
  it('Ruta Centro: Andrés cuadró al peso, no «−$98.400»', () => {
    const c = cierreYaHecho(andres, { nombre: 'Andrés Vargas', esCobrador: true, rutas: ['Ruta Centro'], estaRuta: true }, cifras)
    expect(c.lineas).toEqual([
      { id: 'tenia', texto: 'Tenía que entregar', valor: '$63.500' },
      { id: 'entrego', texto: 'Entregó', valor: '$63.500' },
    ])
    expect(c.resultado).toMatchObject({ texto: 'Cuadró', tono: 'cuadro' })
    expect(c.frase).toBe('Tenía que entregar $63.500 · Entregó $63.500 · Cuadró')
    expect(c.deQuien).toBe('Es la caja de Andrés Vargas.')
    expect(JSON.stringify(c)).not.toContain('98.400')
  })
  it('Zona Norte: faltaron $7.800, no «−$60.000»', () => {
    const c = cierreYaHecho(camilo, { nombre: 'Camilo Ortiz', esCobrador: true, rutas: ['Zona Norte'], estaRuta: true }, cifras)
    expect(c.resultado).toMatchObject({ texto: 'Faltaron', valor: '$7.800', tono: 'falta' })
    expect(c.frase).toBe('Tenía que entregar $67.800 · Entregó $60.000 · Faltaron $7.800')
    expect(c.corto).toBe('entregó $60.000')
    // Sin cuadrar: lo que dijo al cerrar contra lo que tenía en la mano.
    const sinCuadrar = { ...camilo, confirmadoEn: null, efectivoRecibido: null, diferenciaRecibido: null }
    expect(cierreYaHecho(sinCuadrar, {}, cifras).frase).toBe('Tenía que entregar $67.800 · Entregó $60.000 · Faltaron $7.800')
    expect(cierreYaHecho({ ...sinCuadrar, totalRecogido: 70000 }, {}, cifras).resultado).toMatchObject({ texto: 'Sobraron', valor: '$2.200', tono: 'sobra' })
  })
  it('cuadrado, lo entregado es lo que el dueño CONTÓ y la diferencia es la del cuadre', () => {
    // El dueño cierra por el cobrador: `totalRecogido` es la cifra del sistema.
    const cerroElDueno = { totalRecogido: 20000, enLaManoSistema: 20000, efectivoRecibido: 18000, diferenciaRecibido: -2000, confirmadoEn: '2026-10-19T20:00:00Z' }
    expect(cierreYaHecho(cerroElDueno, {}, cifras).frase).toBe('Tenía que entregar $20.000 · Entregó $18.000 · Faltaron $2.000')
    // Con `capitalEsEfectivo` el cuadre coteja la bolsa entera: su misma referencia.
    const bolsa = { totalRecogido: 63500, enLaManoSistema: 63500, efectivoRecibido: 2000000, diferenciaRecibido: -15000, confirmadoEn: '2026-10-19T20:00:00Z' }
    expect(cierreYaHecho(bolsa, {}, cifras).frase).toBe('Tenía que entregar $2.015.000 · Entregó $2.000.000 · Faltaron $15.000')
  })
  it('una ruta de un cobrador con varias dice que la caja es una sola y de quién', () => {
    const c = cierreYaHecho(andres, { nombre: 'Andrés Vargas', esCobrador: true, rutas: ['Ruta Centro', 'Ruta Sur'], estaRuta: true }, cifras)
    expect(c.deQuien).toBe('Es la caja de Andrés Vargas: una sola para sus 2 rutas, Ruta Centro y Ruta Sur.')
    const suya = cierreYaHecho(andres, { nombre: 'Andrés Vargas', propio: true, esCobrador: true, rutas: ['Ruta Centro', 'Ruta Sur', 'Floresta'], estaRuta: true }, cifras)
    expect(suya.deQuien).toBe('Es tu caja: una sola para tus 3 rutas, Ruta Centro, Ruta Sur y Floresta.')
    const sinCobrador = cierreYaHecho({ totalRecogido: 14500, enLaManoSistema: null }, { nombre: 'Sofía Restrepo', propio: true, esCobrador: false, rutas: [], estaRuta: false }, cifras)
    expect(sinCobrador.deQuien).toBe('Es tu caja del día: todo lo que cobraste tú, no solo esta ruta.')
  })
  it('sin `enLaManoSistema` (cierres viejos y el del dueño) no se inventa diferencia', () => {
    // El de Andrés del 17 oct en el espejo: cuadrado con la cuenta de antes.
    const viejo = cierreYaHecho({ totalEsperado: 177500, totalRecogido: 65200, diferencia: -112300, enLaManoSistema: null, efectivoRecibido: 79400, diferenciaRecibido: -5000, confirmadoEn: '2026-10-17T08:11:17.596Z' }, { esCobrador: true }, cifras)
    expect(viejo.lineas).toEqual([{ id: 'entrego', texto: 'Entregó', valor: '$79.400' }])
    expect(viejo.resultado).toBeNull()
    expect(viejo.frase).toBe('Entregó $79.400')
    expect(cierreYaHecho({ totalRecogido: 65200, enLaManoSistema: null }, { esCobrador: true }, cifras).frase).toBe('Entregó $65.200')
    const duena = cierreYaHecho({ totalRecogido: 14500, enLaManoSistema: null }, { esCobrador: false }, cifras)
    expect(duena.frase).toBe('Contó $14.500')
    // Le debían a él: no hay «sobraron» con lo que le debían.
    const leDebian = cierreYaHecho({ totalRecogido: 0, enLaManoSistema: -50000 }, { esCobrador: true }, cifras)
    expect(leDebian.lineas[0]).toEqual({ id: 'tenia', texto: 'Le debían a él', valor: '$50.000' })
    expect(leDebian.resultado).toBeNull()
    expect(cierreYaHecho(null)).toBeNull()
  })
  it('la pantalla pinta `cierreYaHecho` y ya no resta `diferencia`', () => {
    const src = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))
    expect(src).toContain('const cierreHecho = cierreYaHecho(ruta?.cierre, ruta?.cierreDe ?? {}, (n) => formatMoney(n))')
    expect(src).not.toMatch(/ruta\.cierre\.diferencia/)
    expect(src).not.toMatch(/ruta\.cierre\.totalEsperado/)
    expect(src).toMatch(/\{cierreHecho\.lineas\.map\(\(l\) => \(/)
    expect(src).toContain('{cierreHecho.resultado.texto}')
  })
  it('el servidor dice de quién es el cierre y qué rutas junta', () => {
    const api = sinComentarios(leer('app/api/rutas/[id]/route.js'))
    expect(api).toMatch(/where: \{ organizationId, cobradorId: quienCobra, activo: true \},\s*select: \{ id: true, nombre: true \}/)
    expect(api).toMatch(/estaRuta: rutasDeLaCaja\.some\(\(r\) => r\.id === id\)/)
    expect(api).toMatch(/\n\s*cierreDe,\n/)
  })
  it('la insignia del Inicio y «Ver detalle» de la Caja restan lo mismo que la ruta', () => {
    // Andrés: `diferencia` −98.400 decía «Caja OK» en dorado; cuadró al peso.
    expect(diferenciaDelCierre(andres)).toEqual({ tenia: 63500, entrego: 63500, dif: 0 })
    expect(diferenciaDelCierre(camilo).dif).toBe(-7800)
    expect(diferenciaDelCierre({ totalRecogido: 65200, enLaManoSistema: null }).dif).toBeNull()
    expect(diferenciaDelCierre(null).dif).toBeNull()

    const resumen = sinComentarios(leer('app/api/equipo/resumen/route.js'))
    expect(resumen).toContain('cierreMap[c.cobradorId] = { diferencia: diferenciaDelCierre(c).dif, cerradoEn: c.createdAt }')
    for (const campo of ['totalRecogido', 'enLaManoSistema', 'efectivoRecibido', 'diferenciaRecibido', 'confirmadoEn']) {
      expect(resumen).toMatch(new RegExp(`select: \\{ cobradorId: true[^}]*${campo}: true`))
    }
    const inicio = sinComentarios(leer('app/(dashboard)/dashboard/page.jsx'))
    expect(inicio).toMatch(/c\.cajaDiferencia === 0 \? 'Caja OK'\s*: c\.cajaDiferencia == null \? 'Cerró caja'/)

    const caja = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    expect(caja).toContain('const { tenia, entrego, dif } = diferenciaDelCierre(cierre)')
    expect(caja).not.toContain('(cierre.totalRecogido || 0) - cierreEnLaMano')
  })
})
