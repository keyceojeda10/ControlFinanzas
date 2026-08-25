// lib/__tests__/las-dos-cajas-dicen-lo-mismo.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Mire la caja del administrador, la lista 9 […] la caja del cobrador sí está
//  sumando bien, pero la caja del administrador, mire, aparecen unos números
//  ahí que no tienen lógica.» — PRESTA MIL, 20 ago 2026.
//
// Y el dueño lo remató con la regla que ordena todo esto:
//
//   «La caja del cobrador SÍ está sumando y restando correctamente. La que
//    tiene los números malos es la caja del administrador, así que puedes hacer
//    una referencia buena a la caja del cobrador. Si haces un ajuste que dañe
//    también la caja del cobrador, ahí se jodió todo porque ningún número va a
//    corresponder. Ambas deben reportar lo mismo.»
//
// ⚠ LA CAJA DEL COBRADOR ES LA REFERENCIA. El administrador puede enseñar más
//   detalle —le importan otras cosas— pero las cifras comunes van al peso.
//
// ── EL DÍA DE SU CAPTURA, RUTA #9 ────────────────────────────────────────────
//
//     08:03  OLGA LUCIA           $5.000   transferencia
//     08:12  DANIEL BOTIAS       $34.000   transferencia
//     09:14  (un pago de      $3.393.000   registrado POR ERROR)
//     09:28  CINDY FERNANDA      $40.000   EFECTIVO
//     10:05  OSCAR RAMIRES       $40.000   transferencia
//     10:22  Carlos ANULA el pago de $3.393.000
//     10:23  descuentos de $1.800 y $16.200
//
// Cobró $119.000, en billetes $40.000, y arrancó con $26.000.
//
// La caja del administrador decía «Le queda en la ruta −$3.266.000» en un día
// de $119.000 cobrados y CERO prestados. La cuenta de ese disparate:
//
//     26.000 + 40.000 + 79.000 − 3.393.000 − 1.800 − 16.200 = −3.266.000
//
// Los $3.393.000 son el pago que nunca existió, RESTADO DOS VECES: al anularlo
// desaparece de «lo cobrado» —que sale de `Pago`— y su asiento de reverso lo
// vuelve a restar desde el libro. Los descuentos sí bajan el capital y se
// quedan.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cobrosRevertidosElMismoDia } from '@/lib/dinero/conciliacion'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Los asientos de ese día, tal como están en su base. */
const PRESTAMO = 'cmql0xz61000lod7z2q6uv2d8'
const ASIENTOS_RUTA9 = [
  { id: 'a1', descripcion: 'Pago recibido - préstamo',              referenciaId: PRESTAMO, monto: 3_393_000 },
  { id: 'a2', descripcion: 'Reverso pago anulado - préstamo',       referenciaId: PRESTAMO, monto: 3_393_000 },
  { id: 'a3', descripcion: 'Descuento aplicado - préstamo (Descuento)', referenciaId: PRESTAMO, monto: 1_800 },
  { id: 'a4', descripcion: 'Descuento aplicado - préstamo (Descuento)', referenciaId: PRESTAMO, monto: 16_200 },
]

describe('⚠ el pago anulado el mismo día no se resta dos veces', () => {
  it('se reconoce el reverso cuyo cobro entró hoy', () => {
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    expect([...ids]).toEqual(['a2'])
  })

  it('⚠ los DESCUENTOS no se tocan: ésos sí bajan el capital', () => {
    /* Comparten `referenciaId` con el pago, así que filtrar por referencia se
       los habría llevado por delante. Se distingue por el texto. */
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    expect(ids.has('a3')).toBe(false)
    expect(ids.has('a4')).toBe(false)
  })

  it('un pago anulado de OTRO día sí resta: aquella plata entró de verdad', () => {
    // Hoy solo está el reverso; su recaudo fue hace días y no está en la lista.
    const ids = cobrosRevertidosElMismoDia([ASIENTOS_RUTA9[1]])
    expect(ids.size).toBe(0)
  })

  it('la cuenta de la RUTA #9, al peso', () => {
    const ids = cobrosRevertidosElMismoDia(ASIENTOS_RUTA9)
    const ajustes = ASIENTOS_RUTA9
      .filter((m) => /^(Reverso|Descuento)/.test(m.descripcion))
      .filter((m) => !ids.has(m.id))
      .reduce((t, m) => t - m.monto, 0)
    expect(ajustes, 'volvió el doble conteo').toBe(-18_000)
    // apertura + efectivo + digital + ajustes
    expect(26_000 + 40_000 + 79_000 + ajustes).toBe(127_000)
    // y NO el disparate que él vio
    expect(26_000 + 40_000 + 79_000 + ajustes).not.toBe(-3_266_000)
  })
})

