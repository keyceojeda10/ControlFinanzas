// lib/__tests__/bot-flujo-anuncio.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El bot que atiende a quien llega desde un anuncio de WhatsApp. Lo que se
// comprueba aquí no es que conteste: es que **no prometa un precio que no
// existe, no mande a nadie a un teléfono donde nadie contesta, y no deje sin
// aviso a quien dice que se atascó**.
//
// El orden de los botones sale de cruzar cada tema con quién terminó pagando,
// no de lo que más se pregunta (línea base: 13,3 % de 1.656 leads se registra):
//
//   ¿es seguro? / ¿cuánto llevan? ..  14 personas · 21 % PAGA  ← el más alto
//   quiero pagar / activar .........  54 personas · 22 % PAGA
//   precio / cuánto vale ........... 127 personas ·  5 % paga  ← el más pedido
//   cómo funciona ..................  50 personas ·  2 % paga

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  esDeAnuncio, esBotonDelFlujo, respuestaDeBoton, saludoDeAnuncio,
  BOTONES_ENTRADA, BOTONES_ATASCO, pareceAtascado, respuestaAtasco, intencionDeTexto,
  tablaDePrecios, textoConfianza,
} from '@/lib/bot/flujo-anuncio'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'
import { payloadDeBotones } from '@/lib/bot/whatsapp-cloud'

const raiz = resolve(__dirname, '../..')
const sinComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const webhook = sinComentarios(readFileSync(resolve(raiz, 'app/api/webhook/whatsapp-cloud/route.js'), 'utf8'))
const flujo   = sinComentarios(readFileSync(resolve(raiz, 'lib/bot/flujo-anuncio.js'), 'utf8'))
const simulador = sinComentarios(readFileSync(resolve(raiz, 'app/api/admin/whatsapp-bot/simulador/route.js'), 'utf8'))

const TODOS = [...BOTONES_ENTRADA, ...BOTONES_ATASCO,
  { id: 'cf_confiable' }, { id: 'cf_humano' }]

describe('⚠ el tráfico se separa, el bot de siempre no se toca', () => {
  it('⚠ NO se mira `anuncioId`, que lo escriben tres sitios distintos', () => {
    /* Contado en producción: 1.587 leads tenían `anuncioId` y 1.501 de ellos
       venían del FORMULARIO —se lo pone el webhook de Facebook Leads—. Usarlo
       como discriminador metía a todo ese tráfico en el bot nuevo, que es
       exactamente lo contrario de lo acordado. */
    expect(esDeAnuncio({ anuncioId: '120244629437740778', cfLeadId: 'x' })).toBe(false)
    expect(esDeAnuncio({ anuncioId: 'fb_sync' })).toBe(false)
    expect(flujo).not.toMatch(/lead\?\.anuncioId/)
  })

  it('solo atiende a quien escribió desde un anuncio de WhatsApp', () => {
    expect(esDeAnuncio({ desdeAnuncioWa: true })).toBe(true)
    expect(esDeAnuncio({ desdeAnuncioWa: false })).toBe(false)
    expect(esDeAnuncio({})).toBe(false)
    expect(esDeAnuncio(null)).toBe(false)
  })

  it('y lo marca solo el webhook de WhatsApp, cuando llega `referral`', () => {
    expect(webhook).toMatch(/desdeAnuncioWa: desdeAnuncio/)
    expect(webhook).toMatch(/if \(ref && !existente\.desdeAnuncioWa\)/)
  })

  it('un lead que ya existía y ahora llega por un anuncio se marca', () => {
    /* Sin esto, quien ya estaba en la base seguiría cayendo en el flujo viejo
       aunque hubiera llegado por la campaña nueva, y la comparación entre los
       dos bots saldría torcida. */
    expect(webhook).toMatch(/if \(ref && !existente\.desdeAnuncioWa\)/)
  })

  it('el flujo se consulta ANTES del modelo', () => {
    const flujoEn = webhook.indexOf('atenderDesdeAnuncio(lead')
    const modelo  = webhook.indexOf('await responder(lead')
    expect(flujoEn).toBeGreaterThan(-1)
    expect(flujoEn).toBeLessThan(modelo)
  })

  it('⚠ el saludo espera al debounce; el botón no', () => {
    /* Un botón no llega en ráfaga, pero el texto sí: quien escribe «hola» y
       «buenas» seguidos recibiría DOS saludos con botones si el saludo se
       resolviera antes del agrupado de cinco segundos. */
    const conBoton = webhook.indexOf('esDeAnuncio(lead) && botonId')
    const debounce = webhook.indexOf('DEBOUNCE_MS = 5000')
    const sinBoton = webhook.indexOf('atenderDesdeAnuncio(lead, { botonId: null')
    expect(conBoton).toBeGreaterThan(-1)
    expect(conBoton).toBeLessThan(debounce)
    expect(sinBoton).toBeGreaterThan(debounce)
  })
})

