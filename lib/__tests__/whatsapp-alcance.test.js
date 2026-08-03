// «Enviar por WhatsApp» tiene que ESTAR A LA VISTA, con su nombre.
//
// ── POR QUÉ EXISTE ESTA PRUEBA ─────────────────────────────────────────────
//
// Un cobrador lo reportó en audio y video: «le estoy haciendo el crédito, le
// quiero mandar crédito aprobado y no puedo, no veo la opción»... «yo sé que
// están ahí en el programa, no se han perdido, pero no llego fácilmente».
//
// Y tenía razón en las dos cosas: la función existía y no se veía.
//
//  · En el CLIENTE estaba solo como un círculo verde sin rótulo, mientras
//    debajo había siete acciones CON LETRA. En su grabación el botón sale en
//    pantalla mientras lo busca.
//  · En el PRÉSTAMO los tres `BotonCompartir` son CONDICIONALES —tras un pago o
//    al completarse—, así que en un préstamo activo no había ninguno.
//  · Y los préstamos del cliente estaban DEBAJO de esas siete acciones: con dos
//    créditos, «me toca ir y buscar, pero buscar, buscar».
//
// Lo que se vigila: que las tres cosas sigan donde se pueden encontrar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (p) => readFileSync(join(process.cwd(), p), 'utf8')
// Sin comentarios: aquí se juzga lo que se PINTA. Los comentarios citan a
// propósito el problema viejo.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CLIENTE = sinComentarios(leer('app/(dashboard)/clientes/[id]/page.jsx'))
const PRESTAMO = sinComentarios(leer('app/(dashboard)/prestamos/[id]/page.jsx'))

describe('el envío por WhatsApp se ve, no solo se adivina', () => {
  it('en el cliente es una acción CON NOMBRE, no solo el icono', () => {
    expect(CLIENTE).toMatch(/label: 'Enviar por WhatsApp'/)
  })

  it('en el préstamo también, y en un préstamo ACTIVO', () => {
    // Los `BotonCompartir` de esa pantalla son condicionales (tras un pago o al
    // completarse). Este chip no depende de que haya pasado nada.
    //
    // El rótulo es «WhatsApp» a secas: en el chip, «Enviar por WhatsApp» se
    // cortaba en «Enviar por Wh…». Se vio en la captura, no en el código.
    expect(PRESTAMO).toMatch(/label: 'WhatsApp'/)
    expect(PRESTAMO).toMatch(/sublabel: 'Enviar crédito o recibo'/)
  })

  it('el del préstamo abre la plantilla de «crédito aprobado»', () => {
    // Es lo que él quiere mandar: «crédito aprobado por tanto y de una».
    expect(PRESTAMO).toMatch(/setWaSugerida\('credito_aprobado'\); setModalWA\(true\)/)
  })

  it('solo sale si el cliente tiene teléfono', () => {
    // Sin número no hay a quién mandarle; un botón que no puede funcionar es
    // peor que ninguno.
    expect(CLIENTE).toMatch(/cliente\.telefono \? \[\{/)
    expect(PRESTAMO).toMatch(/cliente\?\.telefono \? \[\{/)
  })

  it('el icono verde de la tarjeta NO se quita', () => {
    // Quien ya aprendió ese camino no lo pierde: esto AÑADE, no reemplaza.
    expect(CLIENTE).toMatch(/onWhatsApp=\{cliente\.telefono/)
  })
})

describe('los préstamos del cliente van antes que las acciones', () => {
  // ⚠ Contra el RENDER (`<AccionesClienteChips`), no contra el `import` del
  // mismo nombre que está en la línea 24: comparar con el import daba un
  // «falla» con el orden ya correcto.
  const iRender = CLIENTE.indexOf('<AccionesClienteChips')

  it('se entra a un cliente para ver sus créditos', () => {
    // Con dos créditos activos, tenerlos detrás de siete acciones —incluida
    // «Fijar ubicación (GPS)»— es la pantalla contradiciendo su propio motivo.
    const iPrestamos = CLIENTE.indexOf('Préstamos activos')
    expect(iPrestamos).toBeGreaterThan(-1)
    expect(iRender).toBeGreaterThan(-1)
    expect(iPrestamos).toBeLessThan(iRender)
  })

  it('no se perdió ninguna acción por el camino', () => {
    // El cambio es de ORDEN, no de contenido: las siete siguen.
    for (const a of ['Reagendar visita', 'Historial', 'QR', 'Editar']) {
      expect(CLIENTE, `falta la acción «${a}»`).toMatch(new RegExp(`'${a}'`))
    }
  })

  it('el estado «sin préstamos» viaja con el bloque', () => {
    // Si se hubiera quedado abajo, un cliente sin créditos vería las acciones y
    // luego, muy abajo, un «Sin préstamos activos» huérfano.
    const iVacio = CLIENTE.indexOf('Sin préstamos activos')
    expect(iVacio).toBeGreaterThan(-1)
    expect(iVacio).toBeLessThan(iRender)
  })
})
