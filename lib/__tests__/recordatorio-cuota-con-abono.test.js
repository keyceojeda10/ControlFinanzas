// lib/__tests__/recordatorio-cuota-con-abono.test.js
//
// ══ EL RECIBO DICE «$3.000 A LA PRÓXIMA CUOTA» Y EL RECORDATORIO NO LO RESTA ═
//
// «Cuando el cliente paga un valor más alto que la cuota —cuota $187.000,
//  pagado $190.000— si bien muestra el valor del excedente y su aplicación en
//  descontar de la siguiente cuota, $187.000 − $3.000 = $184.000, cuando se
//  envía el cobro no se actualiza el valor de la cuota ya descontado sino que
//  se muestra el valor de la cuota SIN descuento.»
//                                   — Préstamos Rincón, 23 ago 2026, 2 capturas
//
// Las dos cifras salían del mismo préstamo por dos caminos:
//
//   `obtenerProximaCuotaTabla`  calcula `faltante = cuotaTotal − pagado`  ← 184.000
//   `obtenerCuotaPeriodoActual` devuelve `cuotaTotal` a secas             ← 187.000
//
// El recordatorio de WhatsApp iba por el segundo, así que el recibo le promete
// al deudor que le descuentan $3.000 y el mensaje siguiente le pide los
// $187.000 enteros. Medido en el espejo: 31 de 403 préstamos vivos con tabla,
// en 11 negocios, con $297.439 de más de media.
//
// ⚠ `obtenerCuotaPeriodoActual` NO SE TOCA: por ahí pasa «lo esperado del día»
//   de la caja, y ahí el abono de HOY ya lo cuenta `recogida`.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cuotaProximoCobro, obtenerCuotaPeriodoActual } from '@/lib/calculos'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Su caso, con las cifras que escribió. La fila 2 lleva encima los $3.000 que
   sobraron del pago de la fila 1. */
/* ⚠ El modo se llama `'saldo'`, no `'sobre_saldo'`: la pantalla dice «Sobre
   saldo» y el enum no. Con el nombre de la pantalla `tieneTablaAmortizacion`
   dice que NO y la prueba mide otro camino — pasó al escribir esto. */
const CON_EXCEDENTE = {
  modoInteres: 'saldo',
  cuotaDiaria: 187_000,
  saldoPendiente: 1_000_000,
  cuotasAmortizacion: [
    { numeroPeriodo: 1, cuotaTotal: 187_000, pagado: 187_000, interes: 50_000, interesPagado: 50_000 },
    { numeroPeriodo: 2, cuotaTotal: 187_000, pagado: 3_000, interes: 48_000, interesPagado: 0 },
    { numeroPeriodo: 3, cuotaTotal: 187_000, pagado: 0, interes: 46_000, interesPagado: 0 },
  ],
}

describe('⚠ el recordatorio pide lo que de verdad falta', () => {
  it('la cuota del próximo cobro descuenta lo ya abonado', () => {
    expect(cuotaProximoCobro(CON_EXCEDENTE), 'pedía la cuota entera').toBe(184_000)
    expect(cuotaProximoCobro(CON_EXCEDENTE)).not.toBe(187_000)
  })

  it('sin abono encima, sigue siendo la cuota entera', () => {
    const limpio = {
      ...CON_EXCEDENTE,
      cuotasAmortizacion: CON_EXCEDENTE.cuotasAmortizacion.map((f) =>
        f.numeroPeriodo === 2 ? { ...f, pagado: 0 } : f),
    }
    expect(cuotaProximoCobro(limpio)).toBe(187_000)
  })

  it('⚠ «lo esperado del día» NO se mueve', () => {
    /* Si el abono es de hoy, `recogida` ya lo cuenta: descontarlo también del
       esperado lo restaría dos veces y el cumplimiento saldría mejor de lo que
       es. Son dos preguntas distintas y por eso son dos funciones. */
    expect(obtenerCuotaPeriodoActual(CON_EXCEDENTE)).toBe(187_000)
    const esperado = leer('lib/dinero/esperado.js')
    expect(esperado).toMatch(/obtenerCuotaPeriodoActual\(prestamo\)/)
    expect(esperado, 'esperado no puede pasar por la otra').not.toMatch(/cuotaProximoCobro/)
  })

  it('en modo Globo se pide el interés que falta, no el del período entero', () => {
    const globo = {
      modoInteres: 'solo_interes',
      cuotaDiaria: 100_000,
      saldoPendiente: 5_000_000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, cuotaTotal: 100_000, pagado: 30_000, interes: 100_000, interesPagado: 30_000 },
        { numeroPeriodo: 2, cuotaTotal: 5_100_000, pagado: 0, interes: 100_000, interesPagado: 0 },
      ],
    }
    expect(cuotaProximoCobro(globo)).toBe(70_000)
  })

  it('un período con el interés ya cubierto no pide $0', () => {
    /* Un cero en el recordatorio no informa; se cae al faltante de la fila. */
    const raro = {
      modoInteres: 'solo_interes',
      cuotaDiaria: 100_000,
      saldoPendiente: 5_000_000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, cuotaTotal: 150_000, pagado: 100_000, interes: 100_000, interesPagado: 100_000 },
        { numeroPeriodo: 2, cuotaTotal: 5_100_000, pagado: 0, interes: 100_000, interesPagado: 0 },
      ],
    }
    expect(cuotaProximoCobro(raro)).toBe(50_000)
  })

  it('el recordatorio de WhatsApp sale de esta función', () => {
    /* Anclado en la expresión, no en la frase: el texto del mensaje lo edita
       el prestamista y una prueba que mire la frase pasa mirando un comentario. */
    const pl = leer('lib/whatsapp-plantillas.js')
    expect(pl).toMatch(/const cuotaMostrar = cuotaProximoCobro\(prestamo\)/)
    expect(pl).toMatch(/formatMoney\(cuotaMostrar\)/)
  })
})

/* ⚠ EL EFECTO COLATERAL QUE CASI SE CUELA ────────────────────────────────
   `excedenteDelPago` preguntaba la cuota con la MISMA función que el
   recordatorio. Al empezar ésta a descontar lo ya abonado, el excedente del
   recibo se doblaba: los mismos $3.000, contados dos veces.

   Son dos preguntas distintas. El recordatorio pregunta «cuánto falta»; el
   recibo, «de lo que acaba de entregar, cuánto sobró» — y eso se mide contra
   lo que se le debía ANTES. */
describe('⚠ el excedente del recibo no se dobla', () => {
  it('sobre la cuota del período, no sobre lo que queda', () => {
    const pl = readFileSync(resolve(process.cwd(), 'lib/whatsapp-plantillas.js'), 'utf8')
    const i = pl.indexOf('function excedenteDelPago')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = pl.slice(i, i + 1200)
    expect(cuerpo, 'volvió el doble conteo').toMatch(/const cuota = obtenerCuotaPeriodoActual\(prestamo\)/)
    expect(cuerpo).not.toMatch(/const cuota = cuotaProximoCobro\(prestamo\)/)
  })

  it('la cuenta de su caso, al peso', () => {
    /* Cuota $187.000, pagó $190.000, y la fila siguiente ya lleva los $3.000
       encima. El excedente son $3.000, no $6.000. */
    const cuota = obtenerCuotaPeriodoActual(CON_EXCEDENTE)   // 187.000
    expect(190_000 - cuota).toBe(3_000)
    expect(190_000 - cuotaProximoCobro(CON_EXCEDENTE), 'lo que habría dicho').toBe(6_000)
  })
})
