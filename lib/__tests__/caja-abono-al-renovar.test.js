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
    expect(API).toMatch(/select: \{ id: true, montoPrestado: true, renovadoDeId: true \}/)
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

  it('cuenta CARTULINAS distintas, no abonos sueltos', () => {
    // Dos abonos al mismo préstamo son un cliente, no dos.
    expect(API).toMatch(/cartulinas: new Set\(cobrosDeRenovadas\.map\(\(p\) => p\.prestamoId\)\)\.size/)
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

  it('en la pantalla es una nota al pie del renglón, no un renglón propio', () => {
    expect(ADMIN).toMatch(/detalle=\{notaDeRenovaciones\(r\.cobradoEnDiaDeRenovacion\)\}/)
    expect(ADMIN).toMatch(/monto=\{cr\.cobradoEfectivo \?\? 0\}/)
  })

  it('y no se pinta cuando no hay nada que mirar', () => {
    /* Sin renovaciones con abono la nota sobra: aquí el dato es que HAYA, no
       cuánto. No es esconder un KPI en cero — el renglón de arriba sigue. */
    expect(ADMIN).toMatch(/if \(!x \|\| !\(x\.enEfectivo > 0\)\) return null/)
  })
})
