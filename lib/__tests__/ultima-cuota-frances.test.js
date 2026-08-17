// lib/__tests__/ultima-cuota-frances.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Se sigue presentando cuando se va a crear un préstamo: cuando se escoge el
//  interés a saldo (sistema francés) siempre el cálculo es incorrecto, en cuanto
//  la última cuota queda en $0, o un valor inferior, o incluso un valor
//  exageradamente grande, y el valor de las cuotas por ende no son los que
//  corresponden.»  — Préstamos Rincón, 17 ago 2026 (segunda vez)
//
// Lo medido contra producción: 115 préstamos a saldo con tabla, 22 con la
// última cuota fuera de ±10%, y LOS 22 con cuota escrita a mano. Los que dejan
// calcular salen parejos, los suyos incluidos.
//
// Así que aquí NO se prueba «que la última cuota sea igual» —no puede serlo si
// uno fija las cuatro cifras—, sino las tres cosas que sí tienen que cumplirse:
//
//   1. Que quien deja calcular NO reciba el aviso. Un aviso que sale siempre es
//      ruido y se aprende a ignorarlo.
//   2. Que las dos salidas que se ofrecen SEAN salidas de verdad: la cuota que
//      se propone tiene que dejar la tabla pareja, y el plazo que se propone
//      tiene que saldar la deuda. Se comprueba VOLVIENDO A CALCULAR con lo que
//      propone, no comparando contra un número escrito a mano aquí.
//   3. Que el aviso salga en los tres sitios donde se calcula un préstamo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calcularPrestamo } from '@/lib/calculos'

const base = {
  modoInteres: 'saldo',
  frecuencia: 'mensual',
  fechaInicio: '2026-08-01',
}
/* ⚠ `montoPrestado` y `tasaInteres`, NO `monto`/`tasa`. Con los nombres
   cortos la función no revienta: calcula con NaN y devuelve cifras nulas que
   parecen un fallo del cálculo. Me costó un rato aquí mismo. */
const calc = (extra) => calcularPrestamo({ ...base, ...extra })

/* Los dos casos vivos que encontró la medida, con sus cifras. No se escribe el
   resultado esperado: se comprueba la relación entre lo que salió y lo que se
   propone. */
const YANERIS = { montoPrestado: 2000000, tasaInteres: 5, diasPlazo: 180, cuotaManual: 430000 }   // última en $0
const TERESA = { montoPrestado: 5000000, tasaInteres: 5, diasPlazo: 390, cuotaManual: 500000 }    // última disparada

describe('⚠ el aviso sale solo cuando hay algo que avisar', () => {
  it('quien deja calcular la cuota no recibe aviso', () => {
    /* El caso real de Rincón: 12 cuotas, sin cuota a mano. Sale $120.700 y la
       última $120.530 —una diferencia de redondeo, no un descuadre. */
    const r = calc({ montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 360 })
    expect(r.cuotaEscritaAMano).toBe(false)
    expect(r.ultimaDesencajada).toBe(false)
  })

  it('con la última en $0 sí avisa', () => {
    const r = calc(YANERIS)
    expect(r.ultimaCuota).toBeLessThan(r.cuotaDiaria)
    expect(r.ultimaDesencajada).toBe(true)
  })

  it('con la última disparada sí avisa', () => {
    const r = calc(TERESA)
    expect(r.ultimaCuota).toBeGreaterThan(r.cuotaDiaria * 2)
    expect(r.ultimaDesencajada).toBe(true)
  })

  it('una diferencia de unos pesos no molesta a nadie', () => {
    /* El umbral es el mayor de $1.000 o el 5% de la cuota. Si alguien lo bajara
       a cero, el aviso saldría en casi todos los préstamos a saldo, porque el
       redondeo a la centena de arriba deja siempre unos pesos de cola. */
    const r = calc({ montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 360 })
    const cola = Math.abs(r.ultimaCuota - r.cuotaDiaria)
    expect(cola).toBeGreaterThan(0)
    expect(cola).toBeLessThan(Math.max(1000, r.cuotaDiaria * 0.05))
  })
})

