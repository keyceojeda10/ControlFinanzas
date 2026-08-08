// lib/__tests__/papel-paginas.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «La mayoría de los PDF se ven súper feos y **siempre tienen hojas de más**.»
//
// Las hojas de más nunca fueron cosa del contenido: PDFKit **abre una página**
// cuando le mandas escribir algo que no cabe donde le dices. Y eso pasó tres
// veces seguidas, cada una por un motivo distinto y ninguna visible leyendo el
// código:
//
//   1. El pie dibujado a `alto - 32` = 760, con el área útil acabando en 752.
//   2. Yo mismo, al escribir el kit, lo puse en 758. Un documento con SOLO la
//      cabecera salía en 3 páginas.
//   3. Y el peor: el pie **cabía en alto pero no en ancho**. Un negocio del
//      espejo se llama «PRESTA MIL 3223846884 número SUPERVISOR para
//      información sobre su crédito o reclamos». El texto se partía en dos
//      renglones y el segundo abría una página. UNA POR CADA PÁGINA: el
//      listado salía en 90 hojas y el propio documento decía «Página 45 de
//      45». La última llevaba «o reclamos» y nada más.
//
// ⚠ El número que imprime el documento NO SIRVE para comprobar esto: se calcula
// antes de que se creen las páginas de sobra. Hay que contar las del archivo.
//
// `lineBreak: false` tampoco basta: PDFKit reparte igual si el texto no entra
// en el `width`. Lo que obliga a un renglón es `height` + `ellipsis`.

import { describe, it, expect } from 'vitest'
import { abrirDocumento } from '../papel/documento.js'

/** Las páginas REALES del archivo, no las que el documento dice tener. */
function paginasDe(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
}

const LARGUISIMO = 'PRESTA MIL 3223846884 número SUPERVISOR para información sobre su crédito o reclamos'

describe('las hojas de más', () => {
  it('una cabecera sola ocupa una hoja', async () => {
    const d = abrirDocumento()
    d.cabecera({ negocio: 'Mi negocio', titulo: 'Prueba' })
    expect(paginasDe(await d.cerrar())).toBe(1)
  })

  it('un pie larguísimo no añade hojas', async () => {
    const corto = abrirDocumento({ pie: 'Control Finanzas' })
    corto.cabecera({ negocio: 'X', titulo: 'Prueba' })
    const conPieCorto = paginasDe(await corto.cerrar())

    const largo = abrirDocumento({ pie: `Control Finanzas · ${LARGUISIMO}` })
    largo.cabecera({ negocio: 'X', titulo: 'Prueba' })
    const conPieLargo = paginasDe(await largo.cerrar())

    expect(conPieLargo).toBe(conPieCorto)
  })

  it('el pie no duplica las hojas de un documento largo', async () => {
    const filas = Array.from({ length: 120 }, (_, i) => ({
      nombre: `Cliente numero ${i + 1} con nombre bastante largo`,
      dir: `Manzana ${i} casa ${i * 2}, barrio Villa del Rosario etapa 3, frente a la cancha`,
      saldo: '$1.480.000',
    }))
    const columnas = [
      { clave: 'nombre', titulo: 'Cliente', ancho: 5, identidad: true, sub: 'dir' },
      { clave: 'saldo', titulo: 'Debe', ancho: 2, fuente: 'cifra' },
    ]

    const medir = async (pie) => {
      const d = abrirDocumento({ pie })
      d.tabla({ columnas, filas }, d.cabecera({ negocio: 'X', titulo: 'Quién me debe' }))
      return paginasDe(await d.cerrar())
    }

    const corto = await medir('Control Finanzas')
    const largo = await medir(`Control Finanzas · ${LARGUISIMO}`)

    // Antes esto daba exactamente el doble.
    expect(largo).toBe(corto)
    expect(corto).toBeGreaterThan(1)
  })

  it('el nombre del negocio no se reparte en varios renglones', async () => {
    /* La cabecera encoge la letra hasta que entra. Si volviera a repartirse,
       empujaría el título y la fecha, que es lo que pasaba: tres renglones
       encima del resto de la cabecera. Se comprueba por la altura que devuelve:
       tiene que ser la misma con un nombre corto que con uno de 100 letras. */
    const cortoDoc = abrirDocumento()
    const yCorto = cortoDoc.cabecera({ negocio: 'Mi negocio', titulo: 'Prueba', subtitulo: 'hoy' })
    await cortoDoc.cerrar()

    const largoDoc = abrirDocumento()
    const yLargo = largoDoc.cabecera({ negocio: LARGUISIMO, titulo: 'Prueba', subtitulo: 'hoy' })
    await largoDoc.cerrar()

    expect(yLargo).toBe(yCorto)
  })
})
