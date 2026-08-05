import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL CIERRE DECÍA QUE EL COBRADOR NO HABÍA PRESTADO NADA ──────────────────
//
// `caja/cuadre` crea cierres sin escribir `totalDesembolsado` ni `totalGastos`.
// No era un cálculo que diera cero: los campos no viajaban en el `data`, así
// que Prisma les ponía su `@default(0)`.
//
// Medido en producción el 4 ago 2026:
//   · 2.485 de 2.852 cierres (87%) con el desembolso en cero
//   · $425.397.087 prestados en 60 días que ningún cierre registró
//   · 10 de 14 cierres revisados perdieron su desembolso, todos cerrados
//     DESPUÉS de los préstamos (o sea: no era un problema de horario)
//
// Cómo se encontró: un cliente reportó que su cobrador de la ruta #5 entregó
// $322.000 y esa cifra no salía por ningún lado. En esa ruta faltaba un
// préstamo de $150.000; luego resultó que faltaban en TODAS.
//
// La causa de fondo era la duplicación: `calcularDesembolsadoDia` existía dos
// veces, privada en cada archivo y CON LOS ARGUMENTOS EN ORDEN DISTINTO. El
// tercer sitio que crea cierres no pudo importar ninguna.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const CUADRE = 'app/api/caja/cuadre/route.js'
const CAJA = 'app/api/caja/route.js'
const AUTO = 'app/api/caja/cierre-auto/route.js'
const COMPARTIDA = 'lib/dinero/desembolsado.js'