describe('⚠ los precios no se escriben, se derivan', () => {
  it('los tramos son los de lib/planes, con sus topes de verdad', () => {
    /* Ya pasó tres veces con la pantalla de planes: el tope bajó a 100 en la
       configuración y la pantalla siguió prometiendo 150 a quien iba a pagar.
       Un bot que promete un tope que no existe es lo mismo, pero antes. */
    const t = tablaDePrecios('co')
    expect(t).toHaveLength(3)
    for (const fila of t) {
      expect(fila.tope).toBe(PLANES_CONFIG[fila.key].maxClientes)
      expect(fila.precio).toBe(getPrecioPlan(fila.key, 'co'))
    }
  })

  it('y el mensaje del precio dice esos mismos números', () => {
    const texto = respuestaDeBoton('cf_precio').texto
    for (const fila of tablaDePrecios('co')) {
      expect(texto, `falta el tope ${fila.tope}`).toContain(fila.tope.toLocaleString('es-CO'))
      expect(texto, `falta el precio ${fila.precio}`).toContain(fila.precio.toLocaleString('es-CO'))
    }
  })

  it('no hay ningún precio escrito a mano en el fichero', () => {
    /* Cualquier cifra con pinta de peso colombiano suelta en el código es un
       precio que dejará de ser verdad el día que se cambie en `lib/planes`. */
    expect(flujo).not.toMatch(/\$\s?\d{2,3}\.\d{3}/)
  })
})

describe('⚠ lo que más paga tiene respuesta, y lo que menos no se lleva la conversación', () => {
  it('«¿Es confiable?» se ofrece justo después del precio', () => {
    /* Convierte al 21 % a pago, el más alto de todos, y hasta hoy el bot no
       tenía nada preparado para esa pregunta. */
    const tras = respuestaDeBoton('cf_precio').botones.map(b => b.id)
    expect(tras).toContain('cf_confiable')
    expect(tras).toContain('cf_probar')
  })

  it('«Cómo funciona» contesta corto y devuelve el control', () => {
    /* Es la que peor convierte: 2 % paga. Se responde y se sigue. */
    const r = respuestaDeBoton('cf_como')
    expect(r.texto.length).toBeLessThan(400)
    expect(r.botones.map(b => b.id)).toContain('cf_probar')
  })

  it('«Quiero probarlo» manda el link y NO pregunta nada más', () => {
    const r = respuestaDeBoton('cf_probar')
    expect(r.texto).toContain('app.control-finanzas.com/registro')
    expect(r.botones).toHaveLength(0)
  })

  it('la respuesta de confianza no inventa cifras que no tiene', () => {
    /* Se lo estamos diciendo a alguien que decide si nos entrega los números de
       su negocio. Sin datos, se dice lo que sí sabemos y ya. */
    const conDatos = textoConfianza({ meses: 6, negocios: 353, prestamos: 6229 })
    expect(conDatos).toContain('6 meses')
    expect(conDatos).toContain('353')
    expect(conDatos).toContain('6.229')

    const sinDatos = textoConfianza({})
    expect(sinDatos).not.toMatch(/\bNaN\b|undefined|\bnull\b/)
    expect(sinDatos).not.toMatch(/\d+\s+meses/)
    /* Aun sin cifras tiene que quedar lo que de verdad calma a quien duda: que
       sus datos son suyos y que no arriesga nada por comprobarlo. */
    expect(sinDatos).toMatch(/su[ys]a/i)
    expect(sinDatos).toMatch(/no pedimos tarjeta/i)
  })

  it('y un solo negocio no se anuncia como si fueran muchos', () => {
    expect(textoConfianza({ meses: 6, negocios: 3, prestamos: 4 })).not.toContain('3 negocios')
  })
})

