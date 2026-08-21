import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { desembolsosOriginalesDelDia, afectaElFajo, cuentaDelDia } from '@/lib/dinero/conciliacion'

/* ══════════════════════════════════════════════════════════════════════════
   «ENTONCES ME APARECIERON 40 MIL PESOS. YA LAS CUENTAS NO VAN A CUADRAR»
   PRESTA MIL, en nota de voz, 20 de agosto de 2026.

   Eliminó un préstamo que el cobrador había hecho dos veces al mismo cliente,
   y a la mañana siguiente su caja decía:

       Con lo que salió        $500.000    (anoche contó $500.000)
       Cobró en efectivo             $0
       Correcciones a favor     $40.000
       Prestó en efectivo            $0
       ─────────────────────────────────
       Tiene que entregar      $540.000

   El cobrador llevaba $500.000 encima. Los $40.000 no existían.

   Reconstruido de su base, el préstamo era el de MARIA GÓMEZ, ruta #10:

       14 ago 21:28   desembolso     −$50.000   salió de su fajo ESE día
       20 ago 00:29   pago recibido  +$10.000   entró a su fajo HOY
       20 ago 00:40   se elimina el préstamo
                        Reverso desembolso  +$50.000
                        Reverso recaudo     −$10.000

   Dos fallos en el mismo renglón: los $50.000 volvían a entrar seis días
   después de haber salido, y los $10.000 se restaban DOS VECES —una porque el
   pago se borra y desaparece de «Cobró en efectivo», otra por el reverso—.

   ⚠ Y NO ERA EL CASO RARO: 291 asientos así en 122 cajas de cobrador-día en
   30 días de producción. La peor, esa misma ruta #10 el 14 de agosto, con
   $18.839.800 de «correcciones a favor» que nunca fueron billetes.
   ══════════════════════════════════════════════════════════════════════════ */

/** Los asientos tal como los guardó su base ese día. */
const REVERSO_DESEMBOLSO = {
  tipo: 'ajuste', monto: 50_000, saldoAnterior: 17_557_482, saldoNuevo: 17_607_482,
  metodoPago: null, descripcion: 'Reverso desembolso - préstamo eliminado (MARIA GÓMEZ)',
}
const REVERSO_RECAUDO = {
  tipo: 'ajuste', monto: 10_000, saldoAnterior: 17_607_482, saldoNuevo: 17_597_482,
  metodoPago: null, descripcion: 'Reverso recaudo - préstamo eliminado',
}

/** El delta con signo, igual que el API. */
const delta = (m) => (m.saldoNuevo >= m.saldoAnterior ? m.monto : -m.monto)
const alFajo = (movs) => movs.filter(afectaElFajo).reduce((a, m) => a + delta(m), 0)
const alCapital = (movs) => movs.reduce((a, m) => a + delta(m), 0)

describe('el préstamo eliminado de PRESTA MIL', () => {
  const asientos = [REVERSO_DESEMBOLSO, REVERSO_RECAUDO]

  it('ninguno de los dos reversos es plata en la mano del cobrador', () => {
    expect(afectaElFajo(REVERSO_DESEMBOLSO)).toBe(false)
    expect(afectaElFajo(REVERSO_RECAUDO)).toBe(false)
  })

  it('los $40.000 que él vio NO entran al fajo', () => {
    expect(alFajo(asientos)).toBe(0)
    // La prueba de que el caso está bien montado: contándolos sale su cifra.
    expect(alCapital(asientos)).toBe(40_000)
  })

  it('«Tiene que entregar» vuelve a ser los $500.000 que lleva encima', () => {
    const cuenta = (ajustes) => cuentaDelDia({
      apertura: 500_000,
      entradas: [
        { id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: 0 },
        { id: 'correccionesMas', rotulo: 'Correcciones a favor', monto: ajustes > 0 ? ajustes : 0 },
      ],
      salidas: [
        { id: 'desembolsos', rotulo: 'Prestó en efectivo', monto: 0 },
        { id: 'correccionesMenos', rotulo: 'Correcciones en contra', monto: ajustes < 0 ? -ajustes : 0 },
      ],
    }).suma
    expect(cuenta(alFajo(asientos))).toBe(500_000)
    // Antes del arreglo daba los $540.000 de la captura.
    expect(cuenta(alCapital(asientos))).toBe(540_000)
  })

  it('el capital de la ruta SÍ se lleva la corrección: el asiento está bien', () => {
    /* El préstamo dejó de estar en la calle, así que esa plata vuelve a la
       bolsa. Lo que estaba mal era pedírsela al cobrador, no el asiento. */
    expect(alCapital(asientos)).toBe(40_000)
  })
})

