import { describe, it, expect } from 'vitest'
import { tieneCobroPendienteHoy, calcularDiasMora } from '@/lib/calculos'

// tieneCobroPendienteHoy era la ULTIMA funcion de "hoy" que ignoraba la tabla de
// amortizacion, y por eso se contradecia con la ficha del cliente.
//
// Caso reportado: Decreciente quincenal iniciado el 3 de julio, una cuota pagada.
// La cuenta ingenua daba "1 periodo transcurrido, 1 cuota pagada -> al dia",
// mientras la tabla mostraba la cuota del 24 sin pagar y la tarjeta decia
// "2d Mora · $75.000". El cliente aparecia en "Proximos y al dia" debiendo.

const diaEnBogota = (offsetDias = 0) => {
  const b = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  b.setDate(b.getDate() + offsetDias)
  const y = b.getFullYear()
  const m = String(b.getMonth() + 1).padStart(2, '0')
  const d = String(b.getDate()).padStart(2, '0')
  return new Date(`${y}-${m}-${d}T05:00:00.000Z`)
}

// Decreciente: cuotas que BAJAN. cuotaDiaria guarda solo la primera.
const conTabla = (filas) => ({
  estado: 'activo',
  frecuencia: 'quincenal',
  modoInteres: 'lineal',
  fechaInicio: diaEnBogota(-25),
  diasPlazo: 60,
  cuotaDiaria: 225000,      // la PRIMERA cuota, no las demas
  totalAPagar: 750000,
  totalPagado: filas.reduce((a, f) => a + (f.pagado || 0), 0),
  cuotasAmortizacion: filas,
})

const fila = (n, dias, cuotaTotal, pagado = 0) => ({
  numeroPeriodo: n, fechaEsperada: diaEnBogota(dias),
  capital: cuotaTotal - 25000, interes: 25000, cuotaTotal, pagado, interesPagado: 0,
})

describe('el pendiente de hoy sale de la tabla', () => {
  it('una cuota vencida sin pagar deja el prestamo pendiente', () => {
    // cuota 1 pagada (hace 23 dias), cuota 2 vencida hace 4 dias SIN pagar
    const p = conTabla([
      fila(1, -23, 225000, 225000),
      fila(2, -4, 200000, 0),
      fila(3, +11, 175000, 0),
      fila(4, +26, 150000, 0),
    ])
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(true)
    // y coincide con la mora que muestra la ficha
    expect(calcularDiasMora(p, [], [])).toBeGreaterThan(0)
  })

  it('con todas las vencidas pagadas, no esta pendiente', () => {
    const p = conTabla([
      fila(1, -23, 225000, 225000),
      fila(2, -4, 200000, 200000),
      fila(3, +11, 175000, 0),
      fila(4, +26, 150000, 0),
    ])
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(false)
    expect(calcularDiasMora(p, [], [])).toBe(0)
  })

  it('una cuota vencida a medias sigue pendiente', () => {
    const p = conTabla([
      fila(1, -23, 225000, 225000),
      fila(2, -4, 200000, 120000),
      fila(3, +11, 175000, 0),
      fila(4, +26, 150000, 0),
    ])
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(true)
  })

  it('si aun no vence ninguna cuota, no esta pendiente', () => {
    const p = conTabla([
      fila(1, +3, 225000, 0),
      fila(2, +18, 200000, 0),
    ])
    expect(tieneCobroPendienteHoy(p, [], [])).toBe(false)
  })

  it('en Globo basta con tener el interes del periodo al dia', () => {
    const globo = {
      estado: 'activo', frecuencia: 'mensual', modoInteres: 'solo_interes',
      fechaInicio: diaEnBogota(-40), diasPlazo: 180,
      cuotaDiaria: 600000, totalAPagar: 13600000, totalPagado: 600000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, fechaEsperada: diaEnBogota(-10), capital: 0, interes: 600000, cuotaTotal: 600000, pagado: 0, interesPagado: 600000 },
        { numeroPeriodo: 2, fechaEsperada: diaEnBogota(+20), capital: 0, interes: 600000, cuotaTotal: 600000, pagado: 0, interesPagado: 0 },
      ],
    }
    expect(tieneCobroPendienteHoy(globo, [], [])).toBe(false)
    // pero si NO pago el interes de la vencida, si esta pendiente
    const sinPagar = { ...globo, totalPagado: 0,
      cuotasAmortizacion: globo.cuotasAmortizacion.map((f, i) => i === 0 ? { ...f, interesPagado: 0 } : f) }
    expect(tieneCobroPendienteHoy(sinPagar, [], [])).toBe(true)
  })

  it('un prestamo saldado no aparece', () => {
    const p = conTabla([fila(1, -23, 225000, 225000), fila(2, -4, 200000, 200000)])
    expect(tieneCobroPendienteHoy({ ...p, totalPagado: 750000 }, [], [])).toBe(false)
  })
})