describe('⚠ el atasco no se deriva, se atiende', () => {
  it('reconoce lo que la gente escribe de verdad', () => {
    for (const frase of [
      'no pude', 'No pude registrarme', 'no entiendo nada',
      'no sé cómo usarlo', 'no me abre el link', 'no me deja entrar',
      'me sale error',
    ]) {
      expect(pareceAtascado(frase), `no reconoció «${frase}»`).toBe(true)
    }
  })

  it('y no confunde una frase normal con un atasco', () => {
    for (const frase of ['cuánto cuesta', 'quiero probarlo', 'ya lo pude hacer, gracias', '']) {
      expect(pareceAtascado(frase), `se confundió con «${frase}»`).toBe(false)
    }
  })

  it('avisa a un humano en cuanto lo dice, sin esperar al botón', () => {
    /* Si se va sin contestar el botón, es justo el que había que atender. */
    expect(respuestaAtasco().avisar).toBeTruthy()
  })

  it('⚠ el número de soporte va DESPUÉS de atender, nunca en lugar de atender', () => {
    /* Lo pidió el dueño. El dato que lo había quitado —274 derivaciones y 4
       tickets— no dice «no des el número»: dice que el bot lo daba EN LUGAR de
       atender («escríbales al 301» y fin de la conversación). Así que el
       mensaje tiene que seguir preguntando y avisando; el teléfono es una
       salida más. */
    const primero = respuestaAtasco()
    expect(primero.texto).toMatch(/¿En qué parte se quedó\?/)
    expect(primero.texto).toContain('301 199 3001')
    /* La pregunta va ANTES del teléfono, no al revés. */
    expect(primero.texto.indexOf('301 199 3001')).toBeGreaterThan(primero.texto.indexOf('se quedó'))
    expect(primero.avisar).toBeTruthy()

    for (const b of BOTONES_ATASCO) {
      const r = respuestaDeBoton(b.id)
      expect(r.avisar, `${b.id} debe avisar a un humano`).toBeTruthy()
      /* Y ninguna rama puede ser SOLO el teléfono. */
      const sinTelefono = r.texto.replace(/Si prefiere,[^]*$/m, '').trim()
      expect(sinTelefono.length, `${b.id} no atiende, solo deriva`).toBeGreaterThan(30)
    }
  })
})

describe('⚠ lo que el bot promete tiene que existir en la app', () => {
  /* La primera versión mandaba a «Clientes → botón de la cámara» y prometía
     «hasta 30 por foto». Las dos cosas eran falsas: la carga del cuaderno vive
     en «Pasar mi cuaderno» y son 30 FOTOS de una vez. Mandar a alguien a una
     pantalla que no es lo deja justo donde no queríamos. */
  const menu = readFileSync(resolve(raiz, 'components/armazon/BarraLateral.jsx'), 'utf8')
  const lote = readFileSync(resolve(raiz, 'components/migrador/LoteFotos.jsx'), 'utf8')

  it('«Pasar mi cuaderno» es como se llama de verdad en el menú', () => {
    expect(menu).toContain("nombre: 'Pasar mi cuaderno'")
    expect(menu).toContain("href: '/migrador'")
  })

  it('y los mensajes mandan ahí, no a Clientes', () => {
    for (const [nombre, texto] of [
      ['cómo funciona', respuestaDeBoton('cf_como').texto],
      ['atasco cargando', respuestaDeBoton('cf_at_clientes').texto],
    ]) {
      expect(texto, `${nombre} manda al sitio equivocado`).not.toMatch(/bot[oó]n de la c[aá]mara/i)
    }
    expect(respuestaDeBoton('cf_at_clientes').texto).toContain('Pasar mi cuaderno')
  })

  it('son 30 FOTOS de una vez, no 30 clientes por foto', () => {
    expect(lote).toContain('Hasta 30 fotos de una vez')
    for (const texto of [respuestaDeBoton('cf_como').texto, respuestaDeBoton('cf_at_clientes').texto]) {
      expect(texto).not.toMatch(/30\s+por\s+foto/i)
    }
  })
})

