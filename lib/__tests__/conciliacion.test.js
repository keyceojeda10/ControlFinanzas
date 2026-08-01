// La conciliacion tiene que poder DECIR QUE NO CUADRA.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// La banda vieja de la caja cuadraba siempre, porque su ultima linea se
// definia como exactamente lo que faltaba para que cuadrara. Esa es la razon
// de que el cliente de 10 cobradores vea una banda perfecta y su plata no le
// aparezca.
//
// Asi que la prueba principal de este modulo no es «suma bien»: es «cuando
// algo esta mal, LO DICE». Un modulo de conciliacion que nunca puede fallar es
// el mismo problema con otro nombre.

import { describe, it, expect } from 'vitest'
import {
  ALCANCE, afectaCaja, esIngreso, resumirLibro, conciliar, lineasDeLaBanda,
  cuentaDelDia, sumarLineas,
} from '../dinero/conciliacion'

const mov = (tipo, monto, saldoAnterior, extra = {}) => ({
  tipo, monto, saldoAnterior, saldoNuevo: saldoAnterior + monto,
  createdAt: new Date('2026-08-01T12:00:00Z'), ...extra,
})

// Un dia sano: se abre con 1.000.000, entran 300.000, se prestan 200.000 y se
// gastan 50.000. Cierra en 1.050.000.
function diaSano() {
  return [
    { ...mov('recaudo', 300000, 1000000), metodoPago: 'efectivo', createdAt: new Date('2026-08-01T10:00:00Z') },
    { ...mov('desembolso', -200000, 1300000), createdAt: new Date('2026-08-01T11:00:00Z'), saldoNuevo: 1100000, monto: 200000 },
    { ...mov('gasto', -50000, 1100000), createdAt: new Date('2026-08-01T12:00:00Z'), saldoNuevo: 1050000, monto: 50000 },
  ]
}

const operacionesSanas = {
  pagos: 300000, pagosEfectivo: 300000, pagosDigital: 0,
  gastos: 50000, desembolsos: 200000,
}

describe('el libro, resumido', () => {
  it('la apertura sale del primer asiento y el cierre del ultimo, no de re-sumar', () => {
    const r = resumirLibro(diaSano())
    expect(r.apertura).toBe(1000000)
    expect(r.cierre).toBe(1050000)
    expect(r.recaudo).toBe(300000)
    expect(r.desembolsos).toBe(200000)
    expect(r.gastos).toBe(50000)
  })

  it('separa el efectivo de la transferencia', () => {
    const r = resumirLibro([
      { ...mov('recaudo', 100000, 0), metodoPago: 'efectivo' },
      { ...mov('recaudo', 60000, 100000), metodoPago: 'transferencia' },
      { ...mov('recaudo', 40000, 160000), metodoPago: null },
    ])
    expect(r.recaudo).toBe(200000)
    expect(r.recaudoEfectivo).toBe(140000)  // lo que no dice nada es efectivo
    expect(r.recaudoDigital).toBe(60000)
  })
})

describe('que asientos movieron efectivo de verdad', () => {
  /* ── EL ERROR QUE COSTO $2.611 MILLONES DE FALSO POSITIVO ────────────────
     La primera vez que busque el «efectivo fantasma» cogi todo ajuste con
     referenciaTipo='pago' y me salieron $2.611 millones: mas que TODO el
     capital en la calle de la plataforma. Dentro venian 823 «Reverso recaudo»
     y 432 «Reverso pago anulado», que son legitimos — plata que entro y luego
     se anulo, y que SI debe salir de la caja. */
  it('el descuento y el interes perdonado NO movieron efectivo', () => {
    expect(afectaCaja({ descripcion: 'Descuento aplicado - préstamo (CUADRE)' })).toBe(false)
    expect(afectaCaja({ descripcion: 'Interés perdonado por pago anticipado - préstamo' })).toBe(false)
    expect(afectaCaja({ descripcion: 'Reverso descuento - préstamo eliminado' })).toBe(false)
  })

  it('pero los reversos de plata que SI entro, si', () => {
    expect(afectaCaja({ descripcion: 'Reverso recaudo - préstamo' })).toBe(true)
    expect(afectaCaja({ descripcion: 'Reverso pago anulado - préstamo' })).toBe(true)
    expect(afectaCaja({ descripcion: 'Pago recibido - préstamo' })).toBe(true)
    expect(afectaCaja({})).toBe(true)
  })

  it('los que no movieron efectivo se cuentan aparte, no se ignoran', () => {
    const r = resumirLibro([
      { ...mov('recaudo', 100000, 0), metodoPago: 'efectivo' },
      { ...mov('ajuste', 50000, 100000), descripcion: 'Descuento aplicado - préstamo', saldoNuevo: 50000 },
    ])
    expect(r.recaudo).toBe(100000)
    expect(r.sinEfecto).toBe(50000)
    expect(r.sinEfectoCantidad).toBe(1)
  })

  it('la direccion de un ajuste sale de los saldos, que es donde el libro la guarda', () => {
    expect(esIngreso({ saldoAnterior: 100, saldoNuevo: 200 })).toBe(true)
    expect(esIngreso({ saldoAnterior: 200, saldoNuevo: 100 })).toBe(false)
  })
})

