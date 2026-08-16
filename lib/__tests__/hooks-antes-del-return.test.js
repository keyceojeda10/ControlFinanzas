// lib/__tests__/hooks-antes-del-return.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Estoy tratando de pasar los pagos y no se le va el comprobante al cliente.»
//   — un prestamista, 16 ago 2026, con la captura de la pantalla de error.
//
// `RegistrarPago` tiene DOS `return` a media función: los del comprobante, que
// se pintan cuando el pago ya se guardó. El interruptor de «aplazar el cobro»
// añadió un `useState` DESPUÉS de ellos, y con eso:
//
//   · mientras se escribe el pago, `exitoso` es falso → el hook se ejecuta;
//   · al guardarlo, `exitoso` pasa a true → el componente sale antes → no se
//     ejecuta.
//
// React cuenta un hook menos que en el render anterior y revienta con el error
// #300. El prestamista veía «no podemos conectarnos» EN LUGAR del recibo.
//
// El pago SÍ quedaba guardado —comprobado: 14 pagos registrados en la hora del
// fallo, uno por cada caída— pero él no lo sabía, y al menos un cobro de
// $700.000 se registró dos veces.
//
// Medido en producción: **15 caídas en una hora, 4 negocios, 4 usuarios y tres
// clases de teléfono distintos** (Android, iPhone y un PC).
//
// ⚠ MI PRIMERA VERSIÓN DE ESTA PRUEBA NO CAZABA EL FALLO. Buscaba hooks después
//   del primer `return` con sangría de dos espacios, y los `return` del
//   comprobante están DENTRO de un `if`, con cuatro. Contra el archivo roto daba
//   cero igual que contra el arreglado: habría pasado en verde con el fallo
//   puesto. Por eso ahora corre la regla de verdad —`react-hooks/rules-of-hooks`,
//   que ya estaba instalada y nadie ejecutaba— en vez de una expresión mía.

import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

/* Los que pintan dos cosas distintas según en qué punto esté el usuario, que es
   donde un hook mal puesto deja de ejecutarse a mitad de camino. */
const VIGILADOS = [
  'components/prestamos/RegistrarPago.jsx',
  'components/pantallas/RegistrarCobro.jsx',
  'app/(dashboard)/prestamos/[id]/page.jsx',
]

describe('⚠ ningún hook se llama condicionalmente', () => {
  it('las pantallas de cobro pasan react-hooks/rules-of-hooks', async () => {
    const eslint = new ESLint()
    const resultados = await eslint.lintFiles(VIGILADOS)

    const fallos = resultados.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === 'react-hooks/rules-of-hooks')
        .map((m) => `${r.filePath.split('/').pop()}:${m.line} — ${m.message}`))

    expect(fallos, fallos.join('\n')).toHaveLength(0)
  }, 60000)
})

describe('la regla que lo caza sigue puesta', () => {
  it('eslint no la tiene apagada', async () => {
    /* Si alguien la apaga «porque da ruido», esto vuelve a poder llegar a la
       calle sin que nada avise: ni las pruebas ni el build lo ven. */
    const eslint = new ESLint()
    const cfg = await eslint.calculateConfigForFile(VIGILADOS[0])
    const regla = cfg.rules?.['react-hooks/rules-of-hooks']
    const nivel = Array.isArray(regla) ? regla[0] : regla
    expect(nivel, 'la regla está apagada o no se aplica a este archivo').toBeTruthy()
    expect(['off', 0]).not.toContain(nivel)
  }, 60000)
})
