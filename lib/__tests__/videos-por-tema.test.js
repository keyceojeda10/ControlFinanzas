/**
 * Cada tutorial por su URL.
 *
 * Antes, a quien preguntaba «cómo creo una ruta» se le mandaba la lista de 17
 * vídeos y que buscara el suyo. Ahora se le manda el de rutas.
 *
 * ⚠ Las URL se verificaron una a una contra la playlist el 8 sep 2026. El
 * modelo nunca escribe una URL de vídeo: un enlace inventado mandado a un
 * cliente es peor que no mandar nada.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { VIDEOS, VIDEO_PAGO, elegirVideo, textoDeVideo, textoDeTodos, pideVer } from '@/lib/bot-v2/videos'
import { EMPRESA } from '@/lib/bot-v2/kb'

describe('el catálogo', () => {
  it('cada entrada tiene id, url, duración y claves', () => {
    for (const v of VIDEOS) {
      expect(v.id, v.titulo).toMatch(/^[\w-]{11}$/)
      expect(v.url).toBe(`https://youtu.be/${v.id}${v.desde ? `?t=${v.desde}` : ''}`)
      expect(v.dur, v.titulo).toMatch(/^\d+:\d{2}$/)
      expect(v.claves.split(',').length, v.titulo).toBeGreaterThan(3)
      expect(v.titulo).not.toMatch(/\bt[uú]\b|tienes|puedes/) // el bot habla de usted
    }
    expect(new Set(VIDEOS.map((v) => v.id)).size).toBe(20)
    expect(new Set(VIDEOS.map((v) => v.clave)).size).toBe(VIDEOS.length)
  })
  it('asignar una ruta a un cobrador tiene su propio vídeo', () => {
    // Estuvo apuntando al minuto 3:40 del 13 hasta que se grabó el suyo.
    expect(elegirVideo('como asigno un cobrador a la ruta')?.n).toBe(21)
    expect(elegirVideo('a esa ruta le puedo asignar un cobrador')?.n).toBe(21)
    // Y el de crear cobradores sigue siendo el 13.
    expect(elegirVideo('como creo un cobrador')?.n).toBe(13)
  })
  it('«¿por dónde entro?» NO es un vídeo: es el enlace', async () => {
    /* El dueño, viendo el tutorial: «eso se solucionaba fácilmente enviándole
       el link de acceso con el respectivo mensaje, es una pendejada». */
    const { leadPideLink } = await import('@/lib/bot-v2/validador')
    for (const t of ['como entro a la aplicacion', 'se me perdio la aplicacion',
      'como se llama la app', 'por donde entro', 'no encuentro la aplicacion']) {
      expect(leadPideLink(t), t).toBe(true)
    }
  })
  it('pero instalar el icono y recuperar la clave sí son vídeo', () => {
    expect(elegirVideo('como instalo la app en el celular')?.n).toBe(2)
    expect(elegirVideo('como pongo el icono en el celular')?.n).toBe(2)
    expect(elegirVideo('olvide mi contraseña')?.n).toBe(20)
    expect(elegirVideo('no me acuerdo de la clave')?.n).toBe(20)
  })
  it('están los 20 de la playlist, incluido el de pagar del 9 sep', () => {
    expect(new Set(VIDEOS.map((v) => v.id)).size).toBe(20)
    expect(VIDEOS.find((v) => v.n === 6)?.id).toBe('5AB_n3BU8OU')   // volvió tras la apelación
    expect(VIDEOS.find((v) => v.n === 20)?.id).toBe('yRFQesUKq08')
    expect(VIDEOS.find((v) => v.n === 21)?.id).toBe('feeT2GEhvdw')
    expect(VIDEOS.find((v) => v.n === 22)?.id).toBe('pufODWUplzo')
  })
})

describe('elegirVideo: la pregunta concreta lleva a su vídeo', () => {
  const casos = [
    ['tienen un video de como se crea una ruta', 12],
    ['como creo una ruta', 12],
    ['me manda el video de como hago un prestamo', 8],
    ['donde descargo la app', 2],
    ['como instalo la aplicacion en el celular', 2],
    ['como paso mis clientes del cuaderno', 5],
    ['como cuadro la caja del dia', 15],
    ['como creo un cobrador', 13],
    ['no entiendo como funciona el sistema', 3],
    ['como agrego un cliente', 6],
    ['puedo agregar capital', 17],
  ]
  for (const [texto, n] of casos) {
    it(`«${texto}» → vídeo ${n}`, () => expect(elegirVideo(texto)?.n).toBe(n))
  }
  it('lo que no es una pregunta de cómo no lleva a ninguno', () => {
    for (const t of ['hola buenas', 'cuanto vale', 'ok gracias', 'si', 'tienen videos?']) {
      expect(elegirVideo(t), t).toBe(null)
    }
  })
})

