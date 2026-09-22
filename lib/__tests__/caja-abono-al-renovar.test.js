// Lo que entró el mismo día en que se renovó esa cartulina (15 sep 2026).
//
// «cuando ellos van a renovar una cartulina, ellos sacan un abono falso y lo
//  colocan. Y ese abono no debería ser porque ellos así suben el cobro, pero lo
//  suben de mentiras.» — PRESTA MIL, la cartera más grande.
//
// Medido en su organización: de 529 renovaciones en 30 días, 346 llevan un
// abono al préstamo viejo ESE MISMO DÍA y 194 se registran en los diez minutos
// anteriores a renovar. Suman $17.702.000 sobre $161.892.900 cobrados.
//
// ⚠ LA CIFRA NO RESTA NADA, y estas pruebas existen para que siga siendo así.
// Un abono puesto para cuadrar y una cuota que el cliente sí pagó son idénticos
// en la base; y «Cobró en efectivo» ES la caja, así que restarle esto bajaría
// lo que el cobrador tiene que entregar.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const API   = sinComentarios(leer('app/api/caja/cobrador/[id]/route.js'))
const ADMIN = sinComentarios(leer('components/caja/CajaCobradorDetalle.jsx'))

describe('la cifra se mide con el mismo criterio que la caja', () => {
  it('el cruce necesita el préstamo de cada cobro y la cartulina de cada renovación', () => {
    /* Los dos campos que, si no se piden, dejan el cruce en cero sin que nada
       reviente. Ver [[feedback_verificar_prisma_select]]. */
    expect(API).toMatch(/prestamoId: true,\s*\n\s*prestamo: \{/)
    expect(API).toMatch(/renovadoDeId: true, createdAt: true(, interesFinanciado: true)? \}/)
  })

  it('el efectivo lo decide `entraAlFajo`, nunca el rótulo del método', () => {
    /* La regla de siempre: un Nequi del cobrador SÍ entra al fajo y uno de la
       oficina no. Comparar contra la cadena 'transferencia' es de donde salió
       que una pantalla dijera 66.000 y otra 119.000. */
    const i = API.indexOf('const cobradoEnDiaDeRenovacion')
    expect(i).toBeGreaterThan(-1)
    const bloque = API.slice(i, i + 900)
    expect(bloque).toMatch(/entraAlFajo\(p\.metodoPago, p\.metodoPagoId, cuentasCobrador\)/)
    expect(bloque, 'volvió la comparación por el rótulo').not.toMatch(/=== 'transferencia'/)
  })

  it('⚠ una fila por PERSONA, y el pie cuenta las mismas', () => {
    /* Contra datos reales el mismo cliente salía DOS VECES —dos cartulinas
       renovadas el mismo día— mientras el pie decía «entre esos 3 clientes»:
       cuatro filas y un total que hablaba de tres. */
    expect(API).toMatch(/const porCliente = new Map\(\)/)
    expect(API).toMatch(/cartulinas: porCliente\.size/)
    expect(API).toMatch(/const abonosAlRenovar = \[\.\.\.porCliente\.values\(\)\]/)
    // Y si abonó varias veces, la fila lo dice: el monto de la derecha es la suma.
    expect(ADMIN).toMatch(/a\.abonos > 1 \?/)
  })

  it('de varios abonos se enseña el más pegado a la renovación', () => {
    // Uno de hace seis horas no dice nada; uno de hace un minuto, sí.
    expect(API).toMatch(/Math\.abs\(minutos\) < Math\.abs\(ya\.minutos\)/)
  })

  it('y la hora de la renovación se pide en el select', () => {
    /* Sin `createdAt` los minutos salían `null` y la lista se quedaba sin la
       única pista que puede dar. Pasó, y así se cazó. */
    expect(API).toMatch(/select: \{ id: true, montoPrestado: true, renovadoDeId: true, createdAt: true(, interesFinanciado: true)? \}/)
  })
})

describe('⚠ y no toca ni un peso de la caja', () => {
  it('no entra en ninguna suma del API', () => {
    /* Va dentro de `resumen`, que es informativo. Si apareciera en las entradas
       o salidas de `cuentaDelDia`, cambiaría «tiene que entregar». */
    const i = API.indexOf('cuentaDelDia({')
    const cuenta = API.slice(i, API.indexOf('})', i))
    expect(cuenta, 'la cifra se coló en la cuenta del día').not.toMatch(/cobradoEnDiaDeRenovacion/)
  })

  it('«Cobró en efectivo» sigue saliendo del neto de siempre', () => {
    expect(API).toMatch(/rotulo: 'Cobró en efectivo', monto: cobradoEfectivoNeto/)
  })

  it('«Cobró en efectivo» se queda como estaba, sin nota pegada', () => {
    /* La primera versión colgaba una frase del renglón y no se entendió. Ahora
       el renglón vuelve a ser la cifra a secas y la explicación vive en su
       propio bloque, con nombres. */
    expect(ADMIN).toMatch(/monto=\{cr\.cobradoEfectivo \?\? 0\}/)
    expect(ADMIN, 'volvió la nota pegada al renglón').not.toMatch(/notaDeRenovaciones/)
  })

  it('y no se pinta cuando no hay nada que mirar', () => {
    /* Sin abonos ese día el bloque sobra: aquí el dato es que HAYA, no cuánto.
       No es esconder un KPI en cero — el renglón del cobro sigue igual. */
    expect(ADMIN).toMatch(/\(r\.cobradoEnDiaDeRenovacion\?\.lista\?\.length \?\? 0\) > 0 &&/)
  })
})

describe('⚠ la cifra sola no se entiende: va la lista', () => {
  /* «¿eso de 250 qué significa? ¿es lo que lleva coteado, o los abonos que le
   *  dio el cliente, o los que él puso para después renovar la cartulina?»
   *  — el prestamista, al ver la primera versión.
   *  «no está desglosando por cliente ni por valor» — el dueño, lo mismo. */
  it('el API manda quién, cuánto y cuánto después renovó', () => {
    expect(API).toMatch(/lista: abonosAlRenovar/)
    expect(API).toMatch(/cliente: p\.prestamo\?\.cliente\?\.nombre/)
    expect(API).toMatch(/const minutos = cuandoRenovo \?/)
    expect(API).toMatch(/\bminutos,\n/)
  })

  it('la lista va de mayor a menor: el que más abonó es el que más pesa', () => {
    expect(API).toMatch(/\.sort\(\(x, y\) => y\.monto - x\.monto\)/)
  })

  it('un abono DESPUÉS de renovar también se puede ver', () => {
    // Pasa, y esconderlo sería elegir qué se mira por él.
    expect(ADMIN).toMatch(/if \(min < 0\) return/)
  })

  it('la pantalla dice en voz alta lo que el sistema NO sabe', () => {
    /* Era justo su pregunta. Callarlo deja al prestamista adivinando si la
       cifra ya está juzgada. */
    expect(ADMIN).toMatch(/no puede\s*\n?\s*saber si le entregaron esa plata/)
    expect(ADMIN).toMatch(/Ya están sumados arriba/)
  })

  it('y el nombre no se recorta: es con lo que va a ir a preguntar', () => {
    const i = ADMIN.indexOf('Abonos el día que renovaron')
    const bloque = ADMIN.slice(i, i + 2200)
    expect(bloque).not.toMatch(/truncate|text-ellipsis|slice\(0,/)
  })
})
