import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── «LO QUE PRESTASTE» CONTABA LA CARTULINA, NO EL EFECTIVO ─────────────────
//
// El dueño de PRESTA MIL, con un caso al peso:
//
//   «lo que prestó debería ser $142.000, pero está mostrando $150.000, porque
//    no resta los $8.000, los está sumando lo que debía el cliente»
//
// MIRANDA GOMEZ, ruta 7, comprobado en producción: cartulina $150.000,
// renovación, movimiento de capital $142.000. El dato bueno YA estaba guardado.
//
// `calcularDesembolsadoDia` tiene dos ramas. La de POR COBRADOR usaba el
// movimiento de capital y estaba bien. La GLOBAL —la vista del dueño— hacía un
// `SUM(montoPrestado)` a secas.
//
// Medido en producción, 30 días: $125.674.840 de más repartidos entre muchas
// organizaciones. Solo PRESTA MIL, $42.622.757 sobre 447 renovaciones.

const src = readFileSync(resolve(process.cwd(), 'lib/dinero/desembolsado.js'), 'utf8')

describe('la rama global cuenta el efectivo, no la cartulina', () => {
  it('ya NO suma montoPrestado a secas', () => {
    // Era: prisma.prestamo.aggregate({ _sum: { montoPrestado: true } })
    expect(src, 'volvió el aggregate que sumaba cartulinas')
      .not.toMatch(/_sum: \{ montoPrestado: true \}/)
  })

  it('mira el movimiento de capital, que es donde está lo que salió', () => {
    const global = src.slice(src.indexOf('if (!cobradorId)'), src.indexOf('// Vista por cobrador'))
    expect(global).toMatch(/tipo: 'desembolso'/)
    expect(global).toMatch(/referenciaTipo: 'prestamo'/)
  })

  it('el movimiento más reciente manda, por si se editó', () => {
    const global = src.slice(src.indexOf('if (!cobradorId)'), src.indexOf('// Vista por cobrador'))
    expect(global).toMatch(/m\.createdAt > prev\.createdAt/)
  })
})

describe('el fallback de las renovaciones sin movimiento', () => {
  it('NO supone cero: resta la deuda del préstamo viejo', () => {
    // Suponer cero se pasa al otro lado. De 548 renovaciones en 30 días solo 7
    // no tienen movimiento, pero LAS SIETE renuevan un préstamo ya saldado
    // —deuda 0—, o sea que se entregó el monto entero. Contarlas cero le
    // quitaba a la caja $28.900.000 que sí salieron.
    expect(src).toMatch(/const deuda = deudaPorPrestamoViejo\?\.get\(p\.renovadoDeId\)/)
    expect(src).toMatch(/Math\.max\(0, p\.montoPrestado - deuda\)/)
  })

  it('sin dato del viejo se cae del lado prudente', () => {
    expect(src).toMatch(/if \(deuda == null\) return 0/)
  })

  it('un préstamo NUEVO entrega su monto entero', () => {
    expect(src).toMatch(/if \(!p\.renovadoDeId\) return p\.montoPrestado/)
  })

  it('⚠ renovadoDeId es un campo suelto, NO una relación de Prisma', () => {
    // Por eso el viejo se busca aparte: pedirlo con `include: { renovadoDe }`
    // sería un error 500 en ejecución que el build no ve.
    const esquema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(esquema).toMatch(/renovadoDeId\s+String\?/)
    expect(esquema, 'si ya existe la relación, esta consulta aparte sobra')
      .not.toMatch(/renovadoDe\s+Prestamo\s/)
    expect(src).toMatch(/async function deudasDeLosViejos/)
  })
})

describe('las dos ramas usan la MISMA regla', () => {
  it('un solo ayudante, no una copia por rama', () => {
    // Este fichero existe porque la función estaba duplicada y eso costó $425
    // millones. El fallback volvió a estar escrito dos veces y una se quedó
    // atrás: la global no descontaba nada.
    expect((src.match(/const montoEntregadoSinMovimiento/g) ?? []).length).toBe(1)
    expect((src.match(/montoEntregadoSinMovimiento\(p, deuda/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('el VALOR de las cartulinas sigue existiendo aparte', () => {
  it('el dueño lo pidió: «para yo saber cuánto presta el cobrador en el día»', () => {
    const api = readFileSync(resolve(process.cwd(), 'app/api/caja/route.js'), 'utf8')
    expect(api).toMatch(/valorPrestadoDia: prestadoDetalle\.valorPrestado/)
    expect(api).toMatch(/efectivoEntregadoDia: prestadoDetalle\.efectivoEntregado/)
  })
})
