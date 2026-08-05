import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El botón verde que sale justo después de cobrar es el más pulsado de toda la
// aplicación, y disparaba el recibo sin que nadie lo leyera: el cobrador veía
// el mensaje ya dentro del chat del cliente, con las cifras puestas.
// «Personalizar» estaba escondido en un engranaje de 40px al lado.
const src = readFileSync(resolve(process.cwd(), 'components/prestamos/RegistrarPago.jsx'), 'utf8')

describe('el recibo tras cobrar', () => {
  it('el botón verde abre la hoja, no manda', () => {
    // ⚠ El bloque va del `<button` ANTERIOR al rótulo, no de una ventana de N
    // caracteres: el SVG del icono de WhatsApp mide él solo más de 1.200 y se
    // comía la ventana entera, así que la prueba fallaba con el código
    // correcto delante. Anclar a la etiqueta no depende de cuánto ocupe el
    // dibujo.
    const i = src.indexOf('Enviar por WhatsApp')
    expect(i, 'ya no existe el botón: revisa esta prueba').toBeGreaterThan(-1)
    const abre = src.lastIndexOf('<button', i)
    expect(abre, 'el rótulo no está dentro de un botón').toBeGreaterThan(-1)
    const bloque = src.slice(abre, i)
    expect(bloque, 'el botón volvió a disparar el mensaje')
      .not.toMatch(/abrirWhatsApp\(`https:\/\/wa\.me/)
    expect(bloque, 'el botón no abre la hoja').toContain('onClick={() => setModalWA(true)}')
  })

  it('la hoja no preselecciona plantilla: eso abre el modal viejo', () => {
    // `preselectedTemplateId` es el interruptor del modo avanzado. Con el pago
    // basta — la hoja abre sola en la familia «Pago».
    expect(src, 'vuelve a forzar el modal viejo').not.toContain('preselectedTemplateId="pago_confirmacion"')
    expect(src, 'la hoja no recibe el pago').toMatch(/pago=\{pagoGuardado\}/)
  })

  it('el envío automático del interruptor SIGUE en pie', () => {
    // ⚠ Este NO se toca. Es «Enviar recibo al confirmar», que el cobrador
    // enciende a propósito para que el recibo salga solo al terminar. Ahí el
    // automatismo es lo que pidió, no un descuido. Si alguien lo quita
    // pensando que es otro envío a ciegas, rompe una función pedida.
    expect(src, 'se perdió el envío automático del interruptor').toContain('if (!enviarRecibo) return')
    const i = src.indexOf('if (!enviarRecibo) return')
    const bloque = src.slice(i, i + 900)
    expect(bloque, 'el envío automático ya no arma el texto').toContain('generarTextoPlantilla')
    expect(bloque, 'y ya no abre WhatsApp').toContain('abrirWhatsApp')
    // Con sus guardias: sin teléfono no va, y de un recargo tampoco.
    expect(src).toContain("if (['recargo', 'descuento'].includes(pagoGuardado.tipo)) return")
  })
})