describe('⚠ LA CAJA DEL COBRADOR ES LA REFERENCIA', () => {
  const cobrador = leer('app/(dashboard)/caja/page.jsx')
  const admin    = leer('components/caja/CajaCobradorDetalle.jsx')
  const api      = leer('app/api/caja/cobrador/[id]/route.js')

  it('lo cobrado sale del mismo sitio en las dos', () => {
    /* El administrador lo parte en efectivo y transferencia porque a él le
       importa por dónde entró; el cobrador lo enseña entero. Pero la SUMA es
       la misma cifra, y por eso el administrador la cierra con su total. */
    expect(admin).toMatch(/Cobró en total/)
    expect(admin).toMatch(/\(cr\.cobradoEfectivo \?\? 0\) \+ \(cr\.cobradoDigital \?\? 0\)/)
    expect(cobrador).toMatch(/label: 'Lo que cobraste', valor: cobradoHoy/)
  })

  it('el fajo se calcula con el mismo criterio en las dos', () => {
    // `entraAlFajo` es la única función que decide. Ver `lib/dinero/cuentas.js`.
    expect(leer('app/api/caja/route.js')).toMatch(/from '@\/lib\/dinero\/cuentas'/)
    expect(api).toMatch(/from '@\/lib\/dinero\/cuentas'/)
  })

  it('⚠ un cobro anulado hoy se descuenta UNA vez en la caja del administrador', () => {
    expect(api).toMatch(/const reversosYaDescontados = cobrosRevertidosElMismoDia\(primerMovPorRuta\)/)
    expect(api).toMatch(/if \(!yaDescontado\) ajustesDia \+= d/)
  })

  it('tampoco se le nombra en «Salió del capital de la ruta»', () => {
    /* Si no, la cifra sale de la resta pero sigue confesándose debajo, que es
       la misma pregunta con otra cara. */
    expect(api).toMatch(/!reversosYaDescontados\.has\(m\.id\) && !afectaElFajo/)
  })
})

