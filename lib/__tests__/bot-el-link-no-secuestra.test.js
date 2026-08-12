// lib/__tests__/bot-el-link-no-secuestra.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, con tres capturas de un chat real: «siento que le falta viveza,
// mucha inteligencia».
//
// No era el modelo redactando mal. Era `detectarStage` mandándolo a la etapa
// equivocada. La línea era:
//
//     if (linkEnviado) return 'POST_LINK'
//
// ANTES de mirar lo que el lead acababa de escribir. Mandado el link una vez,
// TODO caía en POST_LINK — cuyo prompt dice «si no ha hecho nada, pregunta si
// se pudo registrar».
//
// El chat de Luis, después del link (08:52), es la prueba entera:
//
//   «Mas información»              → el mismo pitch y el link otra vez
//   «Cómo funciona»                → «¿ya se registró o tiene dudas?»
//   «No me has dicho nada»         → el mismo pitch y el link otra vez
//   «Yo no estoy pidiendo registro»
//   «Todas [las dudas]»            → «cualquier cosa me avisa» (se despidió)
//
// Cuatro links en diez minutos, y el lead diciéndoselo en la cara. Tuvo que
// entrar un humano a mano.
//
// MEDIDO sobre 510 conversaciones reales de 45 días, antes de tocar nada:
//   · 65 (12,7%) con al menos una pregunta tragada por el link — 113 en total
//   · 110 (21,6%) con un mensaje largo repetido casi textual
//   · 7 en las que el bot se despide con el lead diciendo que tiene dudas

import { describe, it, expect } from 'vitest'
import { detectarStage } from '../bot-v2/stages.js'
import { esCalcoLargo, tieneDudasAbiertas, esDespedida } from '../bot-v2/anti-repeticion.js'

const LINK = 'Puede probarlo gratis 14 dias. https://app.control-finanzas.com/registro?r=2'
/* El historial de Luis en el momento en que el link ya salió. */
const trasElLink = [
  { rol: 'bot', texto: 'Hola Luis, le escribimos de Control Finanzas. ¿Usted sabe exactamente cuanto le deben sus clientes hoy?' },
  { rol: 'lead', texto: 'Si sé' },
  { rol: 'bot', texto: 'Ahh listo. Y esos cobradores que tiene, ¿usted ve al segundo lo que cada uno cobró?' },
  { rol: 'lead', texto: 'Que me ofrece control finanzas?' },
  { rol: 'bot', texto: LINK },
]
const leadFB = { metodoActual: 'cuaderno_papel', cantClientes: '20_50' }

describe('⚠ una pregunta gana al link ya enviado', () => {
  it.each([
    ['Mas información'],
    ['Por favor'],          // el «más información» partido en dos mensajes
    ['Cómo funciona'],
    ['?'],
    ['No me has dicho nada'],
    ['No entiendo'],
    ['Todas solo se que puedo ver cobros en segundos'],
  ])('«%s» NO cae en POST_LINK', (texto) => {
    expect(detectarStage(trasElLink, texto, false, leadFB)).not.toBe('POST_LINK')
  })

  it('lo que NO es pregunta sí sigue yendo a POST_LINK', () => {
    /* Para eso se escribió esa etapa: los «ok», los «gracias» y el silencio de
       alguien a quien ya se le mandó el link. Si esto se rompe, el bot vuelve a
       vender a quien ya está en el formulario. */
    for (const t of ['ok', 'gracias', 'listo pues', 'bueno']) {
      expect(detectarStage(trasElLink, t, false, leadFB)).toBe('POST_LINK')
    }
  })

  it('el registrado sigue yendo a POST_LINK pase lo que pase', () => {
    expect(detectarStage(trasElLink, 'Cómo funciona', true, leadFB)).toBe('POST_LINK')
  })

  it('precios y objeciones siguen mandando sobre todo lo demás', () => {
    expect(detectarStage(trasElLink, '¿cuánto cuesta?', false, leadFB)).toBe('PRECIOS')
    expect(detectarStage(trasElLink, 'está muy caro', false, leadFB)).toBe('OBJECION')
  })
})

describe('«Claro» con pregunta detrás no es un sí', () => {
  it('«Claro» a secas sigue siendo confirmación', () => {
    const sinLink = trasElLink.slice(0, 3)
    expect(detectarStage(sinLink, 'Claro', false, leadFB)).toBe('CIERRE')
  })

  it('⚠ pero «Claro, y cómo funciona?» manda la PREGUNTA', () => {
    /* Luis escribió «Claro» queriendo decir «claro que no me has dicho nada».
       Con la confirmación por delante se leía como un sí a comprar. */
    const sinLink = trasElLink.slice(0, 3)
    expect(detectarStage(sinLink, '¿Claro, y cómo funciona?', false, leadFB)).toBe('VALOR')
  })
})

describe('el calco largo, que es el que dolía', () => {
  const pitch = 'Control Finanzas le deja ver al segundo cuanto cobro cada cobrador en la calle, con GPS en tiempo real. Acepta pagos parciales, calcula cuotas automaticas y genera recibos para enviar por WhatsApp. Puede probarlo gratis 14 dias sin tarjeta.'
  const hist = [{ rol: 'bot', texto: pitch }]

  it('lo caza aunque tenga 40 palabras', () => {
    /* `esRepetido` solo miraba mensajes de ≤12 palabras a propósito. El que le
       mandaron a Luis tres veces tiene cincuenta. */
    expect(esCalcoLargo(pitch, hist)).toBe(true)
  })

  it('caza el casi-igual, no solo el idéntico', () => {
    const casi = 'Control Finanzas le deja ver en tiempo real cuanto cobro cada cobrador en la calle, sin esperar a que llegue. Calcula cuotas automaticas, acepta pagos parciales y genera recibos por WhatsApp. Puede probarlo gratis 14 dias.'
    expect(esCalcoLargo(casi, hist)).toBe(true)
  })

  it('NO castiga una respuesta larga y distinta', () => {
    const otra = 'El cobrador marca el pago desde su celular y a usted le entra al instante. Si el cliente abona menos de la cuota, queda registrado el abono parcial y el saldo se recalcula solo.'
    expect(esCalcoLargo(otra, hist)).toBe(false)
  })

  it('ni un cierre corto: de esos se encarga `variarSiRepetido`', () => {
    expect(esCalcoLargo('Listo, quedo atento.', [{ rol: 'bot', texto: 'Listo, quedo atento.' }])).toBe(false)
  })
})

describe('no despedirse con dudas abiertas', () => {
  it.each([
    ['Si Ok si tengo unas dudas pero me parece muy interesante'],
    ['Ok No entiendo'],
    ['Y como funciona No nada'],
    ['Todas solo se que puedo ver cobros en segundos'],
    ['No me has dicho nada'],
  ])('«%s» son dudas abiertas', (t) => {
    expect(tieneDudasAbiertas(t)).toBe(true)
  })

  it('un «ok» pelado no lo es', () => {
    expect(tieneDudasAbiertas('ok')).toBe(false)
    expect(tieneDudasAbiertas('listo gracias')).toBe(false)
  })

  it('reconoce las despedidas que salieron en los chats reales', () => {
    expect(esDespedida('Listo Luis, cualquier cosa me avisa. Quedo atento para ayudarte.')).toBe(true)
    expect(esDespedida('Perfecto Alex, cuando tenga las dudas me escribe o llama al 3011993001')).toBe(true)
    expect(esDespedida('El cobrador marca el pago desde su celular.')).toBe(false)
  })
})