describe('LA PRUEBA QUE IMPORTA: la banda puede no cuadrar', () => {
  it('un dia sano cuadra y lo dice', () => {
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(diaSano()),
      operaciones: operacionesSanas,
    })
    expect(c.diferencias.sinExplicar).toBe(0)
    expect(c.cuadra).toBe(true)
    expect(c.saldo).toBe(1050000)
  })

  /* Aqui es donde la banda vieja se rompia sin decir nada: el saldo guardado no
     coincide con la suma de los asientos. Pasa cuando algo reescribe el
     historico —`recalcularSaldosCapital` lo hace con cada movimiento
     retroactivo— o cuando se infiere mal la direccion de un ajuste. */
  it('si el saldo guardado no coincide con la suma de los asientos, SALTA', () => {
    const movimientos = diaSano()
    movimientos[2].saldoNuevo = 1_400_000   // alguien reescribio el cierre
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(movimientos),
      operaciones: operacionesSanas,
    })
    expect(c.diferencias.sinExplicar).not.toBe(0)
    expect(c.cuadra).toBe(false)
  })

  it('y el residuo NO se suma al saldo para taparlo', () => {
    const movimientos = diaSano()
    movimientos[2].saldoNuevo = 1_400_000
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(movimientos),
      operaciones: operacionesSanas,
    })
    // El saldo es el del libro, tal cual. No se le añade nada para que encaje.
    expect(c.saldo).toBe(1_400_000)
    expect(c.saldo).toBe(c.libro.cierre)
  })

  it('un pago registrado que el libro no asento sale con nombre propio', () => {
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(diaSano()),
      operaciones: { ...operacionesSanas, pagos: 350000, pagosEfectivo: 350000 },
    })
    expect(c.diferencias.recaudo).toBe(-50000)
    expect(c.brechas.desfaseRegistro).toBe(50000)
    expect(c.cuadra).toBe(false)
  })

  it('un gasto y un desembolso desalineados tambien', () => {
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(diaSano()),
      operaciones: { ...operacionesSanas, gastos: 30000, desembolsos: 250000 },
    })
    expect(c.diferencias.gastos).toBe(20000)
    expect(c.diferencias.desembolsos).toBe(-50000)
  })
})

describe('las tres brechas, cada una con su dueño', () => {
  const base = {
    alcance: ALCANCE.COBRADOR,
    libro: resumirLibro(diaSano()),
    operaciones: operacionesSanas,
  }

  it('lo que el cliente no pago es del CLIENTE', () => {
    const c = conciliar({ ...base, esperado: { esperado: 500000, atrasado: 120000 } })
    expect(c.brechas.incumplimiento).toBe(200000)   // pedia 500.000, entraron 300.000
  })

  it('lo que se registro y no se asento es del SOFTWARE', () => {
    const c = conciliar({ ...base, operaciones: { ...operacionesSanas, pagos: 320000 } })
    expect(c.brechas.desfaseRegistro).toBe(20000)
  })

  it('lo que no aparecio en el fajo es del COBRADOR', () => {
    const c = conciliar({ ...base, fisico: { contado: 280000 } })
    expect(c.brechas.faltanteCaja).toBe(-20000)     // conto 20.000 menos
  })

  /* ── NEQUI NO VA EN EL FAJO ──────────────────────────────────────────────
     En el cliente grande el 12% del recaudo entra por transferencia
     ($35.261.200 en 736 pagos) y la caja lo trata como efectivo. Con eso el
     conteo de la noche no puede cuadrar nunca, y el cobrador aparece con un
     faltante que no es suyo. */
  it('el faltante compara EFECTIVO contra efectivo, no el recaudo total', () => {
    const libro = resumirLibro([
      { ...mov('recaudo', 200000, 0), metodoPago: 'efectivo' },
      { ...mov('recaudo', 100000, 200000), metodoPago: 'transferencia' },
    ])
    const c = conciliar({
      alcance: ALCANCE.COBRADOR,
      libro,
      operaciones: { pagos: 300000, pagosEfectivo: 200000, pagosDigital: 100000, gastos: 0, desembolsos: 0 },
      fisico: { contado: 200000 },
    })
    // Entrego los 200.000 de efectivo: esta cuadrado. Contra el recaudo total
    // habria salido un faltante de 100.000 que no existe.
    expect(c.brechas.faltanteCaja).toBe(0)
  })

  it('sin conteo fisico no se inventa un faltante', () => {
    const c = conciliar({ ...base })
    expect(c.brechas.faltanteCaja).toBeUndefined()
  })
})

