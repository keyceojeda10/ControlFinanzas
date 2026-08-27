// lib/__tests__/abierto-interes-por-dia.test.js
//
// ══ «NO LE PUEDE ESTIPULAR UN VALOR DE LIQUIDACIÓN CON INTERESES» ══════════
//
// Reunión de una hora con «Prestamos juan», 26 de agosto de 2026:
//
//   «En el modo global, si hay fechas estipuladas, por lo menos seis meses,
//    cuando se le da liquidar préstamo, el sistema puede calcular el valor de
//    la liquidación. Pero al no tener fecha definida, no le puede estipular un
//    valor de liquidación con intereses incluidos, y ese es el hueco.»
//
//   «Si un cliente tiene un préstamo de doscientos mil y lo quiere pagar
//    completo el día de hoy y lleva dieciocho días, veinte días, ¿cómo hace
//    para cobrarle esos intereses? El sistema no le dice cuántos van.»
//
// Y la vuelta de tuerca, que es la que decide el diseño:
//
//   «Hay veces que se pasan dieciocho días y él no quiere cobrar dieciocho días
//    de interés como prorrateo, sino les cobra directamente el mes. O por lo
//    menos que vayan veintisiete días: veintisiete días es prácticamente un
//    mes, entonces no le cobra el prorrateo, sino el mes completo.»
//
// Los demás modos llevan desde siempre esas dos opciones —`mesCompleto` y
// `proporcional`, y la pantalla de liquidación ya sabe pintarlas—. El abierto
// se salía por arriba de `calcularLiquidacionAnticipada` y devolvía una sola
// cifra sin el interés que estaba corriendo.
//
// Medido en el espejo el 26 de agosto: $1.382.667 de interés corriendo en 19
// préstamos suyos que no se veía y no se podía cobrar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { adaptarCerrar } from '@/lib/adaptadores/gestion'
import {
  periodoEnCursoAbierto,
  interesCobrableAhora,
  calcularLiquidacionAnticipada,
  calcularCapitalRestante,
  calcularSaldoPendiente,
} from '@/lib/calculos'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const HOY = new Date('2026-08-26T17:00:00Z')

/* Hugo tío Jonathan, tal cual está en la base: $200.000 al 20% mensual desde el
   8 de julio. Cerró un período el 8 de agosto ($40.000) y lo pagó. Hoy lleva
   18 días del período siguiente — el ejemplo exacto del cliente. */
const HUGO = {
  id: 'hugo', modoInteres: 'solo_interes', sinPlazo: true,
  montoPrestado: 200_000, tasaInteres: 20, frecuencia: 'mensual',
  fechaInicio: '2026-07-08', totalAPagar: 240_000,
  devengos: [{ periodo: '2026-08-08', interes: 40_000, capitalBase: 200_000 }],
  pagos: [{ tipo: 'intereses', montoPagado: 40_000, fechaPago: '2026-08-26' }],
  cuotasAmortizacion: [],
}

describe('el período que está corriendo en un abierto', () => {
  it('sabe cuántos días van y cuánto interés llevan', () => {
    const p = periodoEnCursoAbierto(HUGO, HOY.getTime())
    expect(p.desde.toISOString().slice(0, 10)).toBe('2026-08-08')
    expect(p.hasta.toISOString().slice(0, 10)).toBe('2026-09-08')
    expect(p.dias).toBe(18)
    expect(p.duracion).toBe(31)          // agosto tiene 31 días: mensual = mismo día del mes
    expect(p.capitalBase).toBe(200_000)
    expect(p.interesPeriodo).toBe(40_000)
    expect(p.interesCorrido).toBe(Math.round(40_000 * 18 / 31))  // $23.226
  })

  it('el día del corte no lleva nada corrido', () => {
    const p = periodoEnCursoAbierto(HUGO, new Date('2026-08-08T17:00:00Z').getTime())
    expect(p.dias).toBe(0)
    expect(p.interesCorrido).toBe(0)
    // Pero el mes se le puede cobrar entero desde el primer día, igual que en
    // el camino con tabla: a quien le pagan por adelantado no se le dice que no.
    expect(p.interesPeriodo).toBe(40_000)
  })

  it('leerlo NO mueve la deuda', () => {
    const antes = HUGO.totalAPagar
    periodoEnCursoAbierto(HUGO, HOY.getTime())
    expect(HUGO.totalAPagar).toBe(antes)
    expect(calcularSaldoPendiente(HUGO)).toBe(200_000)
  })

  it('un abono a capital baja el interés del período en curso', () => {
    const conAbono = {
      ...HUGO, montoPrestado: 1_000_000, tasaInteres: 10, fechaInicio: '2026-08-01',
      totalAPagar: 1_000_000, devengos: [],
      pagos: [{ tipo: 'capital', montoPagado: 400_000, fechaPago: '2026-08-10' }],
    }
    expect(calcularCapitalRestante(conAbono)).toBe(600_000)
    // Sobre $600.000 vivos al 10%, no sobre el millón prestado.
    expect(periodoEnCursoAbierto(conAbono, HOY.getTime()).interesPeriodo).toBe(60_000)
  })

  it('un pago de solo intereses NO baja el capital, así que el interés sigue corriendo igual', () => {
    // HUGO ya trae un pago de intereses de $40.000 y su capital sigue entero.
    expect(calcularCapitalRestante(HUGO)).toBe(200_000)
    expect(periodoEnCursoAbierto(HUGO, HOY.getTime()).interesPeriodo).toBe(40_000)
  })
})