describe('qué mueve el fajo y qué solo mueve el libro', () => {
  const conSaldos = (descripcion, extra = {}) => ({
    descripcion, monto: 100_000, saldoAnterior: 1_000_000, saldoNuevo: 1_100_000, ...extra,
  })

  it('lo que el sistema se corrige a sí mismo, no', () => {
    for (const d of [
      'Reverso desembolso - préstamo eliminado (X)',
      'Reverso recaudo - préstamo eliminado',
      'Reverso pago anulado - préstamo',
      'Reverso gasto eliminado: Gasolina',
      'Cancelación préstamo - devuelve todo a caja (OMAR)',
      'Tarjeta clavo - préstamo perdido',
      'Corrección renovación: el desembolso decía $54.839 y salieron $44.000',
      'Descuento aplicado - préstamo (Descuento)',
    ]) {
      expect(afectaElFajo(conSaldos(d)), d).toBe(false)
    }
  })

  it('⚠ PERO el reverso de una EDICIÓN sí: va en pareja con su desembolso', () => {
    /* Lo tenía en la lista de arriba, y contra la base de producción se ve que
       estaba mal. Editar el monto de un préstamo escribe DOS asientos en la
       misma milésima:
    
           Desembolso préstamo a ALEXYA               −$250.000  (al crearlo)
           Reverso desembolso - edición préstamo      +$250.000  ┐ pareja
           Desembolso actualizado - edición préstamo  −$300.000  ┘
    
       `Desembolso actualizado` NO está en la lista negra —resta el monto NUEVO
       completo—, así que excluyendo solo el reverso el fajo veía −$550.000
       donde salieron $300.000: le restaba el préstamo entero DOS VECES.
    
       Medido sobre 60 días de producción: 39 parejas, 26 días, **15
       organizaciones**. */
    const hoy = new Set(['p1'])
    expect(afectaElFajo({ ...conSaldos('Reverso desembolso - edición préstamo (anterior $6.000.000)'), referenciaId: 'p1' }, hoy)).toBe(true)
    expect(afectaElFajo({ ...conSaldos('Desembolso actualizado - edición préstamo ($300.000)'), referenciaId: 'p1' }, hoy)).toBe(true)
  })

  it('la pareja de edición deja en el fajo lo que de verdad salió', () => {
    // −250 (original) +250 (reverso) −300 (actualizado) = −300. Al peso.
    const asientos = [
      { d: 'Desembolso préstamo a ALEXYA',                              delta: -250_000 },
      { d: 'Reverso desembolso - edición préstamo (anterior $250.000)', delta: +250_000 },
      { d: 'Desembolso actualizado - edición préstamo ($300.000)',      delta: -300_000 },
    ]
    const movs = asientos.map((a) => ({ ...conSaldos(a.d), referenciaId: 'p1' }))
    const hoy = desembolsosOriginalesDelDia(movs)
    const neto = asientos
      .filter((a, i) => afectaElFajo(movs[i], hoy))
      .reduce((t, a) => t + a.delta, 0)
    expect(neto, 'el préstamo se restó dos veces').toBe(-300_000)
  })

  it('⚠ pero si la corrección llega DÍAS DESPUÉS, la pareja no toca el fajo', () => {
    /* El billete ya salió en su día; moverlo hoy inventa un descuadre. Y no es
       teórico: en producción hay tres casos de un cero de más al teclear —uno
       de $1.000.000.000 donde iban $1.000.000— que le habrían enseñado al
       cobrador «te sobran 999 millones» el día de la corrección.

       Hoy solo están los dos asientos de la pareja: no hay desembolso original
       en la lista, así que ninguno cuenta. */
    const movs = [
      { ...conSaldos('Reverso desembolso - edición préstamo (anterior $1.000.000.000)'), referenciaId: 'viejo' },
      { ...conSaldos('Desembolso actualizado - edición préstamo ($1.000.000)'),          referenciaId: 'viejo' },
    ]
    const hoy = desembolsosOriginalesDelDia(movs)
    expect(hoy.size, 'no debería haber ningún desembolso de hoy').toBe(0)
    for (const m of movs) expect(afectaElFajo(m, hoy), m.descripcion).toBe(false)
  })

  it('sin contexto, la pareja se queda fuera (lo prudente)', () => {
    expect(afectaElFajo(conSaldos('Reverso desembolso - edición préstamo (anterior $250.000)'))).toBe(false)
    expect(afectaElFajo(conSaldos('Desembolso actualizado - edición préstamo ($300.000)'))).toBe(false)
  })

  it('`desembolsosOriginalesDelDia` no confunde el actualizado con el original', () => {
    const ids = desembolsosOriginalesDelDia([
      { descripcion: 'Desembolso préstamo a ALEXYA',                   referenciaId: 'a' },
      { descripcion: 'Desembolso por renovación - KARIME',             referenciaId: 'b' },
      { descripcion: 'Desembolso actualizado - edición préstamo ($1)', referenciaId: 'c' },
      { descripcion: 'Reverso desembolso - préstamo eliminado (X)',    referenciaId: 'd' },
    ])
    expect([...ids].sort()).toEqual(['a', 'b'])
  })

  it('⚠ y el préstamo BORRADO sigue fuera: ahí no hay pareja', () => {
    /* El caso de PRESTA MIL, que es distinto: el reverso llega SOLO y seis días
       después de que el billete saliera. Si se colara, volveríamos al fallo de
       los $40.000. */
    expect(afectaElFajo(conSaldos('Reverso desembolso - préstamo eliminado (MARIA GÓMEZ)'))).toBe(false)
  })

  it('lo que teclea una persona, sí', () => {
    for (const d of [
      'Cuadre de caja JOSE.  #.  4 (2026-07-31): sobrante',
      'Cuadre de la base: la ruta queda con los $198.000 contados el 2026-08-05',
      'Ajuste de caja manual (entrada)',
      'cuadre de caja',
      'Cuota de lina',
    ]) {
      expect(afectaElFajo(conSaldos(d)), d).toBe(true)
    }
  })

  it('un ajuste sin descripción cuenta como efectivo: el silencio no inventa un faltante', () => {
    expect(afectaElFajo(conSaldos(null))).toBe(true)
    expect(afectaElFajo({ saldoAnterior: 0, saldoNuevo: 100 })).toBe(true)
  })

  it('lo que se movió por transferencia no toca el fajo', () => {
    expect(afectaElFajo(conSaldos('Cuadre de caja', { metodoPago: 'transferencia' }))).toBe(false)
    expect(afectaElFajo(conSaldos('Cuadre de caja', { metodoPago: 'efectivo' }))).toBe(true)
  })

  it('el asiento que deja el saldo donde estaba sigue sin contar', () => {
    // La regla vieja de `afectaCaja`, que esta función respeta.
    expect(afectaElFajo({ descripcion: 'Reserva de capital por préstamo', saldoAnterior: 500, saldoNuevo: 500 })).toBe(false)
  })
})

describe('⚠ el campo que no se pide vale undefined y decide en silencio', () => {
  const api = fs.readFileSync('app/api/caja/cobrador/[id]/route.js', 'utf8')

  it('el select de los movimientos pide metodoPago, que es lo que lee esEfectivo', () => {
    /* Sin él la comparación era `undefined !== 'transferencia'`, o sea SIEMPRE
       efectivo: un retiro por transferencia le bajaba el fajo al cobrador sin
       haberle quitado un billete. No da error y no se ve leyendo. */
    const bloque = api.slice(api.indexOf('Movimientos del día por ruta'))
    const select = bloque.slice(bloque.indexOf('select:'), bloque.indexOf('select:') + 300)
    for (const campo of ['metodoPago', 'descripcion', 'saldoAnterior', 'saldoNuevo']) {
      expect(select, `falta ${campo}`).toContain(`${campo}: true`)
    }
  })

  it('el fajo se filtra con afectaElFajo, no con esEfectivo a secas', () => {
    expect(api).toContain('if (!yaDescontado && afectaElFajo(m, originalesDeHoy)) ajustesEfectivo += d')
  })
})
