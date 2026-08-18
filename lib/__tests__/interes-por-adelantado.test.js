// lib/__tests__/interes-por-adelantado.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Hay clientes que en una quincena me pagan intereses y en la otra capital.
//  Cuando lo voy a hacer en la App, me dice que no tengo interés por registrar
//  y es molesto, porque tengo que usar un registro alterno para este tipo de
//  clientes.»                                            — Crediya, 14 ago 2026
//
// La causa: se sumaba solo el interés de las cuotas cuya fecha YA HABÍA
// LLEGADO. Su cliente paga el interés ANTES de que caiga la quincena, no hay
// nada vencido, y el sistema contestaba «No hay intereses pendientes».
//
// La regla estaba escrita CUATRO VECES —el servidor, el prellenado de la hoja,
// el botón de tipo de la hoja y el atajo de cobro—, así que arreglar una sola
// habría dejado a la pantalla enseñando $0 sobre un servidor que ya aceptaba.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { interesCobrableAhora, calcularInteresesPendientes } from '@/lib/calculos'

/* Un préstamo a saldo, quincenal, con la tabla puesta a mano para que las
   fechas sean explícitas: la mitad de este caso ES el calendario. */
const dias = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const prestamo = (filas) => ({
  modoInteres: 'saldo',
  cuotasAmortizacion: filas.map((f, i) => ({
    numeroPeriodo: i + 1,
    fechaEsperada: f.fecha,
    interes: f.interes,
    interesPagado: f.interesPagado ?? 0,
    cuotaTotal: f.cuotaTotal ?? f.interes + 100000,
    pagado: f.pagado ?? 0,
  })),
})

describe('⚠ el caso de Crediya: le pagan antes de que caiga', () => {
  it('sin nada vencido, ANTES daba cero y por eso bloqueaba', () => {
    /* Se deja la función vieja probada a propósito: es el «antes» del arreglo,
       y si alguien la cambiara creyendo que es la misma pregunta, aquí se ve. */
    const p = prestamo([{ fecha: dias(10), interes: 75000 }])
    expect(calcularInteresesPendientes(p)).toBe(0)
  })

  it('ahora se le puede recibir el interés de la quincena que viene', () => {
    const p = prestamo([{ fecha: dias(10), interes: 75000 }])
    expect(interesCobrableAhora(p)).toBe(75000)
  })

  it('lo vencido y lo que viene se suman', () => {
    const p = prestamo([
      { fecha: dias(-15), interes: 75000 },   // ya venció y no lo pagó
      { fecha: dias(10),  interes: 75000 },   // la que viene
    ])
    expect(interesCobrableAhora(p)).toBe(150000)
  })

  it('pero SOLO la que viene, no las doce', () => {
    /* Con todas, un dedazo registraría el interés entero de un préstamo a un
       año de un solo golpe. Con la siguiente basta y además se compone: cobrada
       esa, la de después pasa a ser «la que viene». */
    const p = prestamo(Array.from({ length: 12 }, (_, i) => ({ fecha: dias(15 * (i + 1)), interes: 75000 })))
    expect(interesCobrableAhora(p)).toBe(75000)
  })

  it('y se compone: cobrada una, se puede cobrar la siguiente', () => {
    const p = prestamo([
      { fecha: dias(10), interes: 75000, interesPagado: 75000 },
      { fecha: dias(25), interes: 75000 },
    ])
    expect(interesCobrableAhora(p)).toBe(75000)
  })
})

describe('⚠ las trampas del calendario y del orden', () => {
  it('la cuota ya saldada no cuenta, aunque esté por vencer', () => {
    const p = prestamo([
      { fecha: dias(10), interes: 75000, cuotaTotal: 175000, pagado: 175000 },
      { fecha: dias(25), interes: 60000 },
    ])
    expect(interesCobrableAhora(p)).toBe(60000)
  })

  it('«la que viene» es la de la fecha más cercana, venga como venga la lista', () => {
    /* ⚠ Las filas llegan en el orden del `include` de Prisma, no ordenadas. Sin
       ordenar aquí dentro, «la primera que aún no vence» sería la que la
       consulta pusiera primero: con la lista al revés se tomaría la de dentro
       de seis meses y se le podría cobrar de más. */
    const alReves = prestamo([
      { fecha: dias(180), interes: 20000 },
      { fecha: dias(10),  interes: 75000 },
    ])
    expect(interesCobrableAhora(alReves)).toBe(75000)
  })

  it('lo que ya se pagó de esa cuota se descuenta', () => {
    const p = prestamo([{ fecha: dias(10), interes: 75000, interesPagado: 50000 }])
    expect(interesCobrableAhora(p)).toBe(25000)
  })

  it('en los modos sin tabla devuelve cero, y eso es correcto', () => {
    /* En clásico el interés va DENTRO del total desde el primer día: no hay un
       saldo de interés aparte que cobrar. Ese camino sube la deuda y tiene su
       propio tope, que es lo prestado. */
    expect(interesCobrableAhora({ modoInteres: 'fijo', cuotasAmortizacion: [] })).toBe(0)
    expect(interesCobrableAhora(null)).toBe(0)
  })
})