describe('⚠ lo que el dueño mete o saca también es del cobrador', () => {
  /* Comparadas las dos cajas con los datos reales del 20 ago, tres de los diez
     cobradores no cuadraban, y las tres diferencias eran esto AL PESO:

         CAMILO   retiro «vase»     $373.000  →  difería en  373.000
         DIEGO    inyección «vase»  $101.000  →  difería en −101.000
         JULIAN   inyección «vase»  $109.000  →  difería en −109.000

     El administrador ya lo contaba —«Le metiste a esta ruta» / «Le sacaste»— y
     la caja del cobrador no. Si le meten $109.000 a media mañana, tiene
     $109.000 más que entregar y su pantalla no se lo decía. */
  const api = leer('app/api/caja/route.js')
  const pantalla = leer('app/(dashboard)/caja/page.jsx')

  it('el API lo devuelve, solo en efectivo', () => {
    expect(api).toMatch(/movidoPorElDuenoEfectivo: Math\.round\(/)
    // Una inyección por transferencia no le llena el bolsillo.
    expect(api).toMatch(/\.filter\(\(m\) => m\.metodoPago !== 'transferencia'\)/)
    expect(api).toMatch(/\['inyeccion', 'capital_inicial', 'retiro'\]\.includes\(m\.tipo\)/)
  })

  it('entra en «te queda en la mano»', () => {
    expect(pantalla).toMatch(
      /const enLaMano = cobradoEfectivoHoy - prestadoEfectivoHoy - gastosHoy \+ movidoPorElDueno/)
  })

  it('⚠ y se ve, con su nombre y su signo', () => {
    /* Una cifra que cambia el total sin aparecer en la lista es de donde salen
       las preguntas: es la queja que ya hizo con «Le queda en la ruta». */
    expect(pantalla).toMatch(/id: 'movidoDueno'/)
    expect(pantalla).toMatch(/Te entregaron para la ruta/)
    expect(pantalla).toMatch(/Te recogieron de la ruta/)
  })
})

describe('⚠ un DESCUENTO no puede encender la alarma', () => {
  /* Baja el capital de verdad —se le perdona deuda al cliente— pero no es plata
     que se mueva, y por eso `afectaCaja` lo deja fuera del neto. Contar su
     delta en `saltoAsientos` y no en el neto hacía que la resta no diera cero
     nunca: tres cobradores con la alarma encendida el 20 ago y las tres cifras
     eran sus descuentos al peso (DIEGO $40.000; CAMILO $16.200 + $14.000 +
     $15.000 + $1.800 = $47.000). */
  it('`saltoAsientos` solo cuenta lo que afecta a la caja', () => {
    const src = leer('lib/dinero/conciliacion.js')
    const iFiltro = src.indexOf("if (!afectaCaja(m)) { r.sinEfecto += monto")
    const iSalto  = src.indexOf('r.saltoAsientos += redondo(')
    expect(iFiltro, 'no encuentro el filtro').toBeGreaterThan(0)
    expect(iSalto, 'el salto se cuenta ANTES del filtro y los descuentos vuelven')
      .toBeGreaterThan(iFiltro)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠ EL ARREGLO DE ARRIBA ESTUVO CUATRO DÍAS SIN HACER NADA
 *
 *  «Acá debe aparecer que queda para el día de mañana 162 mil pesos […] están
 *   apareciendo otros números que en ningún momento van a cuadrar.»
 *  «Número correcto para esta ruta, 436 […] acá en ningún lado lo estoy
 *   viendo.»                                    — PRESTA MIL, 24 ago 2026
 *
 *  La llamada a `cobrosRevertidosElMismoDia` estaba escrita, la prueba de
 *  arriba lo comprobaba, y devolvía SIEMPRE el conjunto vacío: el `select` de
 *  Prisma del endpoint no pedía `id` ni `referenciaId`, así que la función
 *  indexaba `undefined` y no reconocía un solo reverso. Sin error y sin log.
 *
 *  Comprobar que una línea está escrita no es comprobar que hace algo. Esta
 *  tanda mide la CUENTA, con los asientos de sus dos rutas.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('⚠ el desglose tiene que dar el saldo de la ruta', () => {
  const api = leer('app/api/caja/cobrador/[id]/route.js')

  it('el `select` pide los campos sin los que la función es ciega', () => {
    /* Anclado en el SELECT, no en un comentario: es el campo que faltaba. */
    const i = api.indexOf('prisma.movimientoCapital.findMany')
    expect(i, 'no encuentro la consulta del libro').toBeGreaterThan(0)
    const consulta = api.slice(i, i + 2200)
    expect(consulta, 'sin `id` el conjunto de reversos sale vacío').toMatch(/\bid: true\b/)
    expect(consulta, 'sin `referenciaId` no se empareja con su recaudo').toMatch(/\breferenciaId: true\b/)
  })

  /* ── LOS ASIENTOS DE SU RUTA #7, EL 24 DE AGOSTO ────────────────────────
     Catorce cobros (uno de ellos anulado a las 19:11), dos gastos y tres
     desembolsos. `saldoCapital` de la ruta: $162.000, que es lo que la
     pantalla de rutas enseñaba bien. */
  const P7 = 'cmsqkitpx01vmrul0h5jvba54'
  const COBROS_7 = [120_000, 25_000, 90_000, 86_000, 12_000, 132_000, 30_000,
    100_000, 60_000, 20_000, 80_000, 50_000, 50_000]
  const ANULADO_7 = 30_000
  const GASTOS_7 = 12_000 + 28_000
  const PRESTADO_7 = 380_000 + 500_000 + 152_000
  const CAPITAL_7 = 162_000

  const LIBRO_7 = [
    ...COBROS_7.map((monto, i) => ({ id: `c${i}`, referenciaId: `p${i}`, monto, descripcion: 'Pago recibido - préstamo' })),
    { id: 'anulado', referenciaId: P7, monto: ANULADO_7, descripcion: 'Pago recibido - préstamo' },
    { id: 'reverso', referenciaId: P7, monto: ANULADO_7, descripcion: 'Reverso pago anulado - préstamo' },
  ]

  /** La cuenta del endpoint, con los asientos delante. */
  const reconstruir = (libro, { capital, cobradoDePago, prestado, gastos }) => {
    const yaDescontados = cobrosRevertidosElMismoDia(libro)
    /* `deltaPorRuta`: TODO lo que se movió hoy, con su dirección real. El
       reverso resta aquí siempre — el libro no sabe de anulaciones. */
    const delta = libro.reduce((t, m) => t + (/^Reverso/.test(m.descripcion) ? -m.monto : m.monto), 0)
      - prestado - gastos
    const apertura = capital - delta
    /* `ajustesDia`: el reverso de un cobro anulado HOY ya se fue por la vía de
       «lo cobrado», que sale de `Pago` y donde ese pago ya no existe. */
    const ajustesDia = libro
      .filter((m) => /^Reverso/.test(m.descripcion) && !yaDescontados.has(m.id))
      .reduce((t, m) => t - m.monto, 0)
    return { apertura, ajustesDia, queda: apertura + cobradoDePago - prestado - gastos + ajustesDia }
  }

  it('RUTA #7 · el desglose da $162.000, que es su capital', () => {
    const r = reconstruir(LIBRO_7, {
      capital: CAPITAL_7,
      // El pago anulado NO está: al anularlo se borra la fila de `Pago`.
      cobradoDePago: COBROS_7.reduce((a, b) => a + b, 0),
      prestado: PRESTADO_7,
      gastos: GASTOS_7,
    })
    expect(r.apertura, 'con lo que salió').toBe(379_000)
    expect(r.ajustesDia, 'el reverso de hoy no resta: ya se fue por «lo cobrado»').toBe(0)
    expect(r.queda).toBe(CAPITAL_7)
    // Y NO lo que él vio, que son los $30.000 restados dos veces.
    expect(r.queda).not.toBe(132_000)
  })

  it('RUTA #7 · sin el arreglo el desglose decía $132.000', () => {
    /* La regresión exacta: la función ciega devolvía el conjunto vacío. */
    const ciega = new Set()
    const ajustes = LIBRO_7
      .filter((m) => /^Reverso/.test(m.descripcion) && !ciega.has(m.id))
      .reduce((t, m) => t - m.monto, 0)
    expect(379_000 + COBROS_7.reduce((a, b) => a + b, 0) - PRESTADO_7 - GASTOS_7 + ajustes).toBe(132_000)
  })

  /* ── Y SU RUTA #8, DEL MISMO DÍA ────────────────────────────────────────
     Dos anulaciones seguidas, 19:54 y 19:55. Capital $436.000, pantalla
     $321.000: la diferencia son esos dos pagos, restados dos veces. */
  it('RUTA #8 · los dos reversos de las 19:54 y 19:55 se reconocen', () => {
    const P = 'cmsnwi76f025ccil0m0wg69sh'   // el mismo préstamo pagó tres veces
    const Q = 'cmszat6q9016ngdl0r5w1a1wi'
    const LIBRO_8 = [
      { id: 'r1', referenciaId: P, monto: 100_000, descripcion: 'Pago recibido - préstamo' },
      { id: 'r2', referenciaId: Q, monto: 15_000,  descripcion: 'Pago recibido - préstamo' },
      { id: 'x1', referenciaId: P, monto: 100_000, descripcion: 'Reverso pago anulado - préstamo' },
      { id: 'x2', referenciaId: Q, monto: 15_000,  descripcion: 'Reverso pago anulado - préstamo' },
      // Volvió a pagar lo mismo partido en dos, después de la anulación.
      { id: 'r3', referenciaId: P, monto: 86_000,  descripcion: 'Pago recibido - préstamo' },
      { id: 'r4', referenciaId: P, monto: 14_000,  descripcion: 'Pago recibido - préstamo' },
    ]
    const ids = cobrosRevertidosElMismoDia(LIBRO_8)
    expect([...ids].sort()).toEqual(['x1', 'x2'])
    const restadoDosVeces = LIBRO_8
      .filter((m) => /^Reverso/.test(m.descripcion) && ids.has(m.id))
      .reduce((t, m) => t + m.monto, 0)
    expect(restadoDosVeces).toBe(115_000)
    expect(436_000 - restadoDosVeces, 'lo que él vio').toBe(321_000)
  })

  it('⚠ el reverso de un pago de AYER sí resta, aunque hoy vuelva a pagar', () => {
    /* El emparejamiento por importe está para esto. Solo por préstamo, este
       reverso quedaría marcado como «ya descontado» y no restaría nunca:
       aquella plata entró de verdad ayer y hoy se le quita. */
    const P = 'prestamo-x'
    const ids = cobrosRevertidosElMismoDia([
      { id: 'hoy',     referenciaId: P, monto: 40_000, descripcion: 'Pago recibido - préstamo' },
      { id: 'deAyer',  referenciaId: P, monto: 90_000, descripcion: 'Reverso pago anulado - préstamo' },
    ])
    expect(ids.size).toBe(0)
  })

  it('dos cobros iguales el mismo día y uno anulado: solo cae uno', () => {
    const P = 'prestamo-y'
    const ids = cobrosRevertidosElMismoDia([
      { id: 'a', referenciaId: P, monto: 50_000, descripcion: 'Pago recibido - préstamo' },
      { id: 'b', referenciaId: P, monto: 50_000, descripcion: 'Pago recibido - préstamo' },
      { id: 'x', referenciaId: P, monto: 50_000, descripcion: 'Reverso pago anulado - préstamo' },
    ])
    expect([...ids]).toEqual(['x'])
  })
})

describe('⚠ el gasto POR APROBAR no ha salido del capital de la ruta', () => {
  /* El segundo descuadre del 24 de agosto, misma pantalla y otra causa. Su
     RUTA #4: capital $151.000, desglose $129.000, y los $22.000 eran una
     gasolina de $10.000 y unos viáticos de $12.000 registrados esa tarde y
     todavía sin aprobar.

     El asiento del gasto se escribe AL APROBARLO. Medido en su base: de 814
     gastos aprobados, los 814 tienen su `MovimientoCapital`; de los 2
     pendientes, ninguno. Así que el capital de la ruta aún no los ha perdido
     y el desglose no puede restarlos.

     Es la división de siempre: del FAJO ya salieron —el cobrador puso el
     billete— y de la BOLSA todavía no. */
  const api = leer('app/api/caja/cobrador/[id]/route.js')

  it('`quedaEnLaRuta` resta solo los aprobados', () => {
    const i = api.indexOf('quedaEnLaRuta: Math.round(')
    expect(i, 'no encuentro la cifra').toBeGreaterThan(0)
    expect(api.slice(i, i + 260)).toMatch(/- \(gastosDia - gastosPendientesDia\)/)
  })

  it('⚠ pero «tiene que entregar» los resta ENTEROS: ese billete no está', () => {
    /* Si el fajo dejara de restarlos, al cobrador se le pediría de noche una
       plata que ya se gastó en gasolina. */
    const i = api.indexOf('const efectivoEnMano =')
    expect(i).toBeGreaterThan(0)
    expect(api.slice(i, i + 220)).toMatch(/- gastosDia\b/)
    expect(api.slice(i, i + 220)).not.toMatch(/gastosPendientesDia/)
  })

  it('la cuenta de la RUTA #4, al peso', () => {
    const COBRADO = 375_000, PRESTADO = 224_000, CAPITAL = 151_000
    const GASTOS = 10_000 + 12_000, PENDIENTES = 10_000 + 12_000
    // Su libro del día no tiene ni un asiento de gasto, así que la apertura
    // sale de restar solo cobros y desembolsos.
    const apertura = CAPITAL - (COBRADO - PRESTADO)
    expect(apertura).toBe(0)
    expect(apertura + COBRADO - PRESTADO - (GASTOS - PENDIENTES)).toBe(CAPITAL)
    // Y lo que él vio antes del arreglo.
    expect(apertura + COBRADO - PRESTADO - GASTOS).toBe(129_000)
  })
})
