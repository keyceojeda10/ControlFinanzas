// lib/__tests__/marca-no-es-el-acreedor.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño lo planteó como un riesgo futuro: «puede que los clientes de mis
// usuarios vayan a creer que Control Finanzas es el que realiza préstamos».
//
// Al medirlo, ya estaba pasando, y no por accidente sino por diseño:
//
//   · El recibo térmico que el cobrador le deja EN LA MANO al deudor decía
//     `CONTROL FINANZAS` en 15px y el nombre del negocio debajo, en 11 y gris.
//   · La firma de TODAS las plantillas de WhatsApp caía a `_Control Finanzas_`
//     cuando al negocio le faltaba el nombre — incluida la de mora crítica, que
//     dice «Última oportunidad antes de cobro jurídico».
//   · El portal donde el deudor consulta su deuda tenía nuestro logo y la
//     pestaña decía «Mi Portal - Control Finanzas».
//   · `Recibo.jsx` traía `negocio = 'Control Finanzas'` por defecto.
//
// La regla que se prueba aquí es una sola: **el software nunca firma como
// acreedor**. Puede aparecer, pero como lo que es y diciéndolo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* ⚠ SIN COMENTARIOS. Las notas del código CITAN lo que se prohíbe —«aquí decía
   CONTROL FINANZAS», «volvió el logo»— para poder explicar por qué se quitó. Una
   prueba sobre el texto entero se acusa a sí misma: la primera versión de este
   archivo falló por sus propios comentarios. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith('//')).join(String.fromCharCode(10))

const leer = (p) => sinNotas(readFileSync(resolve(process.cwd(), p), 'utf8'))
const leerCrudo = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const ROL = 'no presta dinero ni realiza cobros'

describe('el software no firma como si fuera el acreedor', () => {
  it('⚠ ninguna plantilla de WhatsApp firma con nuestra marca', () => {
    /* Sin nombre de negocio, el mensaje va SIN firma. Antes iba firmado por
       nosotros, y el peor caso era el aviso que amenaza con cobro jurídico. */
    for (const f of [
      'lib/whatsapp-plantillas.js',
      'lib/whatsapp.js',
      'components/ui/ModalWhatsAppTemplates.jsx',
      'components/whatsapp/HojaWhatsApp.jsx',
    ]) {
      expect(leer(f), `${f} volvió a firmar con la marca`).not.toContain("'_Control Finanzas_'")
    }
  })

  it('el recibo en mano lleva primero al negocio, no a nosotros', () => {
    const recibo = leer('components/ui/BotonImprimirRecibo.jsx')
    // La cabecera grande es del negocio.
    expect(recibo).toMatch(/font-size:15px[^>]*>\$\{\(orgNombre \|\| ''\)\.toUpperCase\(\)/)
    // Y nuestra marca solo aparece explicando el papel que cumple.
    expect(recibo).toContain(ROL)
    expect(recibo, 'el dominio suelto invita a creer que aquí se presta').not.toContain('www.control-finanzas.com')
  })

  it('no quedan valores por defecto que nos pongan de emisor', () => {
    expect(leer('components/pantallas/Recibo.jsx')).not.toContain("negocio = 'Control Finanzas'")
    expect(leer('lib/papel/documento.js')).not.toContain("pie = 'Control Finanzas'")
    expect(leer('lib/papel/documento.js')).toContain(ROL)
  })

  it('el portal del deudor no lleva nuestra marca en la pestaña ni el logo', () => {
    const layout = leer('app/(portal)/portal/layout.jsx')
    expect(layout, 'la pestaña vuelve a decir nuestro nombre sobre la deuda').not.toContain('Mi Portal - Control Finanzas')

    const portal = leer('components/pantallas/PortalCliente.jsx')
    expect(portal, 'volvió el logo de la marca a la portada del deudor').not.toContain('/logo-icon.svg')
    // Y sí dice, en el pie, quién presta y quién no.
    expect(portal).toContain('no presta dinero, no cobra y no')
  })
})

describe('lo que el deudor firma dice qué firma', () => {
  it('⚠ la pantalla de firma nombra al acreedor y la autorización de datos', () => {
    /* Antes el cliente trazaba su firma viendo solo tres cifras. Las cláusulas
       estaban en un PDF que se genera después y que él no ve. */
    const pagare = leer('components/pantallas/Pagare.jsx')
    expect(pagare).toMatch(/autoriza a/)
    expect(pagare).toMatch(/datos personales/)
    expect(pagare).toContain('acreedor')

    // Y el acreedor que se pinta es el negocio, no nosotros.
    const firma = leer('components/prestamos/FirmaDigital.jsx')
    expect(firma).toMatch(/acreedor=\{orgNombre\}/)
  })
})
