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
    /* El botón ya no se dibuja aquí: el comprobante se unificó y ahora los tres
       caminos montan `components/pantallas/Recibo`, que trae el suyo. Lo que
       esta prueba defiende NO cambia —que abrir la hoja no dispare el mensaje—,
       solo cambia dónde se comprueba: en el `onWhatsApp` que se le pasa.

       ⚠ Antes el bloque iba del `<button` ANTERIOR al rótulo y no de una
       ventana de N caracteres, porque el SVG de WhatsApp mide él solo más de
       1.200 y se comía la ventana entera. */
    const i = src.indexOf('onWhatsApp=')
    expect(i, 'el recibo ya no recibe el envío por WhatsApp').toBeGreaterThan(-1)
    expect(src.slice(i, i + 120), 'el botón no abre la hoja')
      .toContain('onWhatsApp={() => setModalWA(true)}')
  })

  it('y el comprobante es el del rediseño, no uno dibujado aquí', () => {
    /* El dueño: «el modal de pago registrado es diferente en varios lugares…
       necesito consistencia y no tener dos modales de pago registrado». */
    /* ⚠ Se admite que traiga MÁS cosas del mismo módulo: al unificar la capa
       del comprobante pasó a importarse también `CAPA_RECIBO`, y estas tres
       pruebas se pusieron rojas por exigir la forma exacta del import. Lo que
       cuidan —que los tres caminos monten el MISMO `Recibo`— no cambió. */
    expect(src).toMatch(/import \{[^}]*\bRecibo\b[^}]*\} from '@\/components\/pantallas\/Recibo'/)
    expect(src, 'volvió el comprobante escrito a mano')
      .not.toMatch(/title=\{\s*tipo === 'recargo' \? 'Recargo aplicado'/)
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