describe('⚠ las dos salidas llevan de verdad a alguna parte', () => {
  for (const [quien, caso] of [['la última en $0', YANERIS], ['la última disparada', TERESA]]) {
    it(`«todas de X» deja la tabla pareja — ${quien}`, () => {
      const r = calc(caso)
      expect(r.cuotaQueCuadra).toBeGreaterThan(0)

      // Se vuelve a calcular CON lo que propone. Es la única forma de saber que
      // la salida sirve: comparar contra un número escrito aquí probaría que la
      // fórmula no cambió, no que el préstamo queda parejo.
      const otra = calc({ ...caso, cuotaManual: r.cuotaQueCuadra })
      expect(otra.ultimaDesencajada).toBe(false)
    })

    it(`«cobrar N veces» dice la verdad: salda, pero deja cola — ${quien}`, () => {
      const r = calc(caso)
      expect(r.periodosParaSaldar).toBeGreaterThan(0)

      /* ⚠ ESTA SALIDA NO IGUALA LAS CUOTAS, y por poco lo escribo así en la
         pantalla. Al recalcular con el plazo que propone, la última SIGUE
         siendo distinta: es una cola. Lo que sí garantiza —y es lo que se le
         promete al prestamista— es que la última deja de estar por ENCIMA de
         la cuota: nada de cerrar con $1.071.754 cuando se cobran $500.000. */
      const otra = calc({ ...caso, diasPlazo: r.diasPeriodo * r.periodosParaSaldar })
      expect(otra.numPeriodos).toBe(r.periodosParaSaldar)
      expect(otra.ultimaCuota).toBeGreaterThan(0)
      expect(otra.ultimaCuota).toBeLessThanOrEqual(r.cuotaDiaria)
    })

    it(`la cola que anuncia es la que sale — ${quien}`, () => {
      /* El aviso enseña esa cifra antes de tocar nada. Si el anuncio y el
         recálculo no coincidieran, la pantalla estaría prometiendo un número
         que la tabla no da: exactamente la queja que se está arreglando. */
      const r = calc(caso)
      const otra = calc({ ...caso, diasPlazo: r.diasPeriodo * r.periodosParaSaldar })
      expect(r.ultimaAlSaldar).toBe(otra.ultimaCuota)
    })

  }

  it('la cuota que se propone no es la que ya está puesta', () => {
    /* Un botón que deja todo igual es peor que no tener botón. */
    const r = calc(YANERIS)
    expect(r.cuotaQueCuadra).not.toBe(r.cuotaDiaria)
  })
})

describe('⚠ el aviso está en los tres sitios donde se calcula un préstamo', () => {
  /* Esta app ya arregló un comprobante por una vía y lo dejó roto por la otra;
     el dueño lo reportó dos días seguidos. Aquí son tres pantallas y hay que
     nombrarlas una por una: crear, editar y el estreno. */
  const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  const SITIOS = [
    ['crear un préstamo', 'app/(dashboard)/prestamos/nuevo/page.jsx'],
    ['corregir uno hecho', 'components/prestamos/EditarPrestamo.jsx'],
    ['el resumen compartido', 'components/prestamos/ResumenCalculo.jsx'],
  ]

  for (const [que, ruta] of SITIOS) {
    it(`${que} lo pinta`, () => {
      const src = leer(ruta)
      expect(src, `«${que}» no muestra el aviso`).toMatch(/<AvisoUltimaCuota/)
      expect(src).toMatch(/from '@\/components\/prestamos\/AvisoUltimaCuota'|from '\.\/AvisoUltimaCuota'/)
    })
  }

  it('y en crear y editar los botones están conectados', () => {
    /* El fallo del selector de cuenta al renovar: el componente estaba puesto y
       nadie le pasaba los datos, así que se guardaba invisible. */
    for (const ruta of ['app/(dashboard)/prestamos/nuevo/page.jsx', 'components/prestamos/EditarPrestamo.jsx']) {
      const src = leer(ruta)
      const bloque = src.slice(src.indexOf('<AvisoUltimaCuota'), src.indexOf('<AvisoUltimaCuota') + 400)
      expect(bloque, `${ruta}: el botón de la cuota no hace nada`).toMatch(/onCuota=\{/)
      expect(bloque, `${ruta}: el botón del plazo no hace nada`).toMatch(/onPlazo=\{/)
    }
  })
})