describe('los textos', () => {
  it('el de un vídeo lleva su URL, su duración y trata de usted', () => {
    const t = textoDeVideo(VIDEOS[0], { registrado: true })
    expect(t).toContain(VIDEOS[0].url)
    expect(t).toContain(VIDEOS[0].dur)
    expect(t).toContain(EMPRESA.telefonoSoporte)
    expect(t).not.toMatch(/\bt[uú]\b|tienes|puedes|tu negocio/)
  })
  it('al que no está registrado se le recuerda la prueba, no el soporte', () => {
    const t = textoDeVideo(VIDEOS[0], { registrado: false })
    expect(t).toContain(`${EMPRESA.diasPrueba} días gratis`)
  })
  it('sin tema claro, la lista entera', () => {
    expect(textoDeTodos({ registrado: false })).toContain(EMPRESA.linkTutoriales)
    expect(textoDeTodos({ registrado: true })).toContain(EMPRESA.telefonoSoporte)
  })
  it('pideVer distingue pedir de charlar', () => {
    expect(pideVer('tienen videos?')).toBe(true)
    expect(pideVer('como creo una ruta')).toBe(true)
    expect(pideVer('gracias, muy amable')).toBe(false)
  })
})

describe('el agente los usa en las tres vías', () => {
  const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
  it('quien pide tutoriales por regex recibe el suyo si se entiende cuál', () => {
    expect(src).toMatch(/const suyo = elegirVideo\(entrante\.texto, \{ registrado: yaRegistrado \}\)\n\s+if \(suyo\)/)
  })
  it('y por la vía semántica también', () => {
    expect(src).toMatch(/mensaje: suyo \? textoDeVideo\(suyo, \{ registrado: yaRegistrado \}\)/)
  })
  it('el cliente registrado que pregunta cómo se hace algo recibe el vídeo', () => {
    expect(src).toMatch(/const video = elegirVideo\(entrante\.texto, \{ registrado: true \}\)\n\s+if \(video\)/)
    expect(src).toMatch(/promptId: `video:\$\{video\.n\}`/)
  })
})

