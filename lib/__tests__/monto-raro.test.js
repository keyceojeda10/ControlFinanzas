// Cuándo un monto es muy poco o demasiado. Los casos son de producción: errores que
// alguien anuló y volvió a meter (7 nov 2026). Ver lib/dinero/monto-raro.js.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cobroRaro, cifraProbable, abonoPrevioRaro, abonoSinResolver, fueraDeLaCuota } from '@/lib/dinero/monto-raro'

describe('los errores de verdad se preguntan, con la cifra que era', () => {
  it.each([
    // [escrito, cuota, saldo, la que era]
    [30, 25_000, 500_000, 30_000],
    [1_000, 10_000, 300_000, 10_000],
    [6_000, 120_000, 960_000, 60_000],
    [5_000, 90_000, 500_000, 50_000],
    [432, 216_000, 2_000_000, 432_000],
    [30, 175_000, 1_400_000, 30_000],
    [400, 108_400, 900_000, 400_000],
  ])('faltaron ceros: $%i con cuota de $%i → $%i', (monto, cuota, saldo, era) => {
    const r = cobroRaro({ monto, cuota, saldo })
    expect(r).toMatchObject({ tipo: 'poco', sugerido: era })
  })
  it.each([
    [300_000, 10_000, 900_000, 30_000],
    [200_000, 14_000, 700_000, 20_000],
  ])('sobraron ceros: $%i con cuota de $%i → $%i', (monto, cuota, saldo, era) => {
    expect(cobroRaro({ monto, cuota, saldo })).toMatchObject({ tipo: 'mucho', sugerido: era })
  })
  it('si no hay una cifra razonable, pregunta igual pero sin inventar', () => {
    expect(cobroRaro({ monto: 1_234, cuota: 900_000, saldo: 900_000 * 3 })).toMatchObject({ tipo: 'poco' })
    expect(cifraProbable({ monto: 310_123, cuota: 10_000, saldo: 900_000 })).toBeNull()
  })
})

describe('⚠ lo normal no se pregunta', () => {
  it('la cuota, un abono corriente y varias cuotas juntas', () => {
    expect(cobroRaro({ monto: 77_500, cuota: 77_500, saldo: 620_000 })).toBeNull()
    expect(cobroRaro({ monto: 20_000, cuota: 77_500, saldo: 620_000 })).toBeNull() // 26 %
    expect(cobroRaro({ monto: 700_000, cuota: 77_500, saldo: 800_000 })).toBeNull() // 9 veces
  })
  it('⚠ quien salda: la última cuota suele ser pequeña, y pagar todo no es un error', () => {
    expect(cobroRaro({ monto: 2_500, cuota: 77_500, saldo: 2_500 })).toBeNull()
    expect(cobroRaro({ monto: 900_000, cuota: 30_000, saldo: 900_000 })).toBeNull()
    expect(cobroRaro({ monto: 900_000, cuota: 30_000, saldo: 900_500 })).not.toBeNull()
  })
  it('⚠ la costumbre de este cliente manda sobre la cuota', () => {
    // Siempre abona de a $5.000 en una cuota de $100.000.
    expect(cobroRaro({ monto: 5_000, cuota: 100_000, saldo: 800_000, minimo: 5_000, maximo: 5_000 })).toBeNull()
    expect(cobroRaro({ monto: 3_000, cuota: 100_000, saldo: 800_000, minimo: 5_000, maximo: 5_000 })).toBeNull()
    expect(cobroRaro({ monto: 2_000, cuota: 100_000, saldo: 800_000, minimo: 5_000, maximo: 5_000 })).not.toBeNull()
    // Suele adelantar 15 días; 20 días tampoco es raro.
    expect(cobroRaro({ monto: 200_000, cuota: 10_000, saldo: 900_000, minimo: 10_000, maximo: 150_000 })).toBeNull()
    expect(cobroRaro({ monto: 400_000, cuota: 10_000, saldo: 900_000, minimo: 10_000, maximo: 150_000 })).not.toBeNull()
  })
  it('⚠ el negocio que escribe en miles: se mide contra su cuota, no contra un tope', () => {
    // Préstamo de 300 (= $300.000), cuota de 100.
    expect(cobroRaro({ monto: 100, cuota: 100, saldo: 300 })).toBeNull()
    expect(cobroRaro({ monto: 46, cuota: 100, saldo: 300 })).toBeNull()
    expect(abonoPrevioRaro({ abono: 90, montoPrestado: 200, totalAPagar: 300 })).toBeNull()
  })
  it('sin cuota o sin monto no hay con qué comparar', () => {
    expect(fueraDeLaCuota(5, 0)).toBe(false)
    expect(cobroRaro({ monto: 0, cuota: 100, saldo: 100 })).toBeNull()
    expect(cobroRaro({ monto: 5, cuota: 0, saldo: 100 })).toBeNull()
  })
})

