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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/* ⚠ SIN COMENTARIOS. Las notas del código CITAN lo que se prohíbe —«aquí decía
   CONTROL FINANZAS», «volvió el logo»— para poder explicar por qué se quitó. Una
   prueba sobre el texto entero se acusa a sí misma: la primera versión de este
   archivo falló por sus propios comentarios. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')

const leer = (p) => sinNotas(readFileSync(resolve(process.cwd(), p), 'utf8'))

function fuentes(dir, salida = []) {
  if (!existsSync(dir)) return salida
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '__tests__'].includes(e)) continue
    const f = join(dir, e)
    if (statSync(f).isDirectory()) fuentes(f, salida)
    else if (/\.jsx?$/.test(f)) salida.push(f)
  }
  return salida
}

const ROL = 'no presta dinero ni realiza cobros'

describe('el software no firma como si fuera el acreedor', () => {
  it('⚠ NINGÚN archivo del código firma con nuestra marca', () => {
    /* Sin nombre de negocio, el mensaje va SIN firma. Antes iba firmado por
       nosotros, y el peor caso era el aviso que amenaza con cobro jurídico.

       ⚠ La primera versión de esta prueba miraba solo los cuatro archivos que
       yo había revisado a mano, y por eso se le escapó `ReporteDia.jsx`: el
       reporte del día, que lleva nombres de deudores y cuotas y se comparte por
       WhatsApp, seguía firmado `_Control Finanzas_`. Lo cazó el bundle ya
       desplegado, no la prueba. Ahora barre el árbol entero. */
    const raiz = process.cwd()
    const sucios = []
    for (const f of ['app', 'components', 'lib'].flatMap((d) => fuentes(resolve(raiz, d)))) {
      if (/_Control Finanzas_/.test(sinNotas(readFileSync(f, 'utf8')))) {
        sucios.push(f.slice(raiz.length + 1).replace(/\\/g, '/'))
      }
    }
    expect(sucios, 'estos archivos firman con la marca del software').toEqual([])
  })

  it('el recibo en mano lleva primero al negocio, no a nosotros', () => {
    const recibo = leer('components/ui/BotonImprimirRecibo.jsx')
    expect(recibo).toMatch(/font-size:15px[^>]*>\$\{\(orgNombre \|\| ''\)\.toUpperCase\(\)/)
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
    expect(portal).toContain('no presta dinero, no cobra y no')
  })
})

describe('lo que el deudor firma dice qué firma', () => {
  it('⚠ la pantalla de firma nombra al acreedor y la autorización de datos', () => {
    /* Antes el cliente trazaba su firma viendo solo tres cifras y un recuadro
       en blanco. Las cláusulas están en un PDF que se genera después y que él
       no ve. */
    const pagare = leer('components/pantallas/Pagare.jsx')
    expect(pagare).toMatch(/autoriza a/)
    expect(pagare).toMatch(/datos personales/)
    expect(pagare).toContain('acreedor')

    const firma = leer('components/prestamos/FirmaDigital.jsx')
    expect(firma).toMatch(/acreedor=\{orgNombre\}/)
  })
})