describe('⚠ los límites de WhatsApp no son sugerencias', () => {
  it('ningún mensaje pasa de tres botones ni de 20 caracteres por título', () => {
    /* Un título largo o dos ids repetidos hacen que Meta rechace el mensaje
       ENTERO con un 400: no manda una versión recortada, no manda nada. */
    const grupos = [saludoDeAnuncio(), respuestaAtasco(),
      ...TODOS.map(b => respuestaDeBoton(b.id)).filter(Boolean)]
    for (const g of grupos) {
      const bs = g.botones ?? []
      expect(bs.length, 'más de tres botones').toBeLessThanOrEqual(3)
      const ids = new Set()
      for (const b of bs) {
        expect(b.titulo.length, `«${b.titulo}» pasa de 20`).toBeLessThanOrEqual(20)
        expect(ids.has(b.id), `id repetido: ${b.id}`).toBe(false)
        ids.add(b.id)
      }
      expect(String(g.texto ?? '').length, 'cuerpo de más de 1024').toBeLessThanOrEqual(1024)
    }
  })

  it('todo botón que se ofrece tiene a dónde ir', () => {
    /* Un botón sin respuesta preparada cae al modelo con el título por texto:
       funciona de milagro, no por diseño. */
    const ofrecidos = new Set()
    for (const g of [saludoDeAnuncio(), respuestaAtasco(),
                     ...TODOS.map(b => respuestaDeBoton(b.id)).filter(Boolean)]) {
      for (const b of g.botones ?? []) ofrecidos.add(b.id)
    }
    for (const id of ofrecidos) {
      expect(esBotonDelFlujo(id), `${id} se ofrece y no tiene respuesta`).toBe(true)
      expect(respuestaDeBoton(id)?.texto, `${id} contesta vacío`).toBeTruthy()
    }
  })

  it('⚠ el cuerpo que se le manda a Meta tiene la forma exacta', () => {
    /* Si el payload va mal, Meta responde 400 y NO MANDA NADA: ni una versión
       recortada. El fallo se descubriría con un cliente delante. */
    const p = payloadDeBotones('573001234567', saludoDeAnuncio().texto, BOTONES_ENTRADA)
    expect(p.type).toBe('interactive')
    expect(p.interactive.type).toBe('button')
    expect(typeof p.interactive.body.text).toBe('string')
    expect(p.interactive.action.buttons).toHaveLength(3)
    for (const b of p.interactive.action.buttons) {
      expect(b.type).toBe('reply')
      expect(Object.keys(b.reply).sort()).toEqual(['id', 'title'])
      expect(b.reply.title.length).toBeLessThanOrEqual(20)
    }
  })

  it('y se recorta o se degrada en vez de mandar algo que Meta rechace', () => {
    /* Cuatro botones, un título largo y un id repetido: nada de eso puede salir
       como está. Sin botones válidos, `null` — el emisor lo manda como texto. */
    const p = payloadDeBotones('573001234567', 'hola', [
      { id: 'a', titulo: 'Un título larguísimo que no cabe de ninguna manera' },
      { id: 'a', titulo: 'repetido' },
      { id: 'b', titulo: 'dos' },
      { id: 'c', titulo: 'tres' },
      { id: 'd', titulo: 'cuatro' },
    ])
    expect(p.interactive.action.buttons.length).toBeLessThanOrEqual(3)
    for (const b of p.interactive.action.buttons) expect(b.reply.title.length).toBeLessThanOrEqual(20)
    expect(payloadDeBotones('573001234567', 'hola', [])).toBeNull()
    expect(payloadDeBotones('573001234567', 'hola', [{ id: '', titulo: '' }])).toBeNull()
  })

  it('un id que no es de este flujo no se lo apropia', () => {
    /* Los del momento post-registro (`cartera_*`) los atiende otro sitio. */
    expect(esBotonDelFlujo('cartera_foto')).toBe(false)
    expect(respuestaDeBoton('cualquier_cosa')).toBeNull()
  })
})

