import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '@/lib/calculos'

/* ══════════════════════════════════════════════════════════════════════════
   EL PRÉSTAMO ABIERTO — la aritmética, fijada ANTES de escribir el código.

   El caso que trajo el usuario nuevo, y que ya viven 25 negocios forzando el
   plazo de Globo:

     presta $690.000 al 10% mensual
     el cliente paga $69.000 cada mes y el capital queda quieto
     cuando puede, abona a capital; el mes siguiente paga menos interés
     no hay fecha de vencimiento: se acaba cuando el capital llega a cero

   ⚠ ESTAS PRUEBAS SE ESCRIBEN PRIMERO Y FALLAN. Es a propósito: la condición
   que puso el dueño fue «que no sea agregar un modo y estar un mes
   encontrándole fallos», y la única forma de cumplirla es decidir el número
   correcto antes de tener código que lo justifique.
   ══════════════════════════════════════════════════════════════════════════ */

/** El préstamo del caso, tal como se crearía. */
const ABIERTO = {
  montoPrestado: 690_000,
  tasaInteres: 10,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  sinPlazo: true,
  fechaInicio: '2026-01-15',
}

describe('al crearlo', () => {
  it('la cuota es el interés del período, no una cuota que amortiza', () => {
    const c = calcularPrestamo({ ...ABIERTO })
    expect(c.cuotaDiaria).toBe(69_000)
  })

  it('la deuda arranca siendo SOLO el capital', () => {
    /* El interés del primer mes todavía no se debe: se debe cuando el mes
       acaba. Meterlo en el total desde el día uno sería cobrar por adelantado
       algo que nadie pactó. */
    const c = calcularPrestamo({ ...ABIERTO })
    expect(c.totalAPagar).toBe(690_000)
  })

  it('no lleva tabla de amortización: no hay períodos que listar', () => {
    /* Y no es un detalle: `tieneTablaAmortizacion` exige filas, así que sin
       tabla los 89 sitios que ramifican por modo caen solos en el camino
       «sin tabla» en vez de leer una tabla inventada. */
    const c = calcularPrestamo({ ...ABIERTO })
    expect(c.tablaAmortizacion ?? []).toHaveLength(0)
  })

  it('no exige plazo: con plazo o sin él, el capital y la cuota son los mismos', () => {
    const sin = calcularPrestamo({ ...ABIERTO })
    const conPlazoIgnorado = calcularPrestamo({ ...ABIERTO, diasPlazo: 180 })
    expect(conPlazoIgnorado.cuotaDiaria).toBe(sin.cuotaDiaria)
    expect(conPlazoIgnorado.totalAPagar).toBe(sin.totalAPagar)
  })
})

describe('el Globo de siempre no se entera', () => {
  /* La red de seguridad de todo esto: sin la bandera, el resultado tiene que
     ser EL MISMO de hoy. Si esta prueba se mueve, se movieron los 195 vivos. */
  const CERRADO = { ...ABIERTO, sinPlazo: false, diasPlazo: 180 }

  it('sigue armando su tabla de 6 meses', () => {
    const c = calcularPrestamo(CERRADO)
    expect(c.tablaAmortizacion).toHaveLength(6)
  })

  it('y la última cuota sigue trayendo el capital', () => {
    const c = calcularPrestamo(CERRADO)
    const ultima = c.tablaAmortizacion[5]
    expect(ultima.capital).toBe(690_000)
    expect(ultima.interes).toBe(69_000)
  })

  it('el total sigue siendo capital + los seis intereses', () => {
    const c = calcularPrestamo(CERRADO)
    expect(c.totalAPagar).toBe(690_000 + 6 * 69_000)
  })

  it('sin la bandera se comporta igual que sin el campo', () => {
    const conFalse = calcularPrestamo({ ...ABIERTO, sinPlazo: false, diasPlazo: 180 })
    const sinCampo = calcularPrestamo({ ...ABIERTO, sinPlazo: undefined, diasPlazo: 180 })
    expect(conFalse.totalAPagar).toBe(sinCampo.totalAPagar)
    expect(conFalse.cuotaDiaria).toBe(sinCampo.cuotaDiaria)
  })
})

describe('la bandera es exclusiva de Globo', () => {
  it('en cualquier otro modo se ignora, no cambia el resultado', () => {
    /* Para que el radio de impacto sea un modo y no la app entera. Si algún
       día alguien la manda en un préstamo clásico, no puede pasar nada. */
    for (const modo of ['fijo', 'unico', 'saldo', 'lineal', 'lineal_dinamico']) {
      const base = { ...ABIERTO, modoInteres: modo, diasPlazo: 180, sinPlazo: false }
      const conBandera = calcularPrestamo({ ...base, sinPlazo: true })
      const sinBandera = calcularPrestamo(base)
      expect(conBandera.totalAPagar, `modo ${modo}`).toBe(sinBandera.totalAPagar)
      expect(conBandera.cuotaDiaria, `modo ${modo}`).toBe(sinBandera.cuotaDiaria)
    }
  })
})
