/* FINANCIAR EL SALDO — 21 sep 2026, PRESTA MIL en un vídeo.
 *
 * «Le cobro los intereses de un millón, que serían 200 […] necesito que arranque
 *  en cero, y la fecha desde el día que financio la cartulina, y la fecha final
 *  cuando se cumplan los 30 días.»
 *
 * El préstamo del vídeo, al peso: $1.060.000 a tasa 0, cuota diaria $35.400,
 * tres recargos (240.000 + 190.000 + 200.000), total $1.692.000, pagado
 * $662.000 → debe $1.030.000, 79 días de «atraso» con fechas del 15 jun. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { interesPorPorcentaje, tasaDeFinanciar, vistaFinanciar, MODO_FINANCIAR } from '@/lib/financiar'
import { minimoParaRenovar } from '@/lib/calculos'
import { SINONIMOS_GESTION } from '@/lib/acciones/prestamo'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const delVideo = { montoPrestado: 1060000, tasaInteres: 0, totalAPagar: 1692000, totalPagado: 662000, abonadoCapital: 0, modoInteres: 'fijo', frecuencia: 'diario', diasPlazo: 30, cuotasAmortizacion: [], pagos: [] }

describe('la cuenta del vídeo', () => {
  it('debe $1.030.000: lo mismo que liquida una renovación', () => {
    expect(minimoParaRenovar(delVideo)).toBe(1030000)
  })

  it('con $200.000 a 30 días queda en $1.230.000 y $41.000 al día, desde hoy', () => {
    const v = vistaFinanciar({ deuda: 1030000, interes: 200000, periodos: 30, frecuencia: 'diario', fechaInicio: '2026-09-21' })
    expect(v.total).toBe(1230000)
    expect(v.cuota).toBe(41000)
    expect(v.periodos).toBe(30)
    expect(v.diasPlazo).toBe(30)
    expect(new Date(v.fechaFin).toISOString().slice(0, 10)).toBe('2026-10-21')
  })

  it('el 20 % de lo que debe se dice en pesos', () => {
    expect(interesPorPorcentaje(1030000, 20)).toBe(206000)
    expect(interesPorPorcentaje(1030000, 0)).toBe(0)
    expect(interesPorPorcentaje(0, 20)).toBe(0)
  })

  it('la tasa reproduce el interés en pesos, en cuota fija', () => {
    expect(MODO_FINANCIAR).toBe('fijo')
    expect(tasaDeFinanciar(1000000, 200000, { periodos: 30, frecuencia: 'diario' })).toBe(20)
    // En `fijo` la tasa es MENSUAL: a 8 semanas (2 meses) el mismo interés es la mitad por mes.
    expect(tasaDeFinanciar(1000000, 200000, { periodos: 8, frecuencia: 'semanal' })).toBe(10)
    // Con cifras redondas no hay ni un peso de diferencia; con cifras raras la cuota se
    // redondea a la centena, y por eso la hoja enseña el total calculado, no la suma.
    for (const [deuda, interes] of [[1030000, 200000], [1000000, 200000], [1030000, 206000]]) {
      const v = vistaFinanciar({ deuda, interes, periodos: 30, frecuencia: 'diario', fechaInicio: '2026-09-21' })
      expect(v.total, `${deuda}+${interes}`).toBe(deuda + interes)
    }
  })

  it('financiar sin cobrar interés también vale: solo vuelve a empezar el plazo', () => {
    /* $1.030.000 / 30 = $34.333,33: la cuota se redondea a la centena —$34.400—,
       como en cualquier préstamo nuevo, y el total queda en $1.032.000. Por eso la
       hoja enseña el total calculado y no «lo que debe + el interés». Nunca más de
       una centena por cuota por encima. */
    const v = vistaFinanciar({ deuda: 1030000, interes: 0, periodos: 30, frecuencia: 'diario', fechaInicio: '2026-09-21' })
    expect(v.total).toBe(1032000)
    expect(v.cuota).toBe(34400)
    expect(v.total - 1030000).toBeLessThan(30 * 100)
  })

  it('semanal: 4 semanas son 4 cuotas de 28 días', () => {
    const v = vistaFinanciar({ deuda: 1030000, interes: 200000, periodos: 4, frecuencia: 'semanal', fechaInicio: '2026-09-21' })
    expect(v.periodos).toBe(4)
    expect(v.diasPlazo).toBe(28)
    expect(v.total).toBe(1230000)
  })
})