describe('cuánto interés se le puede recibir hoy', () => {
  it('lo que ya cerró sin pagar, más el período que corre entero', () => {
    /* Richar: $4.000.000 al 20% desde el 4 de mayo, tres períodos cerrados y
       ninguno pagado. Puede recibirle los tres ($2.400.000) y además el mes
       que corre ($800.000), que es lo que hace cuando el cliente aparece. */
    const richar = {
      id: 'richar', modoInteres: 'solo_interes', sinPlazo: true,
      montoPrestado: 4_000_000, tasaInteres: 20, frecuencia: 'mensual',
      fechaInicio: '2026-05-04', totalAPagar: 6_400_000, pagos: [], cuotasAmortizacion: [],
      devengos: [
        { periodo: '2026-06-04', interes: 800_000, capitalBase: 4_000_000 },
        { periodo: '2026-07-04', interes: 800_000, capitalBase: 4_000_000 },
        { periodo: '2026-08-04', interes: 800_000, capitalBase: 4_000_000 },
      ],
    }
    expect(interesCobrableAhora(richar)).toBe(3_200_000)
  })

  it('un pago «completo» también cuenta como interés pagado', () => {
    /* Cristian Pérez: 7 meses devengados ($2.800.000) y un pago de $2.800.000
       registrado como «completo». Está al día. Contando solo los pagos con la
       etiqueta 'intereses', el sistema ofrecía volver a cobrarle los
       $2.800.000 — un interés ya pagado. */
    const cristian = {
      id: 'cristian', modoInteres: 'solo_interes', sinPlazo: true,
      montoPrestado: 4_000_000, tasaInteres: 10, frecuencia: 'mensual',
      fechaInicio: '2026-01-22', totalAPagar: 6_800_000, cuotasAmortizacion: [],
      pagos: [{ tipo: 'completo', montoPagado: 2_800_000, fechaPago: '2026-08-26' }],
      devengos: Array.from({ length: 7 }, (_, i) => ({
        periodo: `2026-0${i + 2}-22`, interes: 400_000, capitalBase: 4_000_000,
      })),
    }
    expect(calcularCapitalRestante(cristian)).toBe(4_000_000)
    // Nada atrasado; solo el mes que corre.
    expect(interesCobrableAhora(cristian)).toBe(400_000)
  })
})

