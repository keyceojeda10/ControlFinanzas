// lib/__tests__/nequi-medio-de-pago.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El widget de Wompi en modo tokenización NO cierra el círculo en Colombia.
// Probado el 1 sep 2026 con un Nequi de verdad: el push llegó al teléfono del
// dueño, pero el POST que el widget debía hacer a `/api/pagos/wompi/token`
// **nunca llegó** — cero registros en los logs. Solo está documentado para
// Panamá.
//
// ⚠ Y NEQUI ES EL CAMINO QUE IMPORTA. De las últimas doce suscripciones
// cobradas por Wompi: **ocho con Nequi**, dos con transferencia de Bancolombia,
// una con Daviplata y **una sola con tarjeta**. Un cobro recurrente que solo
// entienda de tarjetas no le sirve a dos tercios de quien paga.
//
// Esto comprueba el camino nuevo, que va entero por el servidor con API
// documentada: pedir el token → esperar a que apruebe en su app → guardar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { pedirTokenNequi } from '@/lib/wompi'

const raiz = resolve(__dirname, '../..')
const sinComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const endpoint = sinComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/nequi/route.js'), 'utf8'))
const hoja     = sinComentarios(readFileSync(resolve(raiz, 'components/pagos/HojaSuscripcion.jsx'), 'utf8'))
const wompi    = sinComentarios(readFileSync(resolve(raiz, 'lib/wompi.js'), 'utf8'))

describe('⚠ el número, antes de molestar a nadie', () => {
  it('rechaza lo que no son diez dígitos, sin llamar a Wompi', async () => {
    /* Cada llamada buena manda un push al teléfono de una persona. Un número
       mal escrito no puede convertirse en una notificación a un desconocido.
       ⚠ Se comprueba ANTES de tocar la red: si la validación viviera en Wompi,
       cada dedazo sería una notificación a quien no la pidió. */
    for (const malo of ['', '300', 'abcdefghij', null, undefined]) {
      await expect(pedirTokenNequi(malo)).rejects.toThrow(/diez dígitos/)
    }
  })

  it('y del número bueno se queda con los diez últimos', () => {
    /* Da igual que lo escriba con +57, con espacios o sin nada. */
    expect(wompi).toMatch(/replace\(\/\\D\/g, ''\)\.slice\(-10\)/)
  })
})

describe('⚠ el medio se guarda solo cuando Wompi dice APPROVED', () => {
  it('con el token PENDING no se guarda nada', () => {
    /* PENDING es «todavía no ha tocado Aceptar». Guardar ahí dejaría una fuente
       que no sirve y a la persona convencida de que ya está suscrita. */
    expect(endpoint).toMatch(/if \(estado !== 'APPROVED'\)/)
    /* La LLAMADA, no el import de arriba. */
    const guarda = endpoint.indexOf('await crearFuenteDePago(')
    const control = endpoint.indexOf("estado !== 'APPROVED'")
    expect(control).toBeGreaterThan(-1)
    expect(guarda).toBeGreaterThan(control)
  })

  it('y se guarda en el mismo paso que lo comprueba', () => {
    /* Si la creación de la fuente viviera en un tercer paso, una pantalla
       cerrada a destiempo dejaría el token aprobado sin usar. */
    expect(endpoint).toMatch(/wompiFuentePagoId: fuente\.id/)
    expect(endpoint).toMatch(/wompiFuenteTipo:\s*'NEQUI'/)
    expect(endpoint).toMatch(/cobroFallos:\s*0/)
  })

  it('solo el dueño, y solo con Wompi configurado', () => {
    expect(endpoint).toMatch(/rol !== 'owner'/)
    expect(endpoint).toMatch(/wompiConfigurado\(\)/)
  })
})

describe('⚠ la espera no deja el móvil girando para siempre', () => {
  it('se rinde a los tres minutos', () => {
    /* Wompi caduca el token si no lo tocan. Sin tope, la pantalla se queda
       preguntando hasta que la persona cierre la app. */
    expect(hoja).toMatch(/3 \* 60000/)
    expect(hoja).toMatch(/Se pasó el tiempo de espera/)
  })

  it('y para de preguntar si dice que no', () => {
    expect(hoja).toMatch(/DECLINED' \|\| e\.estado === 'VOIDED'/)
  })

  it('limpia el sondeo al cerrar la hoja', () => {
    /* Un `setInterval` vivo tras cerrar sigue llamando al servidor. */
    expect(hoja).toMatch(/clearInterval\(sondeo\.current\)/)
    expect(hoja).toMatch(/useEffect\(\(\) => \(\) => clearInterval/)
  })
})

describe('⚠ Nequi va primero porque es lo que usan', () => {
  it('el campo de Nequi está antes que el widget de tarjeta', () => {
    const nequi = hoja.indexOf('Tu número de Nequi')
    const tarjeta = hoja.indexOf('O con tarjeta')
    expect(nequi).toBeGreaterThan(-1)
    expect(tarjeta).toBeGreaterThan(nequi)
  })

  it('y se dice que no se cobra nada al guardarlo', () => {
    expect(hoja).toMatch(/No se cobra nada ahora/i)
  })
})
