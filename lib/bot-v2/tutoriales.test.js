// lib/bot-v2/tutoriales.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Los enlaces de vídeo estuvieron PROHIBIDOS en el bot, y con razón: los
// tutoriales eran de marzo y enseñaban la interfaz anterior al rediseño. Al
// quitarlos quedó escrito el aviso que ahora vale al revés:
//
//   «La constante y su import seguían puestos: dejar la munición cargada es
//    como vuelve a dispararse.»
//
// Ahora los diecisiete están rehechos y publicados, así que se abre — y abrirlo
// toca CUATRO piezas. Esta prueba cuida que las cuatro sigan de acuerdo, porque
// basta con que una discrepe para que el enlace no llegue:
//
//   1. la constante              `producto.js`
//   2. quién lo pide             `clasificador.js`
//   3. qué se le contesta        `respuestas-fijas.js`
//   4. que no lo borren después  `prompts.js` y `sanitizador.js`

import { describe, it, expect } from 'vitest'
import { clasificar } from '@/lib/bot-v2/clasificador'
import { TUTORIALES } from '@/lib/bot-v2/respuestas-fijas'
import { EMPRESA } from '@/lib/bot-v2/producto'
import { sanitizar } from '@/lib/bot-v2/sanitizador'

describe('quien pide vídeos recibe la lista', () => {
  const pide = [
    'tienen videos?',
    'hay algun tutorial',
    'me manda el manual',
    'tienen un curso de la app',
    'hay videos de como se usa',
    'necesito capacitacion para mis cobradores',
  ]
  it.each(pide)('«%s» se reconoce', (t) => {
    expect(clasificar(t).tipo).toBe('tutoriales')
  })

  it('al lead se le manda la lista Y la prueba', () => {
    /* Solo la lista sería regalarle la respuesta y perder la venta; solo la
       prueba es no contestar lo que preguntó. */
    expect(TUTORIALES.lead).toContain(EMPRESA.linkTutoriales)
    expect(TUTORIALES.lead).toContain(String(EMPRESA.diasPrueba))
  })

  it('al registrado, la lista y el teléfono de soporte', () => {
    expect(TUTORIALES.registrado).toContain(EMPRESA.linkTutoriales)
    expect(TUTORIALES.registrado).toContain(EMPRESA.telefonoSoporte)
  })

  it('el enlace es una lista de reproducción de YouTube, no un vídeo suelto', () => {
    // Un `watch?v=` se queda en el primero y el resto del curso no se ve.
    expect(EMPRESA.linkTutoriales).toMatch(/youtube\.com\/playlist\?list=/)
  })
})

describe('⚠ y NO se lo lleva por delante quien pregunta otra cosa', () => {
  it('«cómo funciona» sigue siendo una pregunta de venta', () => {
    /* Es LA pregunta de venta: contestarla con un enlace es regalar la
       respuesta y perder la conversación. La tentación de atraparla aquí era
       fuerte y sería un error caro. */
    expect(clasificar('como funciona el sistema?').tipo).toBe('ventas')
    expect(clasificar('y eso como funciona').tipo).toBe('ventas')
  })

  it('pedir precio sigue yendo a ventas', () => {
    expect(clasificar('cuanto vale').tipo).toBe('ventas')
  })

  it('un problema de verdad sigue escalando a soporte', () => {
    expect(clasificar('no me deja entrar, me dice error', { yaRegistrado: true }).tipo).toBe('escalar')
  })
})

describe('⚠ el sanitizador ya no borra la frase que lleva el enlace', () => {
  /* Este `replace` se come la frase ENTERA —«le comparto el video: …»— y con
     ella el enlace. Con los vídeos prohibidos daba igual; desde que se pueden
     mandar, borraba lo único que había que mandar. */
  it('deja pasar la frase con la lista de reproducción', () => {
    const m = `Claro, le comparto el video con los tutoriales: ${EMPRESA.linkTutoriales}`
    expect(sanitizar(m)).toContain(EMPRESA.linkTutoriales)
  })

  it('pero sigue borrando la promesa de adjuntar algo que no existe', () => {
    const m = 'Ya le mando la captura de la pantalla. Puede probarlo gratis.'
    expect(sanitizar(m)).not.toMatch(/mando la captura/i)
  })
})