describe('liquidar un abierto: las dos opciones', () => {
  const liq = calcularLiquidacionAnticipada(HUGO, HOY)

  it('cobrando el mes completo', () => {
    // Los $200.000 de capital más el mes entero.
    expect(liq.mesCompleto.restanteHoy).toBe(240_000)
    expect(liq.mesCompleto.interesDevengado).toBe(40_000)
    expect(liq.mesCompleto.interesPerdonado).toBe(0)
  })

  it('cobrando solo los días corridos', () => {
    const corrido = Math.round(40_000 * 18 / 31)          // $23.226
    expect(liq.proporcional.restanteHoy).toBe(200_000 + corrido)
    expect(liq.proporcional.interesPerdonado).toBe(40_000 - corrido)
  })

  it('lo ya devengado NO se perdona en ninguna de las dos', () => {
    /* Richar debe tres meses cerrados. Cancelar hoy cuesta el capital MÁS esos
       tres meses, cobre el cuarto entero o prorrateado. Perdonar interés ya
       devengado sería el descuento inventado que este mismo fichero llevaba
       advertido desde agosto. */
    const richar = {
      id: 'richar', modoInteres: 'solo_interes', sinPlazo: true,
      montoPrestado: 4_000_000, tasaInteres: 20, frecuencia: 'mensual',
      fechaInicio: '2026-05-04', totalAPagar: 6_400_000, pagos: [], cuotasAmortizacion: [],
      devengos: [
        { periodo: '2026-06-04', interes: 800_000, capitalBase: 4_000_000 },
        { periodo: '2026-07-04', interes: 800_000, capitalBase: 4_000_000 },
        { periodo: '2026-08-04', interes: 800_000, capitalBase: 4_000_000 },
      ],
    }
    const l = calcularLiquidacionAnticipada(richar, HOY)
    expect(l.proporcional.restanteHoy).toBeGreaterThanOrEqual(6_400_000)
    expect(l.mesCompleto.restanteHoy).toBe(6_400_000 + 800_000)
    // Lo que se perdona al prorratear son SOLO los días del mes en curso que
    // no han corrido, nunca los tres meses cerrados.
    expect(l.proporcional.interesPerdonado)
      .toBe(800_000 - Math.round(800_000 * 22 / 31))
  })

  it('a 27 días, el mes completo apenas se separa del prorrateo', () => {
    // «Veintisiete días es prácticamente un mes»: el prestamista elige.
    const l = calcularLiquidacionAnticipada(HUGO, new Date('2026-09-04T17:00:00Z'))
    expect(l.periodoEnCurso.dias).toBe(27)
    expect(l.mesCompleto.restanteHoy - l.proporcional.restanteHoy)
      .toBe(40_000 - Math.round(40_000 * 27 / 31))
  })

  it('el atajo «cancelar hoy» cuesta lo prorrateado', () => {
    // La hoja de pago lee estos tres planos, no las modalidades.
    expect(liq.restanteHoy).toBe(liq.proporcional.restanteHoy)
    expect(liq.interesPerdonado).toBe(liq.proporcional.interesPerdonado)
    expect(liq.aplica).toBe(true)
  })
})

describe('cobrar el período en curso adelanta el corte', () => {
  const src = leer('app/api/prestamos/[id]/pagos/route.js')

  it('el pago asienta el período con la fecha de cierre como clave', () => {
    expect(src).toContain('periodo: enCurso.periodo,')
    expect(src).toContain('totalAPagar: { increment: aAsentar }')
  })

  it('cobrando interés se cierra el período ENTERO; liquidando, solo lo cobrado', () => {
    expect(src).toContain("const aAsentar = tipo === 'liquidacion'")
    expect(src).toContain('? Math.min(enCurso.interesPeriodo, pideDelPeriodo)')
    expect(src).toContain(': enCurso.interesPeriodo')
  })

  it('la liquidación puede pasar del saldo por el interés que corre', () => {
    expect(src).toContain('const techoLiquidacion = saldoActual + (esAbiertoConDevengo(prestamo)')
  })

  it('un choque con la clave única no es un error', () => {
    expect(src).toContain("if (e?.code !== 'P2002') throw e")
  })
})

describe('la pantalla de cerrar, en un abierto', () => {
  it('ofrece las dos, y NO ofrece «todo lo pactado»', () => {
    const c = adaptarCerrar(calcularLiquidacionAnticipada(HUGO, HOY))
    expect(c.opciones.map((o) => o.id).sort()).toEqual(['mesCompleto', 'proporcional'])
    // Un abierto no tiene final del plazo, y su saldo pelado ($200.000) saldría
    // la opción más barata: cerrarlo sin cobrar el mes que corre.
    expect(c.opciones.some((o) => o.monto === 200_000)).toBe(false)
    expect(c.sinEleccion).toBe(false)
  })

  it('en los demás modos «todo lo pactado» sigue estando', () => {
    const conTabla = {
      modo: 'fijo', saldoActual: 500_000, aproximado: false,
      mesCompleto:  { restanteHoy: 480_000, interesPerdonado: 20_000, interesDevengado: 80_000 },
      proporcional: { restanteHoy: 460_000, interesPerdonado: 40_000, interesDevengado: 60_000 },
    }
    expect(adaptarCerrar(conTabla).opciones.map((o) => o.id)).toContain('todo')
  })
})
