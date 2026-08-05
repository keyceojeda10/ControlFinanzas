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
    // ⚠ SEXTA VEZ que esta prueba se cae con el código CORRECTO delante, y
    // siempre por lo mismo: llevaba dentro la línea literal.
    //
    //   1ª versión: exigía `setAvanzado(Boolean(pago || preselected…))`
    //   2ª versión: exigía `setAvanzado(true)` dentro del efecto
    //
    // Las dos fijaban CÓMO reaccionaba la hoja, y las dos formas se retiraron a
    // propósito: primero el recibo dejó de ir al modal viejo, y después la
    // preselección también. Lo que hay que exigir es que REACCIONE —que exista
    // un efecto que dependa de `preselectedTemplateId`—, no qué hace dentro.
    const efectos = hoja.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g) ?? []
    const elQueReacciona = efectos.find((e) => /preselectedTemplateId/.test(e))
    expect(elQueReacciona, 'ningún efecto reacciona a la plantilla preseleccionada').toBeTruthy()
  })

  it('el efecto depende de esa entrada', () => {
    // Sin `preselectedTemplateId` en las dependencias no se dispararía al
    // cambiar, que es justo el caso reportado: la hoja se monta con la ficha y
    // la plantilla llega DESPUÉS.
    const efectos = hoja.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g) ?? []
    const elQueReacciona = efectos.find((e) => /preselectedTemplateId/.test(e))
    expect(elQueReacciona, 'no encuentro el efecto: revisa esta prueba').toBeTruthy()
    const deps = elQueReacciona.match(/\}, \[([^\]]*)\]\)$/)?.[1] ?? ''
    expect(deps, 'la plantilla no está en las dependencias').toContain('preselectedTemplateId')
  })

  it('y lo que hace es COLOCAR la hoja, no abrir el modal viejo', () => {
    // El destino sí importa, y es lo que el dueño reportó: «sigue saliendo el
    // modal viejo». Se posiciona en la familia de esa plantilla y la marca.
    expect(hoja, 'la preselección vuelve a abrir el modal viejo')
      .not.toMatch(/if \(preselectedTemplateId\) setAvanzado\(true\)/)
    expect(hoja).toContain('const f = familiaDe(preselectedTemplateId)')
    expect(hoja).toMatch(/setElegida\(preselectedTemplateId\)/)
  })

  it('el recibo de pago YA NO va al modal viejo', () => {
    // Se decidió que la hoja nueva lleve también el recibo: su familia «Pago»
    // trae `pago_confirmacion` con las mismas secciones y el mismo detalle.
    // Si alguien vuelve a meter `pago` en el gate, el recibo se va otra vez a
    // la pantalla que sobra.
    expect(hoja, '`pago` volvió a mandar al modal viejo')
      .not.toMatch(/setAvanzado\(Boolean\(pago/)
    expect(hoja, 'la hoja no abre en la familia del pago')
      .toMatch(/useState\(pago \? 'pago' : 'cobro'\)/)
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
