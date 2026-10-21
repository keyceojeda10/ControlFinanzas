/* Crediya, 21 oct 2026: «este cliente a pesar que ha cancelado, la tabla de
   préstamos no se actualiza». Sobre saldo, $602.000 al 15,6% en 5 quincenas:
   pagó la 1 y la 2, y $100.000 de la 3. La base lo tenía bien (pagado 100.000
   en la fila 3); la tabla pintaba solo el plan. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adaptarTabla } from '@/lib/adaptadores/tabla'

const d = (s) => `${s}T05:00:00.000Z`
const prestamo = {
  modoInteres: 'saldo', frecuencia: 'quincenal', montoPrestado: 602000, tasaInteres: 15.6,
  totalAPagar: 749888, totalPagado: 400000, cliente: { nombre: 'Cliente' },
  cuotasAmortizacion: [
    { numeroPeriodo: 1, capital: 103044, interes: 46956, cuotaTotal: 150000, saldoRestante: 498956, pagado: 150000, interesPagado: 0, fechaEsperada: d('2026-08-30') },
    { numeroPeriodo: 2, capital: 111081, interes: 38919, cuotaTotal: 150000, saldoRestante: 387875, pagado: 150000, interesPagado: 0, fechaEsperada: d('2026-09-14') },
    { numeroPeriodo: 3, capital: 119746, interes: 30254, cuotaTotal: 150000, saldoRestante: 268129, pagado: 100000, interesPagado: 0, fechaEsperada: d('2026-09-29') },
    { numeroPeriodo: 4, capital: 129086, interes: 20914, cuotaTotal: 150000, saldoRestante: 139043, pagado: 0, interesPagado: 0, fechaEsperada: d('2026-10-14') },
    { numeroPeriodo: 5, capital: 139043, interes: 10845, cuotaTotal: 149888, saldoRestante: 0, pagado: 0, interesPagado: 0, fechaEsperada: d('2026-10-29') },
  ],
}

describe('la tabla dice qué cuota está pagada y cuánto entró a la que va a medias', () => {
  const t = adaptarTabla(prestamo, 'co')
  it('las dos primeras, pagadas; la 3 a medias y siguiente', () => {
    expect(t.cuotas.map((c) => c.pagada)).toEqual([true, true, false, false, false])
    expect(t.cuotas[2]).toMatchObject({ siguiente: true, abonado: '$100.000', falta: '$50.000', faltanteNum: 50000 })
  })
  it('sin abono no dice nada; la pagada tampoco repite cifras', () => {
    expect(t.cuotas[3].abonado).toBeNull()
    expect(t.cuotas[0].abonado).toBeNull()
  })
  it('al peso: lo pagado más lo que falta da la deuda', () => {
    // 400.000 pagados = 150.000 + 150.000 + 100.000; faltan 50.000 + 150.000 + 149.888 = 349.888.
    const falta = t.cuotas.reduce((a, c) => a + c.faltanteNum, 0)
    expect(falta).toBe(749888 - 400000)
  })
  it('el texto para compartir lo dice también', () => {
    expect(t.textoParaCompartir).toContain('pagó $100.000, faltan $50.000')
    expect(t.textoParaCompartir).toMatch(/Quincena 1 · .* · pagada/)
  })
  it('la pantalla pinta «Pagada» y «Pagó … · faltan …»', () => {
    const jsx = readFileSync('components/pantallas/TablaAmortizacion.jsx', 'utf8')
    expect(jsx).toContain('{c.pagada && <Pastilla style={{ order: 1 }}>Pagada</Pastilla>}')
    expect(jsx).toMatch(/Pagó <strong[^>]*>\{c\.abonado\}<\/strong> · faltan <strong[^>]*>\{c\.falta\}<\/strong>/)
  })
})