describe('⚠ el simulador', () => {
  it('NO puede mandar un mensaje ni por accidente', () => {
    /* No se importa el emisor: no hay forma de que salga algo a un teléfono
       real desde el panel. */
    expect(simulador).not.toMatch(/whatsapp-cloud/)
    expect(simulador).not.toMatch(/sendText|sendButtons|sendTemplate|sendMedia/)
  })

  it('no toca ningún lead de verdad', () => {
    /* El lead es un objeto en memoria con un id que no existe. */
    expect(simulador).toMatch(/id: 'simulador-no-existe'/)
    expect(simulador).not.toMatch(/prisma\.botLead\.(create|update|delete)/)
  })

  it('⚠ y NO tiene su propia copia del guion', () => {
    /* Es lo único que lo hace útil: si tuviera su propia versión, se ajustaría
       contra ella y en WhatsApp saldría otra cosa. Llama a las mismas dos
       funciones que el webhook. */
    expect(simulador).toMatch(/decidirDesdeAnuncio\(/)
    expect(simulador).toMatch(/responder\(lead, historialAgente/)
    expect(webhook).toMatch(/decidirDesdeAnuncio\(\{ botonId, texto, yaHablamos \}\)/)
  })

  it('solo lo abre un superadmin', () => {
    expect(simulador).toMatch(/rol !== 'superadmin'/)
  })
})

describe('⚠ la decisión es una sola y la comparten los dos', () => {
  it('con cero turnos del bot, saluda', async () => {
    const { decidirDesdeAnuncio } = await import('@/lib/bot/flujo-anuncio')
    const r = await decidirDesdeAnuncio({ texto: 'hola', yaHablamos: 0 })
    expect(r.botones.map(b => b.id)).toEqual(['cf_precio', 'cf_como', 'cf_probar'])
  })

  it('y con el saludo ya dado, no vuelve a saludar', async () => {
    /* Si saludara otra vez, quien escribe dos mensajes seguidos recibiría el
       mismo mensaje dos veces. */
    const { decidirDesdeAnuncio } = await import('@/lib/bot/flujo-anuncio')
    expect(await decidirDesdeAnuncio({ texto: 'y qué más', yaHablamos: 1 })).toBeNull()
  })

  it('el atasco sí se atiende aunque ya hayamos hablado', async () => {
    const { decidirDesdeAnuncio } = await import('@/lib/bot/flujo-anuncio')
    const r = await decidirDesdeAnuncio({ texto: 'no pude entrar', yaHablamos: 3 })
    expect(r.avisar).toBeTruthy()
    expect(r.botones).toHaveLength(3)
  })

  it('un botón que no es del flujo devuelve null y sigue al modelo', async () => {
    const { decidirDesdeAnuncio } = await import('@/lib/bot/flujo-anuncio')
    expect(await decidirDesdeAnuncio({ botonId: 'cartera_foto', yaHablamos: 0 })).toBeNull()
  })
})

describe('⚠ el camino conocido también llega escrito', () => {
  it('lo que la gente teclea de verdad recibe la respuesta preparada', () => {
    /* Se vio en el simulador: quien escribía «cuánto cuesta» en vez de pulsar
       el botón iba al modelo, teniendo la respuesta hecha. Y es la pregunta más
       frecuente: 127 personas. */
    for (const [frase, esperado] of [
      ['cuánto cuesta',            'cf_precio'],
      ['cuanto vale el programa',  'cf_precio'],
      ['precios',                  'cf_precio'],
      ['cual es la mensualidad',   'cf_precio'],
      ['cómo funciona',            'cf_como'],
      ['en qué consiste',          'cf_como'],
      ['es confiable?',            'cf_confiable'],
      ['cuánto tiempo llevan',     'cf_confiable'],
      ['esto es una estafa?',      'cf_confiable'],
    ]) {
      expect(intencionDeTexto(frase), `no reconoció «${frase}»`).toBe(esperado)
    }
  })

  it('⚠ «quiero pagar» NO se ataja: tiene que escalar a un humano', () => {
    /* Es de lo que más convierte (22 % paga) y el clasificador del bot lo
       escala. Atajarlo con una respuesta fija se llevaría por delante el
       aviso. */
    expect(intencionDeTexto('quiero pagar')).toBeNull()
    expect(intencionDeTexto('cómo hago para pagar por nequi')).toBeNull()
    expect(intencionDeTexto('quiero activar el plan')).toBeNull()
  })

  it('y no se inventa intenciones donde no las hay', () => {
    /* Un falso positivo contesta con el guion equivocado, que es peor que
       pasar por el modelo. */
    for (const frase of [
      'hola buenas tardes', 'tengo 300 clientes en mi cuaderno',
      'mi cobrador no puede entrar', 'gracias', '',
    ]) {
      expect(intencionDeTexto(frase), `se inventó una intención con «${frase}»`).toBeNull()
    }
  })

  it('y el atasco gana sobre la intención', async () => {
    /* «No pude ver los precios» es alguien atascado, no alguien preguntando
       cuánto cuesta. */
    const { decidirDesdeAnuncio } = await import('@/lib/bot/flujo-anuncio')
    const r = await decidirDesdeAnuncio({ texto: 'no pude ver los precios', yaHablamos: 2 })
    expect(r.avisar).toBeTruthy()
  })
})