describe('el abono previo', () => {
  it('⚠ el del cliente: $80 en un préstamo de $500.000 era $80.000', () => {
    expect(abonoPrevioRaro({ abono: 80, montoPrestado: 500_000, totalAPagar: 620_000 })).toEqual({ sugerido: 80_000 })
  })
  it('los abonos normales pasan', () => {
    expect(abonoPrevioRaro({ abono: 80_000, montoPrestado: 500_000, totalAPagar: 620_000 })).toBeNull()
    expect(abonoPrevioRaro({ abono: 1_000, montoPrestado: 500_000, totalAPagar: 620_000 })).toBeNull()
    expect(abonoPrevioRaro({ abono: 0, montoPrestado: 500_000, totalAPagar: 620_000 })).toBeNull()
  })
  it('si ×1000 no cabe en lo que debe, no era un dedazo de miles', () => {
    expect(abonoPrevioRaro({ abono: 900, montoPrestado: 50_000, totalAPagar: 60_000 })).toBeNull()
    expect(abonoPrevioRaro({ abono: 900, montoPrestado: 50_000 })).toBeNull()
    expect(abonoPrevioRaro({ abono: 20, montoPrestado: 50_000 })).toEqual({ sugerido: 20_000 })
  })
  it('confirmar suelta el freno solo para ESA cifra', () => {
    const a = { abono: 80, montoPrestado: 500_000, totalAPagar: 620_000 }
    expect(abonoSinResolver(a)).toBe(true)
    expect(abonoSinResolver({ ...a, confirmado: 80 })).toBe(false)
    expect(abonoSinResolver({ ...a, abono: 90, confirmado: 80 })).toBe(true)
    expect(abonoSinResolver({ ...a, abono: 80_000 })).toBe(false)
  })
})

describe('⚠ cada pantalla pregunta, y la cola sin señal nunca', () => {
  const lee = (f) => readFileSync(f, 'utf8')
  const RUTA = 'app/api/prestamos/[id]/pagos/route.js'
  it('el servidor solo pregunta si se lo piden y nunca a un cobro de la cola', () => {
    expect(lee(RUTA)).toContain("const tocaPreguntar = body.preguntarMonto === true && !marcador && TIPOS_QUE_SE_PREGUNTAN.includes(tipo)")
    expect(lee(RUTA)).toContain("return Response.json({ error: 'Revisa el monto', montoRaro }, { status: 409 })")
  })
  it.each(['lib/offline.js', 'public/sw.js', 'app/api/asistente/accion/route.js'])('%s no pide preguntar: ese cobro ya se hizo', (f) => {
    expect(lee(f)).not.toContain('preguntarMonto')
    expect(lee(f)).not.toContain('camposDePregunta')
  })
  it.each([
    ['components/prestamos/RegistrarPago.jsx', 'data?.montoRaro'],
    ['app/(dashboard)/cobros-hoy/page.jsx', 'd?.montoRaro'],
    ['app/(dashboard)/rutas/[id]/page.jsx', 'data?.montoRaro'],
  ])('%s manda la pregunta y la contesta', (f, atiende) => {
    const s = lee(f)
    expect(s).toContain('...camposDePregunta(respuestaMonto)')
    expect(s).toContain(`if (${f.includes('RegistrarPago') ? 'res.status === 409 && ' : ''}${atiende}) {`)
    expect(s).toContain('<PreguntaMontoRaro pregunta={montoRaro} formatMoney={formatMoney}')
  })
  it.each(['app/(dashboard)/cobros-hoy/page.jsx', 'app/(dashboard)/rutas/[id]/page.jsx'])('⚠ %s la pinta en la raíz, fuera de todo modal', (f) => {
    // Pasó: dentro del Modal de «Pago duplicado», que cerrado no pinta sus hijos. El
    // servidor preguntaba, nada se guardaba y el cobrador no veía nada.
    const s = lee(f)
    const hasta = s.slice(0, s.indexOf('<PreguntaMontoRaro'))
    for (const tag of ['Modal', 'HojaInferior']) {
      const abiertos = (hasta.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length
      const cerrados = (hasta.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
      expect(abiertos, tag).toBe(cerrados)
    }
  })
  it('⚠ en la ficha la pregunta está en la hoja de cobro, no solo en el formulario viejo', () => {
    // Pasó: con el componente una sola vez en el archivo, esta prueba de texto daba
    // verde y en la hoja nunca salía. Se ancla en cada salida.
    const s = lee('components/prestamos/RegistrarPago.jsx')
    const hoja = s.slice(s.indexOf('if (esPagoNormal && !verFormularioCompleto) {'), s.indexOf('<Button onClick={handleSubmit} loading={loading}>'))
    expect(hoja).toContain('{preguntaMonto}\n      </>')
    expect(s.slice(s.lastIndexOf('{preguntaMonto}'))).toContain('</Modal>')
    expect(s.indexOf('const preguntaMonto = (')).toBeLessThan(s.indexOf('if (esPagoNormal && !verFormularioCompleto) {'))
  })
  it.each([
    ['app/(dashboard)/prestamos/nuevo/page.jsx', '<PreguntaAbonoRaro abono={yaAbonado}', 'if (abonoPorResolver) return false'],
    ['app/(dashboard)/migrador/page.jsx', '<PreguntaAbonoRaro abono={ficha.yaAbonado}', "setError('Revisa cuánto ha pagado hasta ahora')"],
    ['components/migrador/LoteFotos.jsx', '<PreguntaAbonoRaro abono={f.yaAbonado}', 'disabled={!creables.length || !!creando || abonosPorResolver > 0}'],
  ])('%s pregunta por el abono y no deja seguir sin respuesta', (f, pregunta, freno) => {
    expect(lee(f)).toContain(pregunta)
    expect(lee(f)).toContain(freno)
  })
})
