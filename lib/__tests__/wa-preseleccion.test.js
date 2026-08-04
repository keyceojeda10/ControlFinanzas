import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const hoja = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
const ficha = readFileSync(join(process.cwd(), 'app', '(dashboard)', 'prestamos', '[id]', 'page.jsx'), 'utf8')

/* Reportado por un cliente: «al crear un crédito nuevo al cliente le llega un
   mensaje recordándole el pago siguiente. Y no debería ser así. Cómo hago para
   que llegue el que salía antes, que era crédito aprobado y le daba la
   descripción del crédito y a cuántas cuotas quedaba».

   La causa: `useState` SOLO LEE SU VALOR INICIAL UNA VEZ. La hoja se monta
   siempre con la ficha —`open` decide si se VE, no si existe—, así que
   `avanzado` se calculaba con `preselectedTemplateId = null`. Al crear un
   préstamo la ficha lo pone en 'credito_aprobado' DESPUÉS, y la hoja ya no
   volvía a mirarlo: se abría la normal, con «recordatorio de pago». */

describe('al crear un préstamo se abre CRÉDITO APROBADO', () => {
  it('la hoja reacciona a la plantilla que le llega, no solo al montarse', () => {
    expect(hoja).toMatch(/useEffect\(\(\) => \{\s*if \(pago \|\| preselectedTemplateId\) setAvanzado\(true\)/)
  })

  it('el efecto depende de las DOS entradas', () => {
    // Sin `preselectedTemplateId` en las dependencias no se dispararía al
    // cambiar, que es justo el caso reportado.
    const ef = hoja.match(/if \(pago \|\| preselectedTemplateId\) setAvanzado\(true\)[\s\S]{0,80}/)[0]
    expect(ef).toMatch(/\}, \[pago, preselectedTemplateId\]\)/)
  })

  it('la ficha pide la plantilla de crédito aprobado al crear', () => {
    expect(ficha).toContain("setWaSugerida('credito_aprobado')")
    expect(ficha).toMatch(/preselectedTemplateId=\{waSugerida\}/)
  })

  it('la plantilla existe en el motor y trae el detalle del crédito', () => {
    const motor = readFileSync(join(process.cwd(), 'lib', 'whatsapp-plantillas.js'), 'utf8')
    expect(motor).toContain("id: 'credito_aprobado'")
    // Lo que el cliente echaba de menos: monto, total, cuota y plazo.
    const i = motor.indexOf('Tu crédito ha sido aprobado')
    expect(i).toBeGreaterThan(-1)
    const bloque = motor.slice(i, i + 700)
    expect(bloque).toContain('Monto prestado')
    expect(bloque).toContain('Total a pagar')
    expect(bloque).toContain('Plazo')
  })
})