describe('⚠ la regla vive en un solo sitio', () => {
  const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  const LOS_CUATRO = [
    ['el servidor', 'app/api/prestamos/[id]/pagos/route.js'],
    ['la hoja de pago', 'components/prestamos/RegistrarPago.jsx'],
    ['la pantalla del préstamo', 'app/(dashboard)/prestamos/[id]/page.jsx'],
  ]

  for (const [quien, ruta] of LOS_CUATRO) {
    it(`${quien} usa la función, no su propia copia`, () => {
      const src = leer(ruta)
      expect(src, `${quien} no llama a interesCobrableAhora`).toMatch(/interesCobrableAhora\(/)
      /* La firma de la copia: filtrar por fecha y reducir el interés no pagado,
         a mano. Estaba en los cuatro sitios y cada uno podía derivar por su
         lado — que es exactamente lo que pasó. */
      expect(src, `${quien} conserva una copia de la regla`)
        .not.toMatch(/fechaEsperada\) <= new Date\(\)[\s\S]{0,160}interesPagado/)
    })
  }
})

describe('⚠ la casilla propone lo que el servidor acepta', () => {
  const hoja = readFileSync(resolve(process.cwd(), 'components/prestamos/RegistrarPago.jsx'), 'utf8')
  /* La ventana llega a 2.600 porque el comentario que explica el porqué ocupa
     casi mil caracteres: con 1.200 la prueba fallaba sin que el código
     estuviera mal, que es la peor clase de prueba. */

  it('la tira de pestañas que se VE también pone la cifra', () => {
    /* ⚠ HAY DOS TIRAS EN ESTE ARCHIVO y la visible es `aplicacionesDePago`, no
       la de `key/label`. Cambié la segunda, di por hecho que era esa, y en el
       espejo la casilla seguía enseñando la CUOTA ($266.667) mientras el
       servidor solo aceptaba el interés ($100.000): el cobrador leía una cifra,
       confirmaba, y le salía un error. Solo se vio pulsando. */
    const bloque = hoja.slice(hoja.indexOf('onAplicacion={'), hoja.indexOf('onAplicacion={') + 2600)
    expect(bloque).toMatch(/a\.id === 'intereses'/)
    expect(bloque, 'la tira visible no propone el interés cobrable')
      .toMatch(/interesCobrableAhora\(prestamo\)/)
  })

  it('en los modos sin tabla sigue vaciando, que es lo correcto', () => {
    /* Ahí el monto lo pacta el prestamista con cada cliente: el sistema no lo
       sabe y adivinarlo sería inventar una cifra en una pantalla de plata. */
    const bloque = hoja.slice(hoja.indexOf('onAplicacion={'), hoja.indexOf('onAplicacion={') + 2600)
    expect(bloque).toMatch(/if \(subeLaDeuda\) fijarMonto\(''\)/)
  })

  it('se fija con `fijarMonto`, no con `setMonto`', () => {
    /* Lo dice el comentario de su definición: `monto` guarda la cifra real y
       `montoTecleado` el texto escrito; quien fija desde un atajo tiene que
       olvidar lo tecleado o el campo sigue pintando lo viejo. */
    for (const m of hoja.matchAll(/(\w+)\(String\(Math\.round\(interesCobrableAhora/g)) {
      expect(m[1], 'una de las vías usa setMonto y no repinta').toBe('fijarMonto')
    }
  })
})

describe('⚠ el servidor avisa en vez de recortar callado', () => {
  const api = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/pagos/route.js'), 'utf8')
  const bloque = api.slice(api.indexOf('const cobrable ='), api.indexOf('const cobrable =') + 1400)

  it('ya no reescribe el monto por lo bajo', () => {
    /* Pedir $75.000 cuando cabían $50.000 registraba $50.000 sin decir nada: el
       cliente entregaba una plata y quedaba anotada otra. */
    expect(bloque).not.toMatch(/montoFinal = cobrable/)
  })

  it('dice cuánto cabe y qué hacer con el resto', () => {
    expect(bloque).toMatch(/hasta \$\{cobrable\}/)
    expect(bloque).toMatch(/abono a capital/)
  })
})