describe('una sola definición de «cuánto prestó»', () => {
  it('vive en lib/dinero y la exporta', () => {
    const src = leer(COMPARTIDA)
    expect(src).toMatch(/export async function calcularDesembolsadoDia\(/)
    // La firma que mandan todos: el cobrador AL FINAL y opcional.
    expect(src, 'cambió el orden de los argumentos: revisa las tres llamadas')
      .toContain('calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId = null)')
  })

  it.each([CUADRE, CAJA, AUTO])('%s la importa en vez de tener la suya', (ruta) => {
    const src = leer(ruta)
    expect(src, 'no importa la compartida').toContain("from '@/lib/dinero/desembolsado'")
    expect(src, 'volvió a declarar una copia local')
      .not.toMatch(/^async function calcularDesembolsadoDia\(/m)
  })

  it('el automático usa el ORDEN NUEVO de argumentos', () => {
    // Su copia era `(org, cobrador, inicio, fin)`. Si alguien la reescribe con
    // el orden viejo, el cálculo sale mal en silencio: los tipos encajan.
    const src = leer(AUTO)
    expect(src).toContain('calcularDesembolsadoDia(org.id, fechaCierre, fechaCierreFin, cobrador.id)')
  })
})

describe('el cuadre guarda lo que el cobrador prestó', () => {
  const src = leer(CUADRE)

  it('el cierre que crea lleva desembolso y gastos', () => {
    const i = src.indexOf('cierre = await prisma.cierreCaja.create({')
    expect(i, 'ya no existe el create: revisa esta prueba').toBeGreaterThan(-1)
    const bloque = src.slice(i, src.indexOf('})', src.indexOf('...dataConfirmacion', i)))
    expect(bloque, 'vuelve a crear cierres sin `totalDesembolsado`').toContain('totalDesembolsado:')
    expect(bloque, 'vuelve a crear cierres sin `totalGastos`').toContain('totalGastos:')
    expect(bloque, 'falta el saldo real de la caja').toContain('saldoRealCaja:')
  })

  it('el desembolso sale de la función, no de un literal', () => {
    // Escribir `totalDesembolsado: 0` a mano sería el mismo fallo con otra
    // cara — que es justo lo que ya pasó aquí con `totalEsperado`.
    expect(src).toContain('const totalDesembolsado = await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId)')
    expect(src, 'hay un cero escrito a mano en el cierre')
      .not.toMatch(/totalDesembolsado:\s*0\b/)
  })

  it('un cierre que YA estaba en cero se rellena al cuadrar', () => {
    // Sin esto, los cierres creados antes del arreglo se quedaban en cero para
    // siempre aunque el admin los cuadrara después.
    const i = src.indexOf('if (cierreExistente) {')
    const bloque = src.slice(i, src.indexOf('} else {', i))
    expect(bloque, 'el update no rellena el desembolso que falta').toContain('faltaDesembolso')
    expect(bloque).toContain('calcularDesembolsadoDia')
  })

  it('NO pisa el desembolso que el cobrador ya había cerrado', () => {
    // Solo se toca cuando está en cero. Si el cobrador cerró con su cifra, esa
    // manda: es un dato que él revisó y no se le sobrescribe.
    const i = src.indexOf('const faltaDesembolso')
    const bloque = src.slice(i, i + 700)
    expect(bloque).toContain('!cierreExistente.totalDesembolsado')
    expect(bloque, 'escribe aunque no haya desembolsos reales').toMatch(/desembolsoReal > 0/)
  })
})

describe('los gastos del cierre', () => {
  const src = leer(CUADRE)

  it('guarda los APROBADOS, no los pendientes', () => {
    // Son dos preguntas distintas y las dos variables existen en el mismo
    // archivo: `gastosCobrador` (pendientes, para el saldo, porque los
    // aprobados ya bajaron el capital de la ruta) y `gastosAprobados` (los que
    // de verdad salieron, que es lo que guarda el cierre normal).
    //
    // Mi primera versión del arreglo usó la variable equivocada. Los tipos
    // encajan y las dos se llaman «gastos del cobrador en el día», así que
    // habría pasado build, tests y despliegue con la cifra mala.
    expect(src, 'la consulta de gastos aprobados no está')
      .toMatch(/estado: 'aprobado', fecha: \{ gte: inicio, lt: fin \}/)
    const i = src.indexOf('cierre = await prisma.cierreCaja.create({')
    const bloque = src.slice(i, src.indexOf('...dataConfirmacion', i))
    expect(bloque, 'el cierre guarda los gastos PENDIENTES').not.toMatch(/totalGastos: gastosCobrador/)
    expect(bloque).toContain('totalGastos: gastosAprobados')
    expect(bloque, 'el saldo se calcula con los pendientes').not.toMatch(/recaudadoDia - gastosCobrador/)
  })

  it('un cierre viejo con gastos en cero se rellena al cuadrar', () => {
    // 316 cierres en producción con gastos en cero habiendo gastado,
    // $15.431.000 — todos del cliente que reportó el descuadre.
    const i = src.indexOf('const faltaDesembolso')
    const bloque = src.slice(i, src.indexOf('cierre = await prisma.cierreCaja.update', i))
    expect(bloque, 'no se rellenan los gastos que faltan').toContain('ponGastos')
    expect(bloque).toMatch(/!cierreExistente\.totalGastos && gastosAprobados > 0/)
  })

  it('el saldo se recalcula UNA vez con las dos correcciones', () => {
    // En dos pasos, la segunda pisaría a la primera: si se rellenan gastos y
    // desembolso a la vez, el saldo tiene que contar los dos.
    const i = src.indexOf('const operativoFinal')
    expect(i, 'no se recalcula el saldo').toBeGreaterThan(-1)
    const bloque = src.slice(i, src.indexOf('})', src.indexOf('saldoRealCaja', i)))
    expect(bloque).toContain('operativoFinal - desembolsoFinal')
    // Y los dos valores «finales» respetan lo que ya había si no se corrige.
    expect(bloque).toMatch(/desembolsoFinal = ponDesembolso/)
    expect(bloque).toMatch(/operativoFinal = ponGastos/)
  })

  it('NO toca un cierre que ya traía sus cifras', () => {
    const src2 = leer(CUADRE)
    const i = src2.indexOf('cierre = await prisma.cierreCaja.update')
    const bloque = src2.slice(i, i + 600)
    // Los tres campos van detrás de su condición: sin ella se pisaría el dato
    // que el cobrador revisó.
    expect(bloque).toMatch(/\.\.\.\(ponDesembolso \? \{ totalDesembolsado/)
    expect(bloque).toMatch(/\.\.\.\(ponGastos \? \{ totalGastos/)
    expect(bloque).toMatch(/\.\.\.\(ponDesembolso \|\| ponGastos/)
  })
})
