// lib/__tests__/la-caja-sabe-decir-retiro.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Dame un retiro mi amigo.»
//   — Oswaldo Castilla (Inversiones L&D), 16 ago 2026.
//
// Sacó $282.000 del negocio para comprarle una cicla a su mamá. En la caja solo
// había «Registrar gasto» y un selector de «Ingreso / Egreso» que guardaba las
// dos cosas como `ajuste`. No había forma de decir «saqué plata del negocio».
//
// Así que lo registró como GASTO, y a partir de ahí:
//   09:05 gasto · 09:07 ajuste · 09:13 borrar · 09:14 ajuste · 11:40 otra vez ·
//   11:48 cerrar · 11:51 ajuste. Toda la mañana.
//
// ⚠ EL SERVIDOR YA SABÍA HACERLO. `/api/caja/ajustes` acepta `inyeccion`,
//   `retiro` y `ajuste` desde hace tiempo, la conciliación ya resta los retiros
//   del neto y la banda ya tiene su renglón «Plata que sacaste». Lo único que
//   faltaba era PREGUNTARLO. Es el mismo patrón que los reportes de Rincón: la
//   función está, pero no donde se busca.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const CAJA = readFileSync(resolve(process.cwd(), 'app/(dashboard)/caja/page.jsx'), 'utf8')
const API = readFileSync(resolve(process.cwd(), 'app/api/caja/ajustes/route.js'), 'utf8')
const CONC = readFileSync(resolve(process.cwd(), 'lib/dinero/conciliacion.js'), 'utf8')

describe('⚠ desde la caja se puede decir que se sacó plata', () => {
  it('la pantalla ofrece los cuatro movimientos', () => {
    for (const id of ['inyeccion', 'retiro', 'sobra', 'falta']) {
      expect(CAJA, `falta la opción «${id}»`).toMatch(new RegExp(`id: '${id}'`))
    }
  })

  it('y manda el tipo que se eligió, no siempre «ajuste»', () => {
    expect(CAJA).toMatch(/movimiento: ajusteTipo\.movimiento/)
    expect(CAJA).toMatch(/direccion: ajusteTipo\.direccion/)
  })

  it('⚠ NINGUNA viene marcada de entrada', () => {
    /* Antes salía «Ingreso» puesto y todo caía en `ajuste`. Si una de las nuevas
       viniera marcada, a quien no mire el selector le cambiaríamos el TIPO de
       sus movimientos sin que se entere. */
    expect(CAJA).toMatch(/const \[ajusteTipo, setAjusteTipo\] = useState\(null\)/)
    expect(CAJA).toMatch(/if \(!ajusteTipo\)/)
  })

  it('el servidor acepta esos tipos', () => {
    expect(API).toMatch(/\['inyeccion', 'retiro', 'ajuste'\]\.includes\(movimientoSolicitado\)/)
  })
})

describe('⚠ y un retiro no inventa un descuadre', () => {
  /* Si la conciliación no lo restara, ofrecer el retiro crearía justo el fallo
     que se acaba de arreglar con los gastos: la pantalla diría «sin explicación»
     por una plata que sí está explicada. */
  it('el neto del libro resta los retiros', () => {
    expect(CONC).toMatch(/libro\.recaudo \+ libro\.inyecciones - libro\.desembolsos - libro\.gastos - libro\.retiros \+ libro\.ajustes/)
  })

  it('y la banda le da su renglón, o las líneas no sumarían el saldo', () => {
    expect(CONC).toMatch(/id: 'retiros', rotulo: 'Plata que sacaste'/)
    expect(CONC).toMatch(/id: 'inyecciones', rotulo: 'Plata que metiste'/)
  })
})
