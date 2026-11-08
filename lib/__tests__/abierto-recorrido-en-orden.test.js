import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { recorridoDelAbierto } from '@/lib/dinero/recorrido-abierto'
import { calcularCapitalRestante, capitalAbiertoAlDia } from '@/lib/calculos'
import { repartirPagado } from '@/lib/dinero/reparto'

const leer = (f) => readFileSync(f, 'utf8')
const abierto = (o) => ({ modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual', tasaInteres: 12, ...o })

// Yaneris Díaz (Inversiones Jk), como quedó el 5 nov 2026: $1.500.000 al 12 %,
// cada mes el interés como «intereses» y $250.000 a capital — el de octubre
// metido como «completo» el día del corte.
const yaneris = abierto({
  montoPrestado: 1500000, totalAPagar: 1950000, totalPagado: 1200000, fechaInicio: '2026-08-03T05:00:00.000Z',
  pagos: [
    { tipo: 'intereses', montoPagado: 180000, fechaPago: '2026-09-03T17:00:00.000Z' },
    { tipo: 'capital', montoPagado: 250000, fechaPago: '2026-09-03T17:00:00.000Z' },
    { tipo: 'intereses', montoPagado: 150000, fechaPago: '2026-10-03T17:00:00.000Z' },
    { tipo: 'completo', montoPagado: 250000, fechaPago: '2026-10-03T17:00:00.000Z' },
    { tipo: 'intereses', montoPagado: 120000, fechaPago: '2026-11-03T17:00:00.000Z' },
    { tipo: 'capital', montoPagado: 250000, fechaPago: '2026-11-03T17:00:00.000Z' },
  ],
  devengos: [
    { periodo: '2026-09-03', interes: 180000 },
    { periodo: '2026-10-03', interes: 150000 },
    { periodo: '2026-11-03', interes: 120000 },
  ],
})

describe('⚠ el completo no paga un interés que vence después (Yaneris)', () => {
  it('capital $750.000 y nada de interés debido', () => {
    expect(recorridoDelAbierto(yaneris)).toMatchObject({ capital: 750000, interesDebido: 0 })
    expect(calcularCapitalRestante(yaneris)).toBe(750000)
  })
  it('el capital con que empezó noviembre: $1.000.000 (antes la app decía $1.120.000)', () => {
    expect(capitalAbiertoAlDia(yaneris, new Date('2026-10-03T05:00:00.000Z'))).toBe(1000000)
    expect(capitalAbiertoAlDia(yaneris, new Date('2026-11-03T05:00:00.000Z'))).toBe(750000)
  })
  it('los informes cuentan el mismo capital pagado', () => {
    expect(repartirPagado(yaneris)).toMatchObject({ capital: 750000, interes: 450000 })
  })
})

describe('el completo que paga el mes unos días antes del corte es interés', () => {
  // `oou4cd50`: $1.500.000 al 15 %; paga $225.000 el 28 oct, el interés vence el 31.
  const p = abierto({
    montoPrestado: 1500000, tasaInteres: 15, fechaInicio: '2026-08-31T05:00:00.000Z',
    pagos: [
      { tipo: 'completo', montoPagado: 225000, fechaPago: '2026-09-30T12:28:00.000Z' },
      { tipo: 'completo', montoPagado: 225000, fechaPago: '2026-10-28T17:07:00.000Z' },
    ],
    devengos: [{ periodo: '2026-09-30', interes: 225000 }, { periodo: '2026-10-31', interes: 225000 }],
  })
  it('no baja el capital ni lo deja debiendo', () => {
    expect(recorridoDelAbierto(p)).toMatchObject({ capital: 1500000, interesDebido: 0 })
  })
  it('pero no paga dos meses: el que viene después del corte siguiente queda por pagar', () => {
    const conDiciembre = { ...p, devengos: [...p.devengos, { periodo: '2026-11-30', interes: 225000 }] }
    expect(recorridoDelAbierto(conDiciembre)).toMatchObject({ capital: 1500000, interesDebido: 225000 })
  })
  it('lo que sobra del interés es capital', () => {
    const conMas = { ...p, pagos: [...p.pagos.slice(0, 1), { ...p.pagos[1], montoPagado: 325000 }] }
    expect(recorridoDelAbierto(conMas).capital).toBe(1400000)
  })
})

describe('el abono previo de la carga se cuenta como antes', () => {
  // `7vburv6n`: tasa 0, un completo el mismo día de inicio.
  const p = abierto({
    montoPrestado: 1500000, tasaInteres: 0, fechaInicio: '2026-10-26T05:00:00.000Z',
    pagos: [{ tipo: 'completo', montoPagado: 20000, fechaPago: '2026-10-27T00:57:00.000Z' }], devengos: [],
  })
  it('para el capital de hoy es capital si no hay interés que cubrir', () => {
    expect(calcularCapitalRestante(p)).toBe(1480000)
  })
  it('para el capital con que empieza un mes no cuenta', () => {
    expect(capitalAbiertoAlDia(p, new Date('2026-11-26T05:00:00.000Z'))).toBe(1500000)
  })
})

describe('una sola regla para la ficha y para los informes', () => {
  it('calculos.js y reparto.js usan `recorridoDelAbierto`', () => {
    expect(leer('lib/calculos.js')).toMatch(/return recorridoDelAbierto\(prestamo, \{ base: montoBase \}\)\.capital/)
    expect(leer('lib/dinero/reparto.js')).toMatch(/recorridoDelAbierto\(\{ \.\.\.prestamo, pagos \}, \{ base: monto \}\)\.aCapital/)
  })
})

describe('la cuota de un abierto es el interés del mes que corre', () => {
  const src = leer('lib/dinero/devengar.js')
  it('se recalcula al asentar un mes y al mover un pago', () => {
    expect(src).toMatch(/try \{ await refrescarCuotaAbierto\(prisma, p\.id, ahora\) \}/)
    expect(src).toMatch(/if \(cambios\) await refrescarCuotaAbierto\(tx, prestamoId\)/)
    expect(src).toMatch(/const cuota = periodoEnCursoAbierto\(p, ahora\)\?\.interesPeriodo/)
  })
  it('la ficha dice solo el interés que ya venció', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/\? Math\.max\(0, Math\.round\(\(saldoPendiente \?\? 0\) - capitalRestante\)\)/)
  })
  it('«Cómo va» (inicio → vencimiento) no sale en un abierto', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/\{esOwner && estaActivo && fechaInicio && fechaFin && !esAbierto && \(\n\s*<TimelinePrestamo/)
  })
  it('el historial por WhatsApp no cuenta «cuotas» de un abierto', () => {
    expect(leer('lib/whatsapp-plantillas.js')).toMatch(/if \(!esAbiertoConDevengo\(prestamo \?\? \{\}\)\) \{\n\s*resumenLines\.push\(`\\u\{1f522\} Cuotas pagadas/)
  })
})

describe('el cobrador reparte un cobro de un abierto entre interés y capital', () => {
  const src = leer('components/prestamos/RegistrarPago.jsx')
  it('sin tocar, el reparto es el del servidor: hasta lo cobrable a interés, el resto a capital', () => {
    // El tope vive en `interesDeUnCobroAbierto`: fuera del corte es lo cobrable (abierto-cobro-al-corte.test.js).
    expect(src).toMatch(/const \{ tope: topeDeInteres, separar \} = interesDeUnCobroAbierto\(prestamo\)\n\s*const tope = Math\.min\(total, topeDeInteres\)/)
    expect(src).toMatch(/const interes = manual \?\? tope/)
  })
  it('a mano se guardan dos pagos con su tipo, en ese orden', () => {
    const bloque = src.slice(src.indexOf('if (repartoAbierto?.aMano || separarAlCorte) {'), src.indexOf("const qs = confirmarDuplicado ? '?confirmarDuplicado=1' : ''"))
    expect(bloque).toMatch(/\{ tipo: 'intereses', monto: interesDeEste, clave: nuevaClaveCobro\(\) \},\n\s*\{ tipo: 'capital', monto: capitalDeEste, clave: nuevaClaveCobro\(\) \},/)
    expect(bloque).toMatch(/claveCobro: parte\.clave, montoPagado: parte\.monto,/)
    // Un comprobante: el «antes debía» del primero y el reparto elegido, atados al último.
    expect(bloque).toMatch(/saldoAntesDelPago: guardados\[0\]\.data\.saldoAntesDelPago \?\? null/)
    expect(bloque).toMatch(/repartoDelPagoId: pagoId/)
  })
  it('se ofrece en la hoja', () => {
    expect(src).toMatch(/>\n\s*Repartir distinto\n\s*<\/button>/)
  })
})

describe('el completo de un abierto asienta el mes que corre, como el pago a interés', () => {
  it('el servidor lo incluye y la vista previa también', () => {
    expect(leer('app/api/prestamos/[id]/pagos/route.js')).toMatch(/if \(\['intereses', 'liquidacion', 'completo'\]\.includes\(tipo\) && esAbiertoConDevengo\(prestamoLocked\)\) \{/)
    expect(leer('components/prestamos/RegistrarPago.jsx')).toMatch(/if \(!esAbierto \|\| !\['intereses', 'completo'\]\.includes\(tipo\)\) return 0/)
  })
  it('en un abierto lo de más baja el capital: no «adelanta intereses»', () => {
    expect(leer('components/prestamos/RegistrarPago.jsx')).toMatch(/texto: `\$\{alDia \? 'Para quedar al día eran' : 'Le tocaba'\} \$\{formatMoney\(cuota\)\}: los \$\{formatMoney\(deMas\)\} de más bajan el capital\.`/)
  })
})

describe('el recibo y la ganancia parten el completo con la misma regla', () => {
  it('Yaneris paga $340.000 el 5 nov: $90.000 del mes que corre a interés y $250.000 a capital', async () => {
    const { repartoDeUnPago } = await import('@/lib/dinero/interes-cobrado')
    const pago = { id: 'nuevo', tipo: 'completo', montoPagado: 340000, fechaPago: '2026-11-05T15:00:00.000Z' }
    const p = { ...yaneris, devengos: [...yaneris.devengos, { periodo: '2026-12-03', interes: 90000 }] }
    expect(repartoDeUnPago({ prestamo: p, pagos: [...p.pagos, pago], pagoId: 'nuevo' })).toEqual({ interes: 90000, capital: 250000 })
    expect(recorridoDelAbierto({ ...p, pagos: [...p.pagos, pago] }).capital).toBe(500000)
  })
})

describe('«si paga todo hoy» no cobra dos veces el mes que ya se asentó', () => {
  const hoy = new Date('2026-11-05T17:00:00.000Z') // 2 días del mes 3 nov → 3 dic
  const pagoDic = { tipo: 'completo', montoPagado: 340000, fechaPago: '2026-11-05T15:00:00.000Z' }
  it('sin asentar: capital más los días corridos, y se ahorra el resto del mes', async () => {
    const { calcularLiquidacionAnticipada } = await import('@/lib/calculos')
    const l = calcularLiquidacionAnticipada(yaneris, hoy)
    expect(l.restanteHoy).toBe(750000 + l.periodoEnCurso.interesCorrido)
    expect(l.interesPerdonado).toBe(90000 - l.periodoEnCurso.interesCorrido)
  })
  it('asentado y pagado (Yaneris, 5 nov): debe el capital y no hay nada que ahorrar', async () => {
    const { calcularLiquidacionAnticipada } = await import('@/lib/calculos')
    const p = { ...yaneris, totalAPagar: 2040000, totalPagado: 1540000, pagos: [...yaneris.pagos, pagoDic],
      devengos: [...yaneris.devengos, { periodo: '2026-12-03', interes: 90000 }] }
    const l = calcularLiquidacionAnticipada(p, hoy)
    expect(l.restanteHoy).toBe(500000)
    expect(l.interesPerdonado).toBe(0)
    expect(l.mesCompleto.restanteHoy).toBe(500000)
  })
  it('asentado y a medio pagar: perdona los días que faltan, nunca lo ya pagado', async () => {
    const { calcularLiquidacionAnticipada } = await import('@/lib/calculos')
    // Pagó $40.000 a interés el 5 nov: se asentó diciembre ($90.000) y faltan $50.000.
    const pago = { tipo: 'intereses', montoPagado: 40000, fechaPago: '2026-11-05T15:00:00.000Z' }
    const p = { ...yaneris, totalAPagar: 2040000, totalPagado: 1240000, pagos: [...yaneris.pagos, pago],
      devengos: [...yaneris.devengos, { periodo: '2026-12-03', interes: 90000 }] }
    const l = calcularLiquidacionAnticipada(p, hoy)
    // Debe $800.000 (750.000 + 50.000). Corrieron menos de $40.000: se perdonan los $50.000 que faltan.
    expect(l.restanteHoy).toBe(750000)
    expect(l.interesPerdonado).toBe(50000)
    expect(l.mesCompleto.restanteHoy).toBe(800000)
  })
})
