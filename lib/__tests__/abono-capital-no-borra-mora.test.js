// lib/__tests__/abono-capital-no-borra-mora.test.js
//
// G6 · Las dos pruebas que `G6-PRIMER-PASO.md` exige ANTES de tocar el filtro:
//
//   1. Tras un abono a capital, `Σ cuota.capital + Σ abonos === montoPrestado`.
//   2. Una cuota vencida y sin pagar conserva LA MISMA FECHA y EL MISMO IMPORTE.
//
// Sin ellas el cambio se cuela roto: el build no lo ve y las 1.869 pruebas
// tampoco, porque hasta hoy ninguna miraba la tabla DESPUÉS de un abono.
//
// Lo que se está fijando es una decisión del dueño, no una preferencia técnica:
// **el atraso se sigue debiendo**. Un cliente con tres cuotas vencidas que
// entrega un abono a capital no queda al día por eso.

import { describe, it, expect } from 'vitest'
import { partirFilasParaAbono, capitalParaFuturas } from '@/lib/dinero/abono-capital'

// Un préstamo de $300.000 en 6 cuotas: capital $50.000 por cuota.
// Hoy es el 15. Las cuotas 1 y 2 (días 5 y 10) ya vencieron; las 3 a 6 no.
const HOY = '2026-08-15T12:00:00Z'
const MONTO_PRESTADO = 300000

const tabla = () => [
  { numeroPeriodo: 1, fechaEsperada: '2026-08-05T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 60000 },
  { numeroPeriodo: 2, fechaEsperada: '2026-08-10T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0 },
  { numeroPeriodo: 3, fechaEsperada: '2026-08-15T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0 },
  { numeroPeriodo: 4, fechaEsperada: '2026-08-20T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0 },
  { numeroPeriodo: 5, fechaEsperada: '2026-08-25T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0 },
  { numeroPeriodo: 6, fechaEsperada: '2026-08-30T05:00:00Z', capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0 },
]

describe('G6 · el abono a capital NO borra la mora', () => {
  it('la cuota vencida y sin pagar NO entra en el lote que se reprograma', () => {
    const { pagadas, vencidas, futuras } = partirFilasParaAbono(tabla(), HOY)
    expect(pagadas.map(f => f.numeroPeriodo)).toEqual([1])
    // La 2 venció el día 10 y sigue debiendo: es atraso, no futuro.
    expect(vencidas.map(f => f.numeroPeriodo)).toEqual([2])
    expect(futuras.map(f => f.numeroPeriodo)).toEqual([3, 4, 5, 6])
  })

  it('el filtro VIEJO metía la vencida con las futuras — ése era el fallo', () => {
    // Se deja escrito para que se vea la diferencia: «futura» estaba definida
    // como «sin pagar», y por eso la 2 se reprogramaba con fecha nueva.
    const comoAntes = tabla().filter(f => (f.pagado || 0) < f.cuotaTotal)
    expect(comoAntes.map(f => f.numeroPeriodo)).toEqual([2, 3, 4, 5, 6])
  })

  it('la que vence HOY todavía no está vencida — el cobrador aún puede pasar', () => {
    const { vencidas, futuras } = partirFilasParaAbono(tabla(), HOY)
    expect(vencidas.map(f => f.numeroPeriodo)).not.toContain(3)
    expect(futuras.map(f => f.numeroPeriodo)).toContain(3)
  })

  it('PRUEBA 1 · la invariante se conserva: Σ capital + Σ abonos === montoPrestado', () => {
    const filas = tabla()
    const abono = 80000
    const { pagadas, vencidas, futuras } = partirFilasParaAbono(filas, HOY)

    // El capital vivo según la tabla: lo que aún no se ha cubierto.
    const capitalAntes = [...vencidas, ...futuras].reduce((a, f) => a + f.capital, 0)
    expect(capitalAntes).toBe(250000)

    const paraFuturas = capitalParaFuturas({ capitalAntesDelAbono: capitalAntes, abono, vencidas })

    // Lo que quedará en la tabla tras reescribir SOLO las futuras.
    const capitalEnTabla =
      pagadas.reduce((a, f) => a + f.capital, 0) +
      vencidas.reduce((a, f) => a + f.capital, 0) +
      paraFuturas

    expect(capitalEnTabla + abono).toBe(MONTO_PRESTADO)
  })

  it('la trampa del documento: sin restar el capital de las vencidas se cuenta dos veces', () => {
    const filas = tabla()
    const abono = 80000
    const { pagadas, vencidas, futuras } = partirFilasParaAbono(filas, HOY)
    const capitalAntes = [...vencidas, ...futuras].reduce((a, f) => a + f.capital, 0)

    // Lo que saldría de partir el filtro y NO tocar el reparto: el capital de
    // las vencidas quedaría en su fila Y repartido otra vez entre las futuras.
    const ingenuo = capitalAntes - abono
    const capitalRoto =
      pagadas.reduce((a, f) => a + f.capital, 0) +
      vencidas.reduce((a, f) => a + f.capital, 0) +
      ingenuo

    expect(capitalRoto + abono).not.toBe(MONTO_PRESTADO)
    // Y se ve exactamente de cuánto es el invento: el capital de la vencida.
    expect(capitalRoto + abono - MONTO_PRESTADO).toBe(50000)
  })

  it('PRUEBA 2 · la cuota vencida conserva su fecha y su importe', () => {
    const antes = tabla().find(f => f.numeroPeriodo === 2)
    const { vencidas } = partirFilasParaAbono(tabla(), HOY)
    const despues = vencidas.find(f => f.numeroPeriodo === 2)

    expect(despues.fechaEsperada).toBe(antes.fechaEsperada)
    expect(despues.cuotaTotal).toBe(antes.cuotaTotal)
    expect(despues.capital).toBe(antes.capital)
    expect(despues.interes).toBe(antes.interes)
  })

  it('un abono que se come todo el capital futuro no deja capital negativo', () => {
    const { vencidas } = partirFilasParaAbono(tabla(), HOY)
    expect(capitalParaFuturas({ capitalAntesDelAbono: 250000, abono: 999999, vencidas })).toBe(0)
  })

  it('sin nada vencido se comporta igual que antes — la migración no mueve a los que van al día', () => {
    // Con todo por vencer, `capitalParaFuturas` da exactamente `vivo − abono`,
    // que es lo que hacía el código viejo. Los préstamos al día no se mueven.
    expect(capitalParaFuturas({ capitalAntesDelAbono: 250000, abono: 80000, vencidas: [] }))
      .toBe(170000)
  })

  it('una fila sin fecha no inventa mora: va con las futuras', () => {
    const filas = [{ numeroPeriodo: 1, fechaEsperada: null, capital: 50000, interes: 0, cuotaTotal: 50000, pagado: 0 }]
    const { vencidas, futuras } = partirFilasParaAbono(filas, HOY)
    expect(vencidas).toHaveLength(0)
    expect(futuras).toHaveLength(1)
  })

  it('una cuota vencida a MEDIO pagar tampoco se reprograma', () => {
    // Es atraso igual: debe la mitad y la fecha ya pasó.
    const filas = tabla()
    filas[1].pagado = 30000
    const { vencidas } = partirFilasParaAbono(filas, HOY)
    expect(vencidas.map(f => f.numeroPeriodo)).toEqual([2])
  })
})