describe('el alcance es obligatorio y explicito', () => {
  /* La banda del cobrador mezclaba escalas: `baseInicialDia` y `disponibleHoy`
     eran de TODA la organizacion mientras el cobrado, los gastos y lo prestado
     eran solo suyos. «Ajustes» absorbia la diferencia, que podia ser millones. */
  it('un alcance desconocido no se compone en silencio', () => {
    expect(() => conciliar({
      alcance: 'lo-que-sea',
      libro: resumirLibro(diaSano()),
      operaciones: operacionesSanas,
    })).toThrow(/Alcance desconocido/)
  })

  it('el alcance viaja en el resultado, para que la pantalla no lo adivine', () => {
    const c = conciliar({ alcance: ALCANCE.RUTA, libro: resumirLibro(diaSano()), operaciones: operacionesSanas })
    expect(c.alcance).toBe(ALCANCE.RUTA)
  })
})

describe('LA CUENTA SUMA LO QUE ENSEÑA', () => {
  /* ── TRES VECES ME MORDIO ESTO ──────────────────────────────────────────
     La linea de apertura se pinta SIN signo —«con lo que amaneciste» no es un
     ingreso del dia— y al sumar con `signo * monto` se multiplicaba por cero y
     desaparecia. En pantalla: «726.000 + 161.000 = 161.000».

     Las tres veces llego a la pantalla porque la suma vivia suelta en una ruta
     de API, donde ninguna prueba la alcanza. Por eso ahora esta aqui. */
  it('la apertura entra en la suma aunque se pinte sin signo', () => {
    const c = cuentaDelDia({
      apertura: 726000,
      entradas: [{ id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: 161000 }],
      salidas: [],
    })
    expect(c.suma).toBe(887000)
    expect(c.lineas[0].signo).toBe(0)   // se pinta sin signo...
    expect(c.lineas[0].monto).toBe(726000)  // ...pero cuenta
  })

  it('la suma es exactamente lo que dan las líneas a mano', () => {
    const c = cuentaDelDia({
      apertura: 500000,
      entradas: [{ id: 'recaudoEfectivo', rotulo: 'Cobró', monto: 300000 }],
      salidas: [
        { id: 'desembolsos', rotulo: 'Prestó', monto: 200000 },
        { id: 'gastos', rotulo: 'Gastó', monto: 50000 },
      ],
    })
    expect(c.suma).toBe(550000)   // 500 + 300 − 200 − 50
    // Y a mano, como lo haria el prestamista:
    const aMano = c.lineas.reduce((a, l) => a + (l.signo === 0 ? l.monto : l.signo * l.monto), 0)
    expect(c.suma).toBe(aMano)
  })

  it('las líneas en cero no se pintan, pero la apertura sí aunque sea cero', () => {
    const c = cuentaDelDia({
      apertura: 0,
      entradas: [{ id: 'recaudoEfectivo', rotulo: 'Cobró', monto: 0 }],
      salidas: [{ id: 'gastos', rotulo: 'Gastó', monto: 0 }],
    })
    expect(c.lineas.map((l) => l.id)).toEqual(['apertura'])
    expect(c.suma).toBe(0)
  })

  it('sumarLineas y lineasDeLaBanda dan lo mismo sobre las mismas líneas', () => {
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: resumirLibro(diaSano()),
      operaciones: operacionesSanas,
    })
    const b = lineasDeLaBanda(c)
    expect(sumarLineas(b.lineas)).toBe(b.suma)
  })
})

describe('las lineas de la banda', () => {
  it('suman el saldo cuando el dia esta sano', () => {
    const c = conciliar({ alcance: ALCANCE.ORGANIZACION, libro: resumirLibro(diaSano()), operaciones: operacionesSanas })
    const b = lineasDeLaBanda(c)
    expect(b.suma).toBe(1050000)
    expect(b.cuadra).toBe(true)
  })

  it('y NO cuadran cuando el libro esta descuadrado — sin linea que lo tape', () => {
    const movimientos = diaSano()
    movimientos[2].saldoNuevo = 1_400_000
    const c = conciliar({ alcance: ALCANCE.ORGANIZACION, libro: resumirLibro(movimientos), operaciones: operacionesSanas })
    const b = lineasDeLaBanda(c)
    expect(b.cuadra).toBe(false)
    expect(b.suma).not.toBe(b.saldo)
    // Y no hay ninguna linea llamada «ajuste operativo» que absorba la
    // diferencia: las lineas son las que hubo, ni una mas.
    expect(b.lineas.map(l => l.id)).not.toContain('ajustesOperativos')
  })
})