describe('el servidor decide la deuda, la tasa y la fecha', () => {
  const api = leer('app/api/prestamos/[id]/renovar/route.js')

  it('entra por la misma renovación, con `financiar: true`', () => {
    expect(api).toContain('const financiar = body.financiar === true')
  })
  it('la deuda es la de AHORA, no la que mandó la pantalla: si no, «sobraría» plata para entregar', () => {
    expect(api).toContain('const montoFinal = financiar ? minimoRenovacion : Number(montoPrestado)')
    // Y con monto = deuda la entrega es cero: no sale un peso del fajo.
    expect(api).toContain('const diferenciaExacta = montoFinal - minimoRenovacion')
  })
  it('la tasa sale del interés en pesos, la fecha es hoy en el país del negocio, y va a cuota fija', () => {
    expect(api).toContain('tasaDeFinanciar(minimoRenovacion, interesFinanciado, {')
    expect(api).toContain("getLocalDateStr(session.user.country ?? 'co')")
    expect(api).toContain('const modoFinal = financiar ? MODO_FINANCIAR : modoRenovacion')
  })
  it('el tope del cliente no la frena: no sale plata nueva', () => {
    expect(api).toMatch(/if \(!financiar && original\.cliente\.montoMaximoPrestamo/)
  })
  it('sin deuda no hay nada que financiar', () => {
    expect(api).toContain('if (financiar && !(minimoRenovacion > 0))')
  })
  it('y queda en el Historial con su nombre', () => {
    expect(api).toContain("accion: financiar ? 'financiar_prestamo' : 'renovar_prestamo'")
    expect(leer('lib/activity-log-types.js')).toMatch(/financiar_prestamo: \{ label: 'Financió el saldo'/)
  })
})

describe('se encuentra donde él lo buscaba', () => {
  const pagina = leer('app/(dashboard)/prestamos/[id]/page.jsx')

  it('la fila va ANTES del recargo, en «Cambia lo que se cobra»', () => {
    const iFin = pagina.indexOf("id: 'financiar', nombre: 'Financiar el saldo'")
    const iRec = pagina.indexOf("id: 'recargo', nombre: 'Recargo por mora'")
    expect(iFin).toBeGreaterThan(-1)
    expect(iFin).toBeLessThan(iRec)
  })
  it('solo en un préstamo activo que debe algo, y con el permiso de gestionar', () => {
    expect(pagina).toContain('if (puedeGestionarPrestamos && estaActivo && !completado && minimoRenovacion > 0) {')
  })
  it('el buscador entiende sus palabras', () => {
    for (const p of ['financiar', 'financiar la cartulina', 'cobrar intereses', '30 dias mas', 'empezar de cero'])
      expect(SINONIMOS_GESTION.financiar, p).toContain(p)
  })
  it('la hoja manda solo el interés, el plazo y la frecuencia', () => {
    const hoja = leer('components/prestamos/FinanciarSaldo.jsx')
    expect(hoja).toContain('body: JSON.stringify({ financiar: true, interes, diasPlazo: vista.diasPlazo, frecuencia })')
    // Y respeta a quien escribe en miles: 200 son $200.000.
    expect(hoja).toContain('montoCrudoConModo(cifra, modoAbreviado)')
    // Y el interés NO viene puesto: se elige.
    expect(hoja).toMatch(/setPct\(''\); setCifra\(''\)/)
  })
})

describe('al terminar, a la cartulina nueva', () => {
  it('sale de la hoja con `salirDeHojaHacia`: cerrar + router.replace no navega', () => {
    /* Pasó en el espejo: la base quedó financiada y la pantalla se quedó en la vieja
       con sus días de atraso. Ver la nota de `salirDeHojaHacia` en HojaInferior. */
    const hoja = leer('components/prestamos/FinanciarSaldo.jsx')
    expect(hoja).toContain('salirDeHojaHacia(router, `/prestamos/${data.id}`)')
    expect(hoja).not.toMatch(/\n\s*router\.replace\(`\/prestamos\//)
  })
})
