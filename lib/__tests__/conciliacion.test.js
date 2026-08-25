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

  // ── EL DIA SIN MOVIMIENTOS ──
  // Reportado en produccion el 4 ago: «con lo que amaneciste $0» debajo de un
  // titular que decia «saldo en caja $3.895.947», en la misma tarjeta. El libro
  // cuadraba al peso; lo que fallaba era que sin asientos no hay «primer
  // asiento» del que leer la apertura.
  it('un dia sin asientos abre con el saldo que se le pasa, no en cero', () => {
    const r = resumirLibro([], 3895947)
    expect(r.apertura).toBe(3895947)
    expect(r.cantidad).toBe(0)
    expect(r.recaudo).toBe(0)
  })

  it('un dia sin asientos cierra donde abrio', () => {
    // Si cerrara en cero, `sinExplicar` daria −3.895.947 y la pantalla
    // inventaria un descuadre enorme el dia que nadie cobra nada.
    const r = resumirLibro([], 3895947)
    expect(r.cierre).toBe(3895947)
    const c = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro: r,
      operaciones: { pagos: 0, gastos: 0, desembolsos: 0 },
    })
    expect(c.diferencias.sinExplicar).toBe(0)
  })

  it('en cuanto hay UN asiento manda el libro, no el saldo que se pasa', () => {
    // El saldo previo es el ultimo recurso. Si el dia tiene asientos, la
    // apertura sale de ellos: re-derivarla es como se cuelan los errores.
    const r = resumirLibro(diaSano(), 999999999)
    expect(r.apertura).toBe(1000000)
  })

  it('sin saldo previo se comporta como antes', () => {
    // Lo llama tambien la vista del cobrador, donde el saldo de la
    // organizacion no es suyo y no se le puede pintar como apertura.
    expect(resumirLibro([]).apertura).toBe(0)
    expect(resumirLibro([], null).apertura).toBe(0)
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

/* ══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠ CORREGIR UN PRÉSTAMO NO ES UN «AJUSTE»: ES PRESTAR MENOS
 *
 *  «Hice una corrección en un crédito y ahora la caja no me cuadra.»
 *                                            — Crediya, 24 ago 2026
 *
 *  Bajó un préstamo de $500.000 a $350.000. El libro escribe TRES asientos —el
 *  desembolso viejo, su reverso y el nuevo— y su caja del día decía:
 *
 *      Lo que prestaste   − $6.782.700     ← con los dos importes dentro
 *      Correcciones       + $500.000
 *      ⚠ Hoy la cuenta no cierra: $500.000 de préstamos que no cuadran
 *
 *  El saldo salía bien, porque la corrección lo devolvía dos renglones más
 *  abajo. Pero le decía que había prestado medio millón de más y le encendía
 *  una alarma por un descuadre que no existe.
 *
 *  `resumirLibro` ya sabía hacer esto con los otros dos reversos de la misma
 *  familia —anular un gasto RESTA de gastos, anular un cobro RESTA del
 *  recaudo— y el del desembolso era el que faltaba.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('⚠ el reverso de una edición resta de LO PRESTADO', () => {
  /* Sus tres asientos, tal como están en la base. */
  const PRESTAMO = 'cmt7c6vm101zo1pl08eese20e'
  const EDICION = [
    { tipo: 'desembolso', monto: 500_000, saldoAnterior: 1_000_000, saldoNuevo: 500_000,
      descripcion: 'Desembolso préstamo a un cliente', referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
    { tipo: 'ajuste', monto: 500_000, saldoAnterior: 500_000, saldoNuevo: 1_000_000,
      descripcion: 'Reverso desembolso - edición préstamo (anterior $500.000)',
      referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
    { tipo: 'desembolso', monto: 350_000, saldoAnterior: 1_000_000, saldoNuevo: 650_000,
      descripcion: 'Desembolso actualizado - edición préstamo ($350.000)',
      referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
  ]

  it('lo prestado es lo que de verdad salió, no la suma de los dos', () => {
    const r = resumirLibro(EDICION)
    expect(r.desembolsos, 'sumaba el importe viejo y el nuevo').toBe(350_000)
    expect(r.ajustes, 'la corrección no es un ajuste suelto').toBe(0)
  })

  it('y el saldo no se mueve: es la misma resta por otro camino', () => {
    const r = resumirLibro(EDICION)
    // Antes: 500.000 prestado + 500.000 de ajuste − 350.000 = −350.000
    // Ahora: 350.000 prestado, 0 de ajuste           = −350.000
    expect(r.recaudo - r.desembolsos - r.gastos + r.ajustes).toBe(-350_000)
    expect(r.saltoAsientos, 'el salto de los asientos lo confirma').toBe(-350_000)
  })

  it('⚠ la alarma se apaga: el libro y las operaciones coinciden', () => {
    /* La cuenta entera de su día, con las cifras de su caja al peso. */
    const libro = resumirLibro([
      ...EDICION,
      ...[1_092_000, 400_000, 733_500, 150_000, 100_000, 100_000, 1_000_000, 357_200, 2_000_000]
        .map((monto, i) => ({ tipo: 'desembolso', monto, saldoAnterior: 9e9 - i, saldoNuevo: 9e9 - i - monto,
          descripcion: 'Desembolso préstamo a un cliente', referenciaTipo: 'prestamo', referenciaId: `p${i}` })),
    ])
    expect(libro.desembolsos, 'lo que de verdad prestó').toBe(6_282_700)
    // Y NO lo que le enseñaba la pantalla.
    expect(libro.desembolsos).not.toBe(6_782_700)

    const c = conciliar({
      alcance: 'organizacion',
      libro,
      operaciones: { pagos: 0, pagosEfectivo: 0, pagosDigital: 0, gastos: 0, desembolsos: 6_282_700 },
    })
    expect(c.diferencias.desembolsos, 'los $500.000 que «no cuadraban»').toBe(0)
    expect(c.diferencias.sinExplicar).toBe(0)
    expect(c.cuadra).toBe(true)
  })

  it('el desembolso ACTUALIZADO sigue contando: es plata que salió', () => {
    /* La otra mitad de la pareja no se toca. Si se le quitara, la corrección
       dejaría al préstamo sin desembolso ninguno. */
    const r = resumirLibro([EDICION[2]])
    expect(r.desembolsos).toBe(350_000)
  })
})

describe('⚠ la corrección que llega DÍAS DESPUÉS no resta de lo prestado de hoy', () => {
  /* La misma salvedad que ya lleva `afectaElFajo`: aquella plata salió en su
     día, y lo que pasa hoy es que vuelve. Restarlo de «lo que prestaste» deja
     el día en negativo.

     No es teórico. Un negocio tecleó $1.000.000.000 donde iban $1.000.000 y lo
     corrigió al día siguiente: medido contra el espejo, su 12 de julio pasaba
     de $1.000.000 a −$999.000.000 en cuanto se restaba sin mirar la fecha. */
  const PRESTAMO = 'prestamo-de-ayer'
  /* ⚠ EL REVERSO DEVUELVE EL IMPORTE ENTERO, NO LA DIFERENCIA. Así está en la
     base de Crediya: desembolso $500.000, reverso $500.000, actualizado
     $350.000. Lo puse como diferencia al escribir esta prueba y la que falló
     fue la prueba, no el código. */
  const TARDIA = [
    { tipo: 'ajuste', monto: 1_000_000_000, saldoAnterior: 4_000_000, saldoNuevo: 1_004_000_000,
      descripcion: 'Reverso desembolso - edición préstamo (anterior $1.000.000.000)',
      referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
    { tipo: 'desembolso', monto: 1_000_000, saldoAnterior: 1_004_000_000, saldoNuevo: 1_003_000_000,
      descripcion: 'Desembolso actualizado - edición préstamo ($1.000.000)',
      referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
  ]

  it('se queda en «correcciones», que es lo que es: capital que vuelve', () => {
    const r = resumirLibro(TARDIA)
    expect(r.desembolsos, 'no puede quedar en negativo').toBe(1_000_000)
    expect(r.desembolsos).not.toBe(-999_000_000)
    expect(r.ajustes).toBe(1_000_000_000)
  })

  it('y el mismo asiento CON su original delante sí resta', () => {
    const conOriginal = [
      { tipo: 'desembolso', monto: 1_000_000_000, saldoAnterior: 1_004_000_000, saldoNuevo: 4_000_000,
        descripcion: 'Desembolso préstamo a un cliente',
        referenciaTipo: 'prestamo', referenciaId: PRESTAMO },
      ...TARDIA,
    ]
    const r = resumirLibro(conOriginal)
    expect(r.desembolsos, 'lo que de verdad se prestó').toBe(1_000_000)
    expect(r.ajustes).toBe(0)
  })
})

describe('⚠ en una RENOVACIÓN el reverso no habla del mismo dinero', () => {
  /* El libro apunta el EFECTIVO ENTREGADO; el reverso de la edición habla del
     CAPITAL ANTERIOR. Son dos cifras distintas y emparejarlas a ciegas inventa
     un descuadre.

     Medido en la base de PRESTA MIL, 25 jun 2026: una renovación con $42.000
     de desembolso llevaba un reverso de $150.000 —el capital viejo— y un
     «actualizado» de $200.000. Restar los $150.000 dejaba el día en −$108.000
     donde estaba en $42.000. */
  const P = 'renovacion-editada'
  const RENOVACION = [
    { tipo: 'desembolso', monto: 42_000, saldoAnterior: 1_000_000, saldoNuevo: 958_000,
      descripcion: 'Desembolso por renovación - un cliente',
      referenciaTipo: 'prestamo', referenciaId: P },
    { tipo: 'ajuste', monto: 150_000, saldoAnterior: 958_000, saldoNuevo: 1_108_000,
      descripcion: 'Reverso desembolso - edición préstamo (anterior $150.000)',
      referenciaTipo: 'prestamo', referenciaId: P },
    { tipo: 'desembolso', monto: 200_000, saldoAnterior: 1_108_000, saldoNuevo: 908_000,
      descripcion: 'Desembolso actualizado - edición préstamo ($200.000)',
      referenciaTipo: 'prestamo', referenciaId: P },
  ]

  it('si el importe no casa al peso, el reverso sigue siendo una corrección', () => {
    const r = resumirLibro(RENOVACION)
    expect(r.desembolsos, 'no se le puede restar un importe que no salió').toBe(242_000)
    expect(r.ajustes).toBe(150_000)
    // Lo que NO puede pasar: quedarse en 92.000 restando los 150.000.
    expect(r.desembolsos).not.toBe(92_000)
  })

  it('el neto del libro es el mismo por los dos caminos', () => {
    const r = resumirLibro(RENOVACION)
    expect(r.recaudo - r.desembolsos + r.ajustes).toBe(-92_000)
    expect(r.saltoAsientos).toBe(-92_000)
  })
})
