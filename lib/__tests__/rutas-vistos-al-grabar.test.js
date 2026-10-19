/* DETALLES-RUTAS 56, 58, 59 y 60 (vistos al grabar, 18 oct 2026): los conteos
 * de hoy entre la lista de rutas, la ruta por dentro y Auditoría, y la cuota
 * diaria que caía en día sin cobro. Con cifras, y ancladas en el código. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcularProximoCobro, calcularMontoParaPonerseAlDia, tieneCobroPendienteHoy, calcularMontoEnMora, calcularCuotasEnMora, calcularDiasMora } from '@/lib/calculos'

const leer = (f) => readFileSync(f, 'utf8')
const dia = (iso) => new Date(iso).toISOString().slice(0, 10)

// Carmen Rosa Díaz: diario Clásico desde el sábado 17, cuota $13.800, sin pagos;
// su ficha dice que no se le cobra los domingos.
const carmen = {
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
  montoPrestado: 300000, totalAPagar: 414000, cuotaDiaria: 13800, diasPlazo: 30,
  fechaInicio: '2026-10-17T05:00:00.000Z', totalPagado: 0, pagos: [], cuotasAmortizacion: [],
}
const domingo = [0]
const el = (iso) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)) }
afterEach(() => vi.useRealTimers())

describe('#60 · la cuota que cae en día sin cobro se cobra el siguiente', () => {
  it('el domingo: le cobras el lunes, hoy no debe ni está pendiente', () => {
    el('2026-10-18T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, domingo, []))).toBe('2026-10-19')
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(0)
    expect(tieneCobroPendienteHoy(carmen, domingo, [])).toBe(false)
    expect(calcularDiasMora(carmen, domingo, [])).toBe(0)
  })
  it('el lunes: le toca hoy y no está atrasada', () => {
    el('2026-10-19T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, domingo, []))).toBe('2026-10-19')
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(13800)
    expect(tieneCobroPendienteHoy(carmen, domingo, [])).toBe(true)
    expect(calcularMontoEnMora(carmen, domingo, [])).toBe(0)
  })
  it('el martes sin pagar: una cuota en mora, y la plata dice lo mismo', () => {
    el('2026-10-20T15:00:00.000Z')
    expect(calcularCuotasEnMora(carmen, domingo, [])).toBe(1)
    expect(calcularMontoEnMora(carmen, domingo, [])).toBe(13800)
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(27600)
  })
  it('sin días sin cobro, el domingo es un día como otro (lo de siempre)', () => {
    el('2026-10-18T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, [], []))).toBe('2026-10-18')
    expect(calcularMontoParaPonerseAlDia(carmen, [], [])).toBe(13800)
  })
})

describe('#56 #58 #59 · lo de hoy cuenta a quien hoy debe algo o pagó hoy', () => {
  it('la ruta por dentro: la meta no suma al que ya lo tiene cubierto', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    expect(api).toMatch(/const pendienteEste = !_hoySinCobro && tieneCobroPendienteHoy\(p, diasExcluidosPrestamo, festivos\)/)
    expect(api).toMatch(/const debeOPagoHoy = montoPagadoHoy > 0 \|\| pendienteEste/)
    expect(api).toMatch(/esperadoHoy   \+= tocaHoyEste && debeOPagoHoy \? cuota : 0/)
  })
  it('la lista de rutas cuenta los cobros como la ruta por dentro', () => {
    const lista = leer('app/api/rutas/route.js')
    expect(lista).toMatch(/const pendienteEste = vivo && !hoySinCobro && tieneCobroPendienteHoy\(prestamo, diasDelPrestamo, festivos\)/)
    expect(lista).toMatch(/tocaHoy = !hoySinCobro && \(pendienteCliente \|\| pagoHoyCliente\)/)
    expect(lista).toMatch(/if \(vivo && \(pendienteEste \|\| cobradoDeEste > 0\) && tienePeriodoEsperadoHoy\(/)
  })
  it('Auditoría no llama «pendiente» a quien hoy no debe nada', () => {
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/if \(!tienePendiente && !c\.pagoHoy\) return 'sin_cobro'/)
  })
})

describe('#61 · «Ya cobra en …» con todas sus rutas', () => {
  it('el lápiz nombra todas menos esta', () => {
    expect(leer('app/api/cobradores/route.js')).toMatch(/rutas:\s+c\.rutas\.map\(\(r\) => \(\{ id: r\.id, nombre: r\.nombre \}\)\),/)
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/const otraRuta = otras\.length \? otras\.join\(' y '\) : null/)
  })
  it('unir dice «Ya cobra en», y las dos si lleva las dos', () => {
    const unir = leer('components/rutas/UnirRutas.jsx')
    expect(unir).toMatch(/`Ya cobra en \$\{vista\.destino\.nombre\} y \$\{vista\.origen\.nombre\}`/)
    expect(unir).not.toMatch(/`Ya cobra \$\{vista\.destino\.nombre\}`/)
  })
})

describe('#62 · «Falta» es lo que les queda a los pendientes', async () => {
  const { loDeHoy } = await import('@/lib/adaptadores/ruta')
  const { bandaDelDia, adaptarRutas } = await import('@/lib/adaptadores/rutas')
  it('un pago grande de uno no tapa lo que deben los otros', () => {
    // Recaudó $307.067 (uno cerró su préstamo) y quedan tres con $73.700.
    const r = loDeHoy({ esperadoHoy: 158100, recaudadoHoy: 307067, faltaHoy: 73700, clientesConCobroHoy: 8, clientesPagaronHoy: 5 }, (n) => `$${n}`)
    expect(JSON.stringify(r)).toMatch(/73700/)
  })
  it('sin el dato del servidor, la resta de siempre', () => {
    const r = loDeHoy({ esperadoHoy: 158100, recaudadoHoy: 84400 }, (n) => `$${n}`)
    expect(JSON.stringify(r)).toMatch(/73700/)
  })
  it('la banda de /rutas suma lo que falta de cada ruta', () => {
    const b = bandaDelDia([
      { esperadoHoy: 158100, recaudadoHoy: 307067, faltaHoy: 73700, cobrosHoy: 8 },
      { esperadoHoy: 50000, recaudadoHoy: 0, faltaHoy: 50000, cobrosHoy: 3 },
    ], 'CO')
    expect(b.faltan).toBe('$123.700')
  })
  it('el servidor y las pantallas leen `faltaHoy`', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    // Desde #67, con el tope de lo que le falta para ponerse al día.
    expect(api).toMatch(/if \(tocaHoyEste && pendienteEste\) \{[^}]*const leFalta = faltaDeHoy\(\{ cuota, pagadoHoy: montoPagadoHoy, alDia: montoAlDiaPrestamo \}\)\s*faltaHoy \+= leFalta\s*faltaHoyCliente \+= leFalta/)
    expect(leer('app/api/rutas/route.js')).toMatch(/if \(pendienteEste\) \{\s*faltaHoy \+= faltaDeHoy\(\{\s*cuota: prestamo\.cuotaDiaria,\s*pagadoHoy: cobradoDeEste,/)
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/porCobrarHoy=\{formatMoney\(ruta\.faltaHoy != null \?/)
    expect(leer('lib/adaptadores/rutas.js')).toMatch(/falta: formatMoney\(r\.faltaHoy != null \?/)
  })
  it('la barra no se llena mientras alguien deba, aunque otro pague de más', async () => {
    const { avanceDeHoy } = await import('@/lib/adaptadores/ruta')
    // El caso del espejo: esperado $34.200, recaudado $239.400, faltan $22.800.
    expect(avanceDeHoy({ esperadoHoy: 34200, recaudadoHoy: 239400, faltaHoy: 22800 })).toBe(33)
    expect(avanceDeHoy({ esperadoHoy: 34200, recaudadoHoy: 239400, faltaHoy: 1 })).toBe(99)
    expect(avanceDeHoy({ esperadoHoy: 34200, recaudadoHoy: 34200, faltaHoy: 0 })).toBe(100)
    expect(avanceDeHoy({ esperadoHoy: 34200, recaudadoHoy: 0, faltaHoy: 34200 })).toBe(0)
    expect(avanceDeHoy({ esperadoHoy: 0, recaudadoHoy: 5000, faltaHoy: 0 })).toBe(0)
    // Sin el dato del servidor, la división de siempre.
    expect(avanceDeHoy({ esperadoHoy: 34200, recaudadoHoy: 17100 })).toBe(50)
    expect(loDeHoy({ esperadoHoy: 34200, recaudadoHoy: 239400, faltaHoy: 22800 }).progreso).toBe(33)
    expect(bandaDelDia([{ esperadoHoy: 34200, recaudadoHoy: 239400, faltaHoy: 22800, cobrosHoy: 4 }], 'CO').porcentaje).toBe(33)
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina).toMatch(/progreso=\{avanceDeHoy\(ruta\)\}/)
    expect(pagina).toMatch(/const pctCobradoHoy = ruta\.esperadoHoy > 0 \? avanceDeHoy\(ruta\)/)
  })
  it('la ruta por dentro y el recorrido le pasan `faltaHoy` a loDeHoy (sin él, resta)', () => {
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    const llamadas = pagina.match(/loDeHoy\(\{[\s\S]*?\}, \(n\) => formatMoney\(n\)\)/g) || []
    expect(llamadas.length).toBe(2)
    for (const l of llamadas) expect(l).toMatch(/\n\s+faltaHoy: ruta\??\.faltaHoy,/)
  })
})

describe('#51 #52 · agregar clientes', () => {
  const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
  it('#51 al refrescar se espera y no se vuelve a la copia vieja', () => {
    expect(ruta).toMatch(/const refresco = yaPintadaRef\.current\n\s+const ctrl = refresco \? new AbortController\(\) : null/)
    expect(ruta).toMatch(/const corte = ctrl \? setTimeout\(\(\) => ctrl\.abort\(\), 30000\) : null/)
    expect(ruta).toMatch(/\} catch \{\n\s+if \(refresco\) return null/)
  })
  it('#52 «se mueven de su ruta» es una ventana de la app', () => {
    expect(ruta).not.toMatch(/serán MOVIDOS/)
    expect(ruta).toMatch(/if \(!\(await preguntarMover\(\{ cuantos: deOtraRuta\.length, nombres, plata \}\)\)\) return/)
    expect(ruta).toMatch(/onConfirm=\{\(\) => responderMover\(true\)\}/)
  })
})

describe('#66 · la parada pide lo que le falta, no la cuota entera', async () => {
  const { aCobrarEnLaParada, adaptarParadaActual, partirRecorrido } = await import('@/lib/adaptadores/ruta')
  // Yaneth: cuota $32.000, abonó $20.000 hoy y sigue pendiente.
  const yaneth = { id: 'y', nombre: 'Yaneth Cardona', cuota: 32000, montoPagadoHoy: 20000, cobroPendienteHoy: true, faltaHoy: 12000, montoParaPonerseAlDia: 12000 }
  it('si ya abonó y sigue pendiente, «Le falta hoy» y lo que ya dio', () => {
    expect(aCobrarEnLaParada(yaneth)).toEqual({ monto: 12000, etiqueta: 'Le falta hoy', abono: 20000 })
  })
  it('sin nada pagado hoy, su cuota de siempre', () => {
    expect(aCobrarEnLaParada({ cuota: 21800, montoPagadoHoy: 0, cobroPendienteHoy: true, faltaHoy: 21800 })).toEqual({ monto: 21800, etiqueta: 'Cobrarle hoy', abono: 0 })
  })
  it('cubrió la cuota pero sigue debiendo atraso: lo de ponerse al día, con ese nombre', () => {
    expect(aCobrarEnLaParada({ cuota: 32000, montoPagadoHoy: 32000, cobroPendienteHoy: true, faltaHoy: 0, montoParaPonerseAlDia: 64000 })).toEqual({ monto: 64000, etiqueta: 'Para ponerse al día', abono: 32000 })
  })
  it('sin el dato del servidor, la cuota menos lo abonado', () => {
    expect(aCobrarEnLaParada({ cuota: 32000, montoPagadoHoy: 20000, cobroPendienteHoy: true }).monto).toBe(12000)
  })
  it('la parada lo dice y la lista de las que faltan también', () => {
    const pide = aCobrarEnLaParada(yaneth)
    const parada = { ...yaneth, montoACobrar: pide.monto, cobrarEtiqueta: pide.etiqueta, abonoHoy: pide.abono, cobradoHoy: false }
    const a = adaptarParadaActual(parada, (n) => `$${n}`)
    expect(a.cobrar).toBe('$12000')
    expect(a.cobrarEtiqueta).toBe('Le falta hoy')
    expect(a.abonoHoy).toBe('$20000')
    const otro = { id: 'r', nombre: 'Rosalba', cuota: 19900, montoACobrar: 19900, cobradoHoy: false }
    const r = partirRecorrido([otro, parada], (n) => `$${n}`)
    expect(JSON.stringify(r.faltan)).toMatch(/\$12000/)
  })
  it('la pantalla lo cablea: servidor, recorrido y la línea verde', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    expect(api).toMatch(/faltaHoy: {2}Math\.round\(faltaHoyCliente\),/)
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina).toMatch(/\.map\(\(c, i\) => \(\{ c, i, pide: aCobrarEnLaParada\(c\) \}\)\)/)
    expect(pagina).toMatch(/montoACobrar: pide\.monto,\n\s+cobrarEtiqueta: pide\.etiqueta,\n\s+abonoHoy: pide\.abono,/)
    expect(leer('components/pantallas/ModoRuta.jsx')).toMatch(/Ya abonó <b>\{abonoHoy\}<\/b> hoy · sigue pendiente/)
  })
})

describe('#63 · «Cobrar hoy» del cobrador', async () => {
  const { adaptarCobrosHoy } = await import('@/lib/adaptadores/cobros')
  it('la barra no llega al 100 % mientras alguien deba, y dice lo que falta', () => {
    // Andrés: dos rutas, esperado $278.100, recaudado $327.067, faltan $173.700.
    const a = adaptarCobrosHoy({ resumen: { esperadoHoy: 278100, recaudadoHoy: 327067, faltaHoy: 173700, pagados: 5, pendientes: 8 }, clientes: [] }, { pais: 'CO' }).avance
    expect(a.porcentaje).toBe(37)
    expect(a.falta).toBe('$173.700')
    expect(a.meta).toBe('$278.100')
  })
  it('el servidor: esperado con la regla de Rutas, `faltaHoy` y el último pago de todos sus préstamos', () => {
    const api = leer('app/api/cobros-hoy/route.js')
    expect(api).toMatch(/if \(pendienteEste\) \{\s*const leFalta = faltaDeHoy\(\{ cuota: p\.cuotaDiaria \?\? 0, pagadoHoy: montoPagadoHoy, alDia \}\)/)
    expect(api).toMatch(/faltaHoy: Math\.round\(faltaHoyTotal\),/)
    // «Últ. pago» se mira ANTES de saltarse los que no están activos.
    const i = api.indexOf("if (p.ultimoPagoAt && p.estado !== 'cancelado') {")
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(api.indexOf("if (p.estado !== 'activo') continue"))
    expect(api).toMatch(/if \(ultimoCobroHoy && \(!ultimoPagoISO \|\| ultimoCobroHoy\.getTime\(\) > new Date\(ultimoPagoISO\)\.getTime\(\)\)\) ultimoPagoISO = ultimoCobroHoy/)
  })
  it('el encabezado del grupo cuenta y suma también al que abonó y sigue debiendo', async () => {
    const { agruparPorRuta } = await import('@/lib/adaptadores/cobros')
    const [g] = agruparPorRuta([
      { id: 'a', rutaId: 'r', cuota: 11400, pagoHoy: true, cobroPendienteHoy: true, montoCobradoHoy: 5000, faltaHoy: 6400 },
      { id: 'b', rutaId: 'r', cuota: 11400, pagoHoy: false, cobroPendienteHoy: true, faltaHoy: 11400 },
      { id: 'c', rutaId: 'r', cuota: 0, pagoHoy: true, cobroPendienteHoy: false, faltaHoy: 0 },
    ], 'CO')
    expect(g.pendientes).toBe(2)
    expect(g.total).toBe('$17.800')
  })
  it('la pantalla: meta cumplida solo sin nada pendiente, y «faltan» en la cabecera', () => {
    const pagina = leer('app/(dashboard)/cobros-hoy/page.jsx')
    expect(pagina).toMatch(/const cumplida = faltaHoy != null \? faltaHoy <= 0 : recaudadoHoy >= esperadoHoy/)
    expect(leer('components/pantallas/CobrarHoy.jsx')).toMatch(/\{falta \? `faltan \$\{falta\} · ` : ''\}/)
  })
})

describe('#65 · «cobrado» es quien ya no debe nada hoy, en la tarjeta también', () => {
  it('la lista de rutas no cuenta el abono parcial como cobro', () => {
    expect(leer('app/api/rutas/route.js')).toMatch(/if \(tocaHoy && pagoHoyCliente && !pendienteCliente\) cobradosHoy \+= 1/)
  })
})

describe('#64 #55 · historial de cobros y hoja impresa', () => {
  it('el historial: todos sus préstamos, sin el abono previo, «sin pagar» a quien le tocaba', () => {
    const api = leer('app/api/rutas/[id]/historial/route.js')
    expect(api).toMatch(/where: \{ estado: \{ notIn: \['cancelado', 'pendiente_aprobacion'\] \} \}/)
    expect(api).toMatch(/if \(esAbonoPrevio\(p\)\) continue/)
    expect(api).toMatch(/tocaCobrarEn\(p, fecha, obtenerDiasSinCobro\(c, ruta, org, p\), festivos\)/)
    expect(api).toMatch(/return Response\.json\(\{ dias, hoy: diaDe\(new Date\(\)\) \}\)/)
  })
  it('la pantalla: fecha sin «De», «1 pagó» y la fila de hoy con lo de la ruta', () => {
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina).not.toMatch(/font-medium capitalize">\{formatFecha/)
    expect(pagina).toMatch(/\{cantPagaron\} \{cantPagaron === 1 \? 'pagó' : 'pagaron'\}/)
    expect(pagina).toMatch(/const noPagaron = dia\.fecha === hoyDelServidor && Array\.isArray\(sinPagarHoy\) \? sinPagarHoy : dia\.noPagaron/)
    expect(pagina).toMatch(/\.filter\(\(c\) => !c\.hoySinCobro && c\.cobroPendienteHoy && !\(\(c\.montoPagadoHoy \?\? 0\) > 0\)\)/)
  })
  it('la hoja impresa ya no pone una mayúscula por palabra', () => {
    const hoja = leer('components/rutas/HojaRutaImprimible.jsx')
    expect(hoja).not.toMatch(/\.hr-fecha \{[^}]*capitalize/)
    expect(hoja).toMatch(/return t\.charAt\(0\)\.toUpperCase\(\) \+ t\.slice\(1\)/)
  })
})

describe('#67 · lo que debe hoy, una sola cifra', async () => {
  const { faltaDeHoy } = await import('@/lib/dinero/esperado')
  const { aCobrarEnLaParada } = await import('@/lib/adaptadores/ruta')
  const { opcionesDeMonto } = await import('@/lib/adaptadores/atajos-cobro')
  it('Rosalba: traía $29.900 de dos cuotas de $19.900, le faltan $9.900', () => {
    expect(faltaDeHoy({ cuota: 19900, pagadoHoy: 0, alDia: 9900 })).toBe(9900)
  })
  it('al atrasado le cuenta solo la cuota de hoy, como antes', () => {
    expect(faltaDeHoy({ cuota: 19900, pagadoHoy: 0, alDia: 59700 })).toBe(19900)
    expect(faltaDeHoy({ cuota: 32000, pagadoHoy: 20000, alDia: 76000 })).toBe(12000)
  })
  it('sin el dato de ponerse al día, la resta de siempre', () => {
    expect(faltaDeHoy({ cuota: 19900, pagadoHoy: 0 })).toBe(19900)
    expect(faltaDeHoy({ cuota: 19900, pagadoHoy: 0, alDia: 0 })).toBe(19900)
  })
  it('la parada pide lo mismo que la tarjeta', () => {
    expect(aCobrarEnLaParada({ cuota: 19900, montoPagadoHoy: 0, cobroPendienteHoy: true, faltaHoy: 9900, montoParaPonerseAlDia: 9900 }))
      .toEqual({ monto: 9900, etiqueta: 'Le falta hoy', abono: 0 })
    // El de siempre, sin nada adelantado: su cuota.
    expect(aCobrarEnLaParada({ cuota: 19900, montoPagadoHoy: 0, cobroPendienteHoy: true, faltaHoy: 19900 }))
      .toEqual({ monto: 19900, etiqueta: 'Cobrarle hoy', abono: 0 })
  })
  it('la hoja de cobro deja puesto lo que le falta, y la cuota completa aparte', () => {
    const o = opcionesDeMonto({ cuota: 19900, saldoPendiente: 348200, alDia: 9900, pagadoHoy: false })
    expect(o[0]).toMatchObject({ id: 'hoy', monto: 9900 })
    expect(o.some((x) => x.id === 'cuota' && x.monto === 19900)).toBe(true)
    expect(o.some((x) => x.id === 'alDia')).toBe(false)
    // Al día de siempre: la cuota va primero, sin «Le falta hoy».
    expect(opcionesDeMonto({ cuota: 19900, saldoPendiente: 348200, alDia: 19900 })[0].id).toBe('cuota')
  })
  it('las tres APIs usan la misma función', () => {
    for (const f of ['app/api/rutas/[id]/route.js', 'app/api/rutas/route.js', 'app/api/cobros-hoy/route.js']) {
      expect(leer(f)).toMatch(/faltaDeHoy\(\{/)
    }
  })
})

describe('#68 · el cierre de la ruta es la caja del cobrador', async () => {
  const { cierreDeLaCaja, resumenDeCierre } = await import('@/lib/adaptadores/ruta')
  const { enLaManoDelDia } = await import('@/lib/dinero/en-la-mano')
  // La caja de Andrés con los datos de la grabación.
  const andres = { cobradoHoy: 390967, recogida: 390967, recogidaEfectivo: 376767, recogidaDigital: 14200, desembolsadoDia: 1100000, efectivoPrestadoDia: 1100000, gastos: 0, movidoPorElDuenoEfectivo: 0 }
  it('el total es `enLaManoDelDia`, no una resta propia', () => {
    const c = cierreDeLaCaja(andres, (n) => `$${n}`)
    expect(c.numeros.neto).toBe(enLaManoDelDia(andres))
    expect(c.numeros.neto).toBe(-723233)
    expect(c.totalTexto).toBe('Te deben')
  })
  it('las líneas siempre suman el total, también con lo que movió el dueño', () => {
    for (const d of [
      andres,
      { recogidaEfectivo: 200000, efectivoPrestadoDia: 50000, gastos: 10000, movidoPorElDuenoEfectivo: 109000 },
      { recogidaEfectivo: 200000, efectivoPrestadoDia: 0, gastos: 0, movidoPorElDuenoEfectivo: -73000 },
      { recogida: 80000, desembolsadoDia: 30000 },
    ]) {
      const c = cierreDeLaCaja(d)
      const n = c.numeros
      expect(n.cobrado - n.prestado - n.gastos + n.delDueno).toBe(n.neto)
      expect(n.neto).toBe(enLaManoDelDia(d))
    }
    const dueno = cierreDeLaCaja({ recogidaEfectivo: 200000, movidoPorElDuenoEfectivo: 109000 }, (n) => `$${n}`)
    expect(dueno.lineas.find((l) => l.id === 'dueno')).toMatchObject({ texto: 'Te entregaron para la ruta', valor: '+$109000' })
  })
  it('el resumen no pasa de 100 % con un pago total, y cuenta cobrados como el #65', () => {
    const r = resumenDeCierre({ recaudadoHoy: 390967, esperadoHoy: 158100, faltaHoy: 21800, clientesConCobroHoy: 8, clientesPagaronHoy: 7, pendientesHoy: 1 }, (n) => `$${n}`)
    expect(r.porcentaje).toBe('86%')
    expect(r.datos).toEqual(['7 cobrados', '1 no pagó', 'de $158100'])
    const p = resumenDeCierre({ recaudadoHoy: 100000, esperadoHoy: 100000, faltaHoy: 12000, clientesConCobroHoy: 5, clientesPagaronHoy: 4, pendientesHoy: 2 }, (n) => `$${n}`)
    expect(p.datos).toEqual(['3 cobrados', '1 abonó', '1 no pagó', 'de $100000'])
  })
  it('la página pide /api/caja y ya no arma el cierre con las cifras de la ruta', () => {
    const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(pagina).toMatch(/fetch\(`\/api\/caja\?\$\{qs\}`\)/)
    expect(pagina).toMatch(/const cierreHoyRuta = cajaDelDia \? cierreDeLaCaja\(cajaDelDia, \(n\) => formatMoney\(n\)\) : null/)
    expect(pagina).toMatch(/cierre=\{cierreHoyRuta\}/)
    expect(pagina).not.toMatch(/prestadoEfectivo: ruta\?\.desembolsadoEfectivoHoy/)
    // Si le deben a él, lo que trae es $0.
    expect(pagina).toMatch(/const debe = Math\.max\(0, cierreHoyRuta\.numeros\?\.neto \?\? 0\)/)
  })
})
