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
