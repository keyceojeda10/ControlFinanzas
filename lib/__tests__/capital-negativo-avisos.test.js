// Los avisos de capital en negativo NO pueden acusar de que falta plata.
//
// ── POR QUÉ EXISTE ESTA PRUEBA ─────────────────────────────────────────────
//
// Yo puse un aviso que decía «salió plata que no se registró como entrada».
// Suena a robo. Lo comprobé después contra la base de producción y es FALSO:
//
//   · Los 253 negocios cuadran AL PESO con la fórmula de `lib/capital.js`
//     (replicada movimiento a movimiento y en el mismo orden). No hay bug de
//     aritmética. Mi primera medición dijo lo contrario, pero el error era mío:
//     sumaba todos los `ajuste` en positivo, y `esIngresoMovimiento()` decide el
//     signo comparando `saldoNuevo` con `saldoAnterior`.
//   · De los 107 negocios con saldo negativo, **106 se explican enteros por la
//     cartera viva**: lo que «falta» es MENOS de lo que tienen prestado.
//   · 98 de 107 nunca registraron capital inicial; 100 de 107 prestaron antes
//     de meter plata al sistema.
//
// O sea: no salió plata de más, faltó declarar la de partida. Un aviso que
// insinúa un faltante en la pantalla del dinero hace que alguien desconfíe de
// su propio sistema —o de su cobrador— sin motivo.
//
// Es una prueba de TEXTO porque lo que se vigila es lo que LEE el dueño.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (p) => readFileSync(join(process.cwd(), p), 'utf8')
// Sin comentarios: aquí se juzga lo que se PINTA, y los comentarios citan a
// propósito las frases viejas para que no vuelvan.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PANTALLAS = [
  'components/caja/CajaPorRuta.jsx',
  'components/caja/CajaCobradorDetalle.jsx',
  'app/(dashboard)/caja/page.jsx',
]

describe('ningún aviso insinúa que falte plata', () => {
  it('no vuelve «salió plata que no se registró»', () => {
    for (const p of PANTALLAS) {
      expect(sinComentarios(leer(p)), p).not.toMatch(/salió plata que no se registró/i)
    }
  })

  it('no vuelve «salió … más de lo que entró»', () => {
    for (const p of PANTALLAS) {
      expect(sinComentarios(leer(p)), p).not.toMatch(/más de lo que entró/i)
    }
  })
})

describe('los avisos dicen la causa real y cómo arreglarlo', () => {
  it('la caja por ruta explica que la plata está en la calle', () => {
    const t = sinComentarios(leer('components/caja/CajaPorRuta.jsx'))
    expect(t).toMatch(/no se perdió/i)
    expect(t).toMatch(/está en la calle/i)
    expect(t).toMatch(/Inyectar a la ruta/)
  })

  it('la caja del cobrador dice que falta registrar el capital', () => {
    const t = sinComentarios(leer('components/caja/CajaCobradorDetalle.jsx'))
    expect(t).toMatch(/falta registrar su capital|le falta registrar/i)
    expect(t).toMatch(/no se perdió/i)
    expect(t).toMatch(/Inyectar a la ruta/)
  })

  it('el capital del negocio explica el «en caja» negativo', () => {
    const t = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    expect(t).toMatch(/Falta registrar con cuánto empezaste/)
    expect(t).toMatch(/no se perdió/i)
    expect(t).toMatch(/Inyectar capital/)
  })

  it('el aviso del negocio solo sale si el saldo es NEGATIVO', () => {
    // 146 de 253 negocios están bien: ahí no sobra un aviso.
    const t = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    expect(t).toMatch(/capitalOrganizacion\.saldoCaja \?\? 0\) < 0/)
    expect(t).toMatch(/saldoGeneralActual < 0/)
  })

  it('está donde el dueño VE el número rojo, no solo en la tarjeta de capital', () => {
    // La primera versión la puse en `capitalOrganizacion`, que es otra tarjeta:
    // en la captura, «Saldo del capital» salía en −$2.450.000 sin una palabra.
    // El aviso tiene que estar pegado a la cifra que se ve.
    const t = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))
    const i = t.indexOf('Saldo del capital')
    expect(i).toBeGreaterThan(-1)
    // El aviso aparece dentro de esa misma tarjeta (en las ~2.000 letras
    // siguientes), no en otra parte del archivo.
    expect(t.slice(i, i + 2000)).toMatch(/Falta registrar con cuánto empezaste/)
  })
})
