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

describe('⚠ el posicionamiento de marca', () => {
  it('el saludo recibe y posiciona antes de preguntar', () => {
    /* «Hola, bienvenido a Control Finanzas, el sistema para prestamistas número
       uno en Latinoamérica. ¿Por dónde quieres empezar?» — el dueño, con esas
       palabras. Decisión suya, ver la nota del fichero. */
    const t = saludoDeAnuncio().texto
    expect(t).toMatch(/bienvenido a Control Finanzas/i)
    expect(t).toMatch(/número uno en Latinoamérica/i)
    expect(t).toMatch(/¿Por dónde quieres empezar\?/)
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

  it('«Cómo funciona» es donde el sistema se vende, y devuelve el control', () => {
    /* ⚠ AQUÍ SÍ SE EXTIENDE, Y ES A PROPÓSITO. La primera versión contestaba en
       dos líneas «porque es la que peor convierte». El dueño: «aquí podemos
       vendernos bien, embellecer el sistema, todo lo que hace, para enamorar al
       cliente». Quien pulsa esto está pidiendo que le cuenten — el sitio para
       ser corto es el precio, no aquí.

       El único límite es el de WhatsApp, y ese sí es duro. */
    const r = respuestaDeBoton('cf_como')
    expect(r.texto.length).toBeGreaterThan(400)
    expect(r.texto.length).toBeLessThanOrEqual(1024)
    /* Y tiene que nombrar lo que de verdad diferencia al sistema. */
    for (const gancho of [/modo de inter[eé]s/i, /comprobante/i, /rutas?/i, /Excel/, /sin internet/i]) {
      expect(r.texto, `falta ${gancho}`).toMatch(gancho)
    }
    expect(r.botones.map(b => b.id)).toContain('cf_probar')
  })

  it('el precio vende cada plan por para quién es, no por su tope', () => {
    /* «Nuestros planes van desde el inicial, ideal para cobradores solos que
       están empezando… y si tienes cobradores, desde $79.000 con cuenta de
       administrador y de cobrador» — el dueño. Una tabla de topes obliga al
       cliente a adivinar cuál es el suyo. */
    const t = respuestaDeBoton('cf_precio').texto
    expect(t).toMatch(/cobras t[uú] solo|cobra solo|el que cobra/i)
    expect(t).toMatch(/cobradores/i)
    expect(t).toMatch(/Lucas/)
    expect(t.length).toBeLessThanOrEqual(1024)
  })

  it('«Quiero probarlo» manda el link, y deja por dónde seguir si se traba', () => {
    /* El link va primero y sin nada que distraiga —quien pulsa esto ya
       decidió—, pero la rama NO puede morir ahí: «no dejes que mande un
       mensaje y ya está». */
    const r = respuestaDeBoton('cf_probar')
    expect(r.texto).toContain('app.control-finanzas.com/registro')
    expect(r.texto.indexOf('registro')).toBeLessThan(r.texto.length / 2)
    expect(r.botones.length).toBeGreaterThan(0)
  })

  it('⚠ ninguna respuesta muere sin salida', () => {
    /* Un mensaje que cierra la conversación es un lead perdido. O deja
       botones, o invita a escribir. */
    for (const b of TODOS) {
      const r = respuestaDeBoton(b.id)
      if (!r) continue
      const tieneSalida = (r.botones?.length ?? 0) > 0 ||
        /escríbeme|pregúntame|cuéntame|me escribes|me preguntas|escríbenos/i.test(r.texto)
      expect(tieneSalida, `${b.id} termina sin salida`).toBe(true)
    }
  })

  it('la respuesta de confianza no inventa cifras que no tiene', () => {
    /* Se lo estamos diciendo a alguien que decide si nos entrega los números de
       su negocio. Sin datos, se dice lo que sí sabemos y ya. */
    const conDatos = textoConfianza({ negocios: 587, prestamos: 6229 })
    expect(conDatos).toContain('587')
    expect(conDatos).toContain('6.229')
    /* ⚠ POSICIONAMIENTO DECIDIDO POR EL DUEÑO el 1 sep 2026, reafirmado tras
       enseñarle lo que mide la base (primera organización: 1 mar 2026, cuatro
       países). Se ancla aquí para que nadie lo quite «arreglándolo». */
    expect(conDatos).toMatch(/m[aá]s de dos años/i)
    expect(conDatos).toMatch(/Latinoamérica/)

    const sinDatos = textoConfianza({})
    expect(sinDatos).not.toMatch(/\bNaN\b|undefined|\bnull\b/)
    expect(sinDatos).not.toMatch(/\d+\s+meses/)
    /* Aun sin cifras tiene que quedar lo que de verdad calma a quien duda: que
       sus datos son suyos y que no arriesga nada por comprobarlo. */
    expect(sinDatos).toMatch(/tus datos|tu cuenta/i)
    /* Y lo que cierra no es la negación —«no pedimos tarjeta», que aquí sonaba
       defensiva de tanto repetirla— sino la invitación a comprobarlo. */
    expect(sinDatos).toMatch(/míralo tú mismo/i)
    /* Y lo que se afirma sobre el producto tiene que estar comprobado: respaldo
       diario (cron `cf-respaldo`, cifrado, con copia fuera) y copia descargable
       (`app/api/cuenta/backup`). */
    expect(sinDatos).toMatch(/copia de seguridad todos los días/i)
  })

  it('y con pocos negocios no se presume de un número que no impresiona', () => {
    /* El posicionamiento se mantiene; lo que se calla es la cifra pequeña. */
    const t = textoConfianza({ negocios: 3, prestamos: 4 })
    expect(t).not.toMatch(/m[aá]s de 3 prestamistas/i)
    expect(t).toMatch(/m[aá]s de dos años/i)
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

  it('⚠ el soporte se ofrece ADEMÁS de atender, nunca en lugar de atender', () => {
    /* El dato que había quitado el número —274 derivaciones y 4 tickets— no
       dice «no des el número»: dice que el bot lo daba EN LUGAR de atender
       («escríbales al 301» y fin). Ahora va con su horario, y el mensaje sigue
       preguntando, dando botones y avisando a un humano. */
    const primero = respuestaAtasco()
    expect(primero.texto).toMatch(/te quedaste/i)
    expect(primero.texto).toContain('301 199 3001')
    expect(primero.texto).toMatch(/lunes a domingo/i)
    expect(primero.botones).toHaveLength(3)
    expect(primero.avisar).toBeTruthy()

    for (const b of BOTONES_ATASCO) {
      const r = respuestaDeBoton(b.id)
      expect(r.avisar, `${b.id} debe avisar a un humano`).toBeTruthy()
      expect(r.botones.length, `${b.id} no deja por dónde seguir`).toBeGreaterThan(0)
      /* Y ninguna rama puede ser SOLO el teléfono: tiene que atender. */
      const sinTelefono = r.texto.split('Si prefieres hablar con una persona')[0].trim()
      expect(sinTelefono.length, `${b.id} no atiende, solo deriva`).toBeGreaterThan(60)
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
    expect(webhook).toMatch(/decidirDesdeAnuncio\(\{[\s\S]{0,120}botonId, texto, yaHablamos/)
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

  it('⚠ «quiero pagar» se contesta CON el link Y avisando a un humano', () => {
    /* Es de lo que más convierte: 44 % de registro y 22 % de pago. Antes no se
       atajaba para no perder el escalado; ahora la respuesta fija lleva
       `avisar`, así que se le da el link y el humano se entera igual. */
    expect(intencionDeTexto('quiero pagar')).toBe('cf_pagar')
    expect(intencionDeTexto('cómo hago para pagar')).toBe('cf_pagar')
    expect(intencionDeTexto('quiero activar el plan')).toBe('cf_pagar')

    const r = respuestaDeBoton('cf_pagar')
    expect(r.texto).toContain('/configuracion/plan')
    expect(r.texto).toContain('301 199 3001')
    expect(r.avisar).toBeTruthy()
  })

  it('y quien pide videos recibe el curso, no una excusa', () => {
    /* 35 personas los han pedido desde julio. El bot de siempre llegó a decir
       «no le puedo enviar video por este medio», que era falso. */
    expect(intencionDeTexto('tienen videos?')).toBe('cf_videos')
    expect(intencionDeTexto('mándame un tutorial')).toBe('cf_videos')
    const r = respuestaDeBoton('cf_videos')
    expect(r.texto).toMatch(/youtube\.com\/playlist/)
    expect(r.botones.length).toBeGreaterThan(0)
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

describe('⚠ lo que dijeron las 1.047 conversaciones reales', () => {
  /* Medido el 1 sep 2026 sobre el histórico completo del bot, comparando a
     quien acabó PAGANDO contra quien solo se registró y no volvió. Los dos
     hallazgos que cambiaron el flujo:

     1. «¿podré pasar mi cartera?» es una objeción de PREVENTA, no solo un
        problema de después. Antes de registrarse la tocó el 21 % de los que
        pagaron y el 26 % de los que usan el sistema, contra el 12 % de los que
        se registraron y no volvieron.

     2. El precio se pregunta MÁS después de entrar que antes: 29 % antes de
        registrarse contra 44 % después, entre los que pagaron. */

  it('el saludo contesta lo de la cartera sin que lo pregunten', () => {
    const t = saludoDeAnuncio().texto
    expect(t).toMatch(/cartera/i)
    expect(t).toMatch(/foto|cuaderno/i)
    expect(t).toMatch(/Excel/)
  })

  it('⚠ y al que YA está dentro, el precio le da por dónde pagar', () => {
    /* Ofrecerle la prueba gratis a quien ya la tiene es no escuchar: está
       preguntando el precio porque va a pagar. */
    const fuera = respuestaDeBoton('cf_precio').texto
    const dentro = respuestaDeBoton('cf_precio', { registrado: true }).texto
    expect(fuera).toMatch(/gratis, sin tarjeta/i)
    expect(fuera).not.toContain('/configuracion/plan')
    expect(dentro).toContain('/configuracion/plan')
    expect(dentro).not.toMatch(/días son gratis/i)
    /* Los precios son los mismos en los dos casos. */
    for (const fila of tablaDePrecios('co')) {
      expect(dentro).toContain(fila.precio.toLocaleString('es-CO'))
    }
  })

  it('y la decisión arrastra ese dato desde el webhook', () => {
    expect(webhook).toMatch(/registrado: Boolean\(lead\.organizationId\)/)
  })
})

describe('⚠ lo que se nombra, se da', () => {
  /* El mensaje de atasco decía «tenemos videos tutoriales» y no los daba: ni el
     link en el texto ni un botón que llevara a ellos, porque los tres botones
     son los del diagnóstico. El dueño, con una captura: «no tiene lógica».
     Nombrar algo sin darlo deja al cliente peor que si no se lo mencionas. */
  const TODOS_LOS_MENSAJES = () => {
    const ids = [...BOTONES_ENTRADA, ...BOTONES_ATASCO,
      { id: 'cf_confiable' }, { id: 'cf_humano' }, { id: 'cf_videos' }, { id: 'cf_pagar' }]
    return [
      ['saludo', saludoDeAnuncio()],
      ['atasco', respuestaAtasco()],
      ...ids.map(b => [b.id, respuestaDeBoton(b.id)]).filter(([, r]) => r),
    ]
  }

  it('quien nombra los videos, o da el link o da el botón', () => {
    for (const [nombre, r] of TODOS_LOS_MENSAJES()) {
      const t = String(r.texto ?? '')
      if (!/video|tutorial|curso/i.test(t)) continue
      const daLink = /youtube\.com/i.test(t)
      const daBoton = (r.botones ?? []).some(b => /videos/i.test(b.id))
      expect(daLink || daBoton, `«${nombre}» nombra los videos y no los da`).toBe(true)
    }
  })

  it('y quien nombra el soporte, da el número y el horario', () => {
    for (const [nombre, r] of TODOS_LOS_MENSAJES()) {
      const t = String(r.texto ?? '')
      if (!/soporte|persona del equipo/i.test(t)) continue
      expect(t, `«${nombre}» nombra soporte sin número`).toContain('301 199 3001')
      expect(t, `«${nombre}» nombra soporte sin horario`).toMatch(/lunes a domingo/i)
    }
  })
})

describe('⚠ cada promesa se dice una sola vez', () => {
  it('«sin tarjeta» aparece UNA vez en todo el flujo', () => {
    /* Estaba en cuatro mensajes seguidos. El dueño: «insiste mucho en lo de no
       pedimos tarjeta y eso hace desconfiar». Repetir que no pides algo suena
       defensivo y hace pensar que hay letra pequeña. Se dice donde la objeción
       existe —al ver el precio— y en el resto se afirma en vez de negar. */
    const textos = [saludoDeAnuncio().texto, respuestaAtasco().texto,
      ...TODOS.map(b => respuestaDeBoton(b.id)?.texto).filter(Boolean),
      textoConfianza({ negocios: 587, prestamos: 6229 })]
    const veces = textos.filter(t => /sin tarjeta|no pedimos tarjeta|no te pedimos/i.test(t)).length
    expect(veces, 'la promesa de «sin tarjeta» se repite').toBe(1)
    expect(respuestaDeBoton('cf_precio').texto).toMatch(/sin tarjeta/i)
  })

  it('y los demás afirman en vez de negar', () => {
    for (const id of ['cf_probar', 'cf_videos', 'cf_confiable']) {
      const t = id === 'cf_confiable'
        ? textoConfianza({ negocios: 587, prestamos: 6229 })
        : respuestaDeBoton(id).texto
      expect(t, `${id} sigue negando`).not.toMatch(/no pedimos tarjeta/i)
    }
  })
})

describe('⚠ el trato no se mezcla', () => {
  /* Mezclar «usted» y «tú» en la misma conversación se nota y rompe la
     ilusión de estar hablando con alguien. La marca tutea — es como escribe el
     dueño: «¿Por dónde quieres empezar?». */
  const DE_USTED = /\busted\b|\bcuénteme\b|\bdígame\b|\bmétale\b|\btómele\b|\bescríbame\b|\bmírelo\b/i

  it('ninguna respuesta del flujo trata de usted', () => {
    const textos = [saludoDeAnuncio().texto, respuestaAtasco().texto,
      ...TODOS.map(b => respuestaDeBoton(b.id)?.texto).filter(Boolean),
      textoConfianza({ meses: 6, negocios: 353, prestamos: 6229 }), textoConfianza({})]
    for (const t of textos) {
      const m = t.match(DE_USTED)
      expect(m, `trata de usted: «${m?.[0]}» en «${t.slice(0, 60)}…»`).toBeNull()
    }
  })

  it('y tampoco los del momento post-registro', async () => {
    const { mensajeBienvenida, BOTONES_CARTERA, respuestaDeBoton: rc } =
      await import('@/lib/bot/cartera-post-registro')
    const textos = [mensajeBienvenida('Ana'), ...BOTONES_CARTERA.map(b => rc(b.id).texto)]
    for (const t of textos) {
      const m = t.match(DE_USTED)
      expect(m, `trata de usted: «${m?.[0]}»`).toBeNull()
    }
  })
})
