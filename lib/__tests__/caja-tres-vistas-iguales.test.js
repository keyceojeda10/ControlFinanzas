import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL MISMO COBRADOR DABA TRES CIFRAS SEGÚN DÓNDE MIRARAS ──────────────────
//
// Tres consultas contestan «¿cuánto movió hoy este cobrador?» y cada una contaba
// distinto:
//
//   (A) getStatsDia(…, cobradorId)   cobros SOLO de quien los tecleó
//   (B) el array `cobradores[]`      cobros SOLO de quien los tecleó · gastos SOLO aprobados
//   (C) la ficha del cobrador        cobros de su RUTA también · gastos pend+aprob
//
// Medido en producción antes de tocar nada:
//   · 132 pagos, $5.444.000 en 7 días que C sumaba y A/B no (5 cobradores)
//   · 10 gastos sin aprobar, $189.000, que A y C restaban y B no (4 cobradores)
//
// Manda el criterio de C —lo suyo es SU RUTA— porque es el que arregló el caso
// de reasignar una ruta: sin él la caja mostraba el PRESTADO de la ruta y
// «Cobrado $0», porque los pagos los había registrado otro.

const caja = readFileSync(resolve(process.cwd(), 'app/api/caja/route.js'), 'utf8')
const ficha = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

describe('los cobros: lo suyo es su ruta, no solo lo que tecleó', () => {
  it('(A) la caja filtrada por cobrador incluye su ruta', () => {
    // Era `wherePagos.cobradorId = cobradorId` a secas.
    expect(caja).toMatch(/const rutasDelCobrador = await rutaIdsDe\(organizationId, cobradorId\)/)
    expect(caja).toMatch(/wherePagos\.OR = \[/)
  })

  it('(B) el listado del dueño atribuye el pago al cobrador de la RUTA', () => {
    // Era un `groupBy(['cobradorId'])`: solo veía a quien lo tecleó.
    expect(caja, 'volvió el groupBy que solo miraba quién registró el pago')
      .not.toMatch(/groupBy\(\{\s*by: \['cobradorId'\]/)
    expect(caja).toMatch(/const deLaRuta = pago\.prestamo\?\.cliente\?\.ruta\?\.cobradorId/)
  })

  it('⚠ y un pago NO se cuenta dos veces cuando coinciden', () => {
    // Es el caso normal: quien cobra suele ser el de la ruta. Sumarlo dos veces
    // duplicaría la caja de casi todo el mundo.
    expect(caja).toMatch(/new Set\(\[quienCobro, deLaRuta\]\.filter\(Boolean\)\)/)
  })

  it('la LISTA de pagos trae los mismos que el total', () => {
    // Si el total incluye los de la ruta y la lista no, el cobrador ve una suma
    // que no puede reconstruir con lo que le enseñan.
    expect(caja).toMatch(/wherePagosDia\.OR = \[/)
  })

  it('(C) ya lo hacía así, y no se toca', () => {
    expect(ficha).toMatch(/OR: \[\s*\{ cobradorId \},/)
  })
})

describe('los gastos: pendiente + aprobado en las tres', () => {
  it('(B) ya no cuenta solo los aprobados', () => {
    // Un gasto sin aprobar hacía que el listado del dueño y la ficha del
    // cobrador dijeran cifras distintas de la misma persona el mismo día.
    const bloque = caja.slice(caja.indexOf('const [prestadoDia, segurosDia, gastosAgg'))
    expect(bloque.slice(0, 1400), 'volvió a contar solo los gastos aprobados')
      .toMatch(/estado: \{ in: \['pendiente', 'aprobado'\] \}/)
  })

  it('(A) y (C) siguen igual', () => {
    expect(caja).toMatch(/estado: \{ in: \['pendiente', 'aprobado'\] \}/)
    expect(ficha).toMatch(/estado: \{ in: \['pendiente', 'aprobado'\] \}/)
  })
})

describe('la vista bruta de (C) se puede comparar', () => {
  // `renovacionesEnCobrado` (6 de 417 organizaciones, PRESTA MIL entre ellas)
  // suma el saldo absorbido a lo cobrado Y a lo prestado. Es una vista legítima
  // y no se quita: se publica también la cifra neta, para que quien compare
  // tenga con qué y no parezca un descuadre.
  //
  // En la prueba de flujo: 683.300 contra 79.900, y 1.440.000 contra 836.600.
  // La diferencia era 603.400 EN LOS DOS LADOS — el absorbido.
  it('publica la cifra sin el ajuste bruto', () => {
    expect(ficha).toMatch(/cobradoDiaNeto: cobradoDia - ajusteBruto/)
    expect(ficha).toMatch(/prestadoDiaNeto: prestadoDia - ajusteBruto/)
  })

  it('y dice cuánto es ese ajuste, para poder explicarlo', () => {
    expect(ficha).toMatch(/absorbidoEnCobrado: ajusteBruto/)
  })

  it('la bruta se conserva: es lo que el negocio pidió ver', () => {
    expect(ficha).toMatch(/^\s+cobradoDia,$/m)
    expect(ficha).toMatch(/^\s+prestadoDia,$/m)
  })
})

describe('la prueba de flujo compara lo comparable', () => {
  it('lee la cifra neta de (C)', () => {
    const informe = readFileSync(resolve(process.cwd(), 'scripts/prueba-dinero/informe.mjs'), 'utf8')
    expect(informe).toMatch(/v\.C\?\.resumen\?\.cobradoDiaNeto \?\? v\.C\?\.resumen\?\.cobradoDia/)
    expect(informe).toMatch(/v\.C\?\.resumen\?\.prestadoDiaNeto \?\? v\.C\?\.resumen\?\.prestadoDia/)
  })
})