describe('el cliente que pregunta fuera del camino de soporte también recibe su vídeo', () => {
  it('«dónde descargo la app» se clasifica como venta y aun así llega al vídeo', async () => {
    const { clasificar } = await import('@/lib/bot-v2/clasificador')
    expect(clasificar('donde descargo la app', { yaRegistrado: true })?.tipo).toBe('ventas')
    expect(elegirVideo('donde descargo la app')?.n).toBe(2)
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/const video = elegirVideo\(entrante\.texto, \{ registrado: true \}\)\n\s+if \(video\) \{\n\s+return \{ mensaje: textoDeVideo\(video, \{ registrado: true \}\)/)
    // Las cuatro llamadas dicen SIEMPRE si el que pregunta ya tiene cuenta.
    expect((src.match(/elegirVideo\(entrante\.texto, \{ registrado: /g) || []).length).toBe(4)
    expect(src).not.toMatch(/elegirVideo\(entrante\.texto\)/)
  })
  it('si dos vídeos empatan no se manda ninguno: eso va a una persona', () => {
    expect(elegirVideo('como hago para editar las fecha inicial del prestamo')).toBe(null)
  })
})

describe('el enlace de acceso, que es camino fijo', () => {
  it('lleva la dirección de la app, no la de registro, y ofrece el vídeo de instalar', async () => {
    const { ACCESO } = await import('@/lib/bot-v2/respuestas-fijas')
    const { EMPRESA } = await import('@/lib/bot-v2/kb')
    const t = ACCESO
    expect(t).toContain(EMPRESA.linkApp)
    expect(t).not.toContain('/registro')
    expect(t).toContain('https://youtu.be/1LHUf6P5GgQ')   // el 02, instalar
    expect(t).not.toMatch(/\btú\b|tienes|puedes/)          // de usted
  })
  it('el agente lo devuelve antes del modelo, y solo a registrados', () => {
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/if \(yaRegistrado && leadPideLink\(entrante\.texto\)\) \{/)
    expect(src).toMatch(/mensaje: ACCESO,/)
    // Antes de construir el prompt: no hay nada que redactar.
    expect(src.indexOf('mensaje: ACCESO,')).toBeLessThan(src.indexOf('let prompt'))
  })
})

describe('el lead que YA tiene otro sistema', () => {
  it('se detecta cuando lo describe, no solo cuando dice «ya tengo»', async () => {
    /* Conversación real del 9 sep: un lead con 140 clientes fue diciendo que su
       app ya hacía todo, y el bot le siguió vendiendo lo mismo seis turnos. */
    const { objecionDe } = await import('@/lib/bot-v2/argumentos')
    for (const t of ['Si la app q manejo tiene esa función', 'la app que manejo ya hace eso',
      'mi sistema hace eso', 'el que uso me sirve', 'ya uso otra cosa']) {
      expect(objecionDe(t)?.id, t).toBe('ya_tengo')
    }
  })
  it('y la respuesta le pregunta qué le falta, en vez de venderle lo que ya tiene', async () => {
    const { objecionDe } = await import('@/lib/bot-v2/argumentos')
    expect(objecionDe('ya tengo una app').responder).toMatch(/qué es lo que hoy NO le resuelve/)
  })
})

describe('el de pagar el plan: solo para quien ya tiene cuenta', () => {
  /* El dueño lo pidió el 8 sep —«no tenemos un tutorial para los pagos y es
     importantísimo»— y lo subió a la playlist el 9. Es el 23 % de lo que
     pregunta la gente registrada: 34 de 204 preguntas, de 27 personas. */
  it('el cliente registrado que pregunta cómo paga recibe el vídeo', () => {
    for (const t of ['como pago el plan', 'donde pago la mensualidad',
      'como hago para pagar la suscripcion', 'quiero cambiar de plan',
      'se puede poner que se cobre solo', 'con que tarjeta se paga']) {
      expect(elegirVideo(t, { registrado: true })?.n, t).toBe(22)
    }
  })
  it('⚠ y el que NO se ha registrado no lo recibe: sería cobrar antes de la prueba', () => {
    for (const t of ['como pago el plan', 'donde pago la mensualidad', 'con que tarjeta se paga']) {
      expect(elegirVideo(t, { registrado: false }), t).toBe(null)
      expect(elegirVideo(t), t).toBe(null)          // sin decir nada, se asume que no
    }
  })
  it('los demás vídeos no cambian: se mandan registrado o no', () => {
    expect(elegirVideo('como creo una ruta', { registrado: false })?.n).toBe(12)
    expect(elegirVideo('como creo una ruta', { registrado: true })?.n).toBe(12)
  })
  it('la respuesta de «quiero pagar» lleva el sitio donde se paga Y el vídeo', async () => {
    const { ESCALAMIENTO } = await import('@/lib/bot-v2/respuestas-fijas')
    const { EMPRESA } = await import('@/lib/bot-v2/kb')
    const t = ESCALAMIENTO.intencion_pago_registrado
    expect(t).toContain(EMPRESA.linkPago)
    expect(t).toContain('https://youtu.be/pufODWUplzo')
    expect(t).toContain(VIDEO_PAGO.dur)
    expect(t).toContain(EMPRESA.telefonoSoporte)
    expect(t).not.toMatch(/\bt[uú]\b|tienes|puedes|tu plan/)
    /* Sin meter miedo: ni vencimiento, ni días restantes, ni perder el acceso.
       «Con todas las opciones necesarias y sin meter miedo al usuario». */
    expect(t).not.toMatch(/vence|venci|pierde|bloque|suspend|caduca/i)
  })
  it('el camino completo: «como pago el plan» de un cliente llega a la respuesta con vídeo', async () => {
    const { clasificar } = await import('@/lib/bot-v2/clasificador')
    for (const t of ['como pago el plan', 'quiero pagar el sistema', 'donde pago la mensualidad']) {
      expect(clasificar(t, { yaRegistrado: true })?.razon, t).toBe('intencion_pago')
    }
    // Y el agente cambia esa razón por la del cliente registrado, que lleva el vídeo.
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toContain("(razon === 'intencion_pago' && yaRegistrado) ? 'intencion_pago_registrado'")
  })
  it('la URL del vídeo vive SOLO en el catálogo, no escrita a mano en las respuestas', () => {
    const src = fs.readFileSync('lib/bot-v2/respuestas-fijas.js', 'utf8')
    expect(src).toContain('VIDEO_PAGO.url')
    expect(src).not.toContain('pufODWUplzo')
  })
})
