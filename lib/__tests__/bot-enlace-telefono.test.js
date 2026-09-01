// lib/__tests__/bot-enlace-telefono.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// La app guarda el teléfono con diez dígitos y WhatsApp lo entrega con doce.
// Tres sitios los comparaban con `=`, así que no casaban NUNCA. Medido en
// producción el 1 sep 2026 sobre 1.657 leads:
//
//   · enlazados a una organización ............ 220 (todos de 12 dígitos)
//   · que coinciden en texto exacto con su User . 0
//   · registrados y SIN enlazar ............... 207, de ellos 195 con el lead
//     ya creado en el momento de registrarse
//
// Lo que rompía: el bot le seguía mandando el link de registro a quien ya se
// había registrado, y los avisos post-registro salían por plantilla de pago
// porque la ventana de 24 h parecía cerrada siempre.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ultimos10, mismoTelefono } from '@/lib/bot/telefono'
import { BOTONES_CARTERA, respuestaDeBoton, esBotonDeCartera, mensajeBienvenida } from '@/lib/bot/cartera-post-registro'

const raiz = resolve(__dirname, '../..')
const sinComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const leer = (f) => sinComentarios(readFileSync(resolve(raiz, f), 'utf8'))

const registro    = leer('app/api/auth/registro/route.js')
const webhook     = leer('app/api/webhook/whatsapp-cloud/route.js')
const onboarding  = leer('app/api/cron/onboarding-whatsapp/route.js')
const reactivacion= leer('app/api/cron/reactivacion/route.js')
const cartera     = leer('lib/bot/cartera-post-registro.js')

describe('⚠ el mismo número, venga como venga', () => {
  it('los dos formatos que conviven de verdad son el mismo teléfono', () => {
    /* `573001234567` es lo que manda WhatsApp; `3001234567` es lo que escribe
       el usuario al registrarse. Compararlos con `=` da falso. */
    expect(mismoTelefono('573001234567', '3001234567')).toBe(true)
    expect(mismoTelefono('+57 300 123 4567', '300-123-4567')).toBe(true)
  })

  it('y dos números distintos no se confunden', () => {
    expect(mismoTelefono('573001234567', '3009999999')).toBe(false)
  })

  it('un fragmento corto NO casa con nadie', () => {
    /* Si `ultimos10` devolviera lo que hay aunque sean cuatro dígitos, el
       `endsWith` casaría con medio país. Por eso exige diez. */
    expect(ultimos10('4567')).toBe('')
    expect(ultimos10('')).toBe('')
    expect(ultimos10(null)).toBe('')
    expect(mismoTelefono('4567', '573001234567')).toBe(false)
  })

  it('diez dígitos exactos sí valen', () => {
    expect(ultimos10('3001234567')).toBe('3001234567')
    expect(ultimos10('573001234567')).toBe('3001234567')
  })
})

describe('⚠ nadie vuelve a cruzar por igualdad', () => {
  it('el registro enlaza por los últimos diez, no por el texto entero', () => {
    expect(registro).toMatch(/buscarLeads\(telefonoLimpio, \{ organizationId: null \}\)/)
    expect(registro).not.toMatch(/telefono: telefonoLimpio, organizationId: null/)
  })

  it('los dos crons preguntan por la ventana con la función buena', () => {
    /* Buscaban el lead con `owner.telefono` —diez dígitos— y no lo encontraban
       nunca, así que mandaban plantilla de marketing aunque la ventana gratuita
       estuviera abierta. */
    for (const [nombre, src] of [['onboarding', onboarding], ['reactivación', reactivacion]]) {
      expect(src, `${nombre} debe usar ventanaAbierta`).toMatch(/ventanaAbierta\(/)
      expect(src, `${nombre} no debe buscar el lead por igualdad`)
        .not.toMatch(/botLead\.findUnique\(\{ where: \{ telefono/)
    }
  })
})

describe('⚠ un botón pulsado no es un mensaje vacío', () => {
  it('el webhook lee la respuesta del botón, que no viene en text.body', () => {
    expect(webhook).toMatch(/tipo === 'interactive'/)
    expect(webhook).toMatch(/wa\.botonPulsado\(msg\)/)
    expect(webhook).toMatch(/interactive\?\.list_reply/)
  })

  it('⚠ y el webhook no lo descarta antes de mirarlo', () => {
    /* `interactive` faltaba en los tipos soportados: la rama que lee los
       botones existía y el mensaje moría tres funciones antes de llegar a
       ella. Solo se vio simulando un webhook de verdad contra el espejo — las
       pruebas de fuente pasaban igual. */
    expect(webhook).toMatch(/TIPOS_SOPORTADOS = new Set\(\[[^\]]*'interactive'/)
  })

  it('y el camino conocido se contesta sin llamar al modelo', () => {
    /* De los leads que contestan algo, la mitad se queda en dos o tres
       mensajes. Un botón con respuesta fija no gasta turno ni tokens, y además
       se salta los cinco segundos del debounce. */
    const atajo   = webhook.indexOf('esBotonDeCartera(botonId)')
    const debounce = webhook.indexOf('DEBOUNCE_MS = 5000')
    const modelo  = webhook.indexOf('await responder(lead')
    expect(atajo).toBeGreaterThan(-1)
    expect(atajo).toBeLessThan(debounce)
    expect(atajo).toBeLessThan(modelo)
  })
})

describe('⚠ el momento post-registro', () => {
  it('se ofrece sin que lo pidan, al crearse la cuenta', () => {
    /* Dos personas en toda la historia preguntaron cómo pasar sus clientes, y
       el 82 % de las organizaciones no pasa del quinto. Si el bot no lo saca
       solo, no lo descubre nadie. */
    expect(registro).toMatch(/sendButtons\(lead\.telefono, texto, BOTONES_CARTERA\)/)
    expect(registro).toMatch(/mensajeBienvenida\(/)
  })

  it('⚠ y SOLO dentro de la ventana gratuita', () => {
    /* Fuera de ella costaría una plantilla de marketing por cada registro, que
       es justo el gasto que se quiere bajar. */
    const guardia = registro.indexOf('await ventanaAbierta(telefonoLimpio)')
    const envio   = registro.indexOf('sendButtons(lead.telefono')
    expect(guardia).toBeGreaterThan(-1)
    expect(envio).toBeGreaterThan(guardia)
  })

  it('los tres botones caben en lo que Meta acepta', () => {
    /* Un título de más de 20 caracteres o dos ids repetidos hacen que Meta
       rechace el mensaje ENTERO con un 400: no manda una versión recortada, no
       manda nada. */
    expect(BOTONES_CARTERA).toHaveLength(3)
    const ids = new Set()
    for (const b of BOTONES_CARTERA) {
      expect(b.titulo.length, `«${b.titulo}» pasa de 20 caracteres`).toBeLessThanOrEqual(20)
      expect(ids.has(b.id), `id repetido: ${b.id}`).toBe(false)
      ids.add(b.id)
      expect(esBotonDeCartera(b.id), `${b.id} sin respuesta preparada`).toBe(true)
      expect(respuestaDeBoton(b.id).texto.length).toBeGreaterThan(10)
    }
  })

  it('solo «Necesito ayuda» despierta a un humano', () => {
    /* Si avisaran los tres, cada registro le sonaría el teléfono al equipo y
       dejarían de mirarlos. */
    expect(respuestaDeBoton('cartera_ayuda').avisar).toBe(true)
    expect(respuestaDeBoton('cartera_foto').avisar).toBe(false)
    expect(respuestaDeBoton('cartera_mano').avisar).toBe(false)
  })

  it('⚠ el teléfono no sustituye a la atención', () => {
    /* El número está —lo pidió el dueño—, pero después de preguntar y de
       avisar a un humano. Lo que convertía al 1 % era el traspaso, no el
       número: «eso se lo muestran en vivo, escríbales al 301» y fin. */
    const ayuda = respuestaDeBoton('cartera_ayuda')
    expect(ayuda.texto).toMatch(/Cuéntame en qué parte te quedaste/)
    expect(ayuda.texto.indexOf('301 199 3001')).toBeGreaterThan(ayuda.texto.indexOf('Cuéntame'))
    expect(ayuda.avisar).toBe(true)
    /* Las otras dos ramas resuelven, no derivan. */
    for (const id of ['cartera_foto', 'cartera_mano']) {
      expect(respuestaDeBoton(id).texto).not.toMatch(/301\s*199\s*3001/)
    }
  })

  it('manda a «Pasar mi cuaderno», que es donde está de verdad', () => {
    /* Decía «Clientes → botón de la cámara», que no existe. */
    const menu = readFileSync(resolve(raiz, 'components/armazon/BarraLateral.jsx'), 'utf8')
    expect(menu).toContain("nombre: 'Pasar mi cuaderno'")
    expect(respuestaDeBoton('cartera_foto').texto).toContain('Pasar mi cuaderno')
    expect(mensajeBienvenida('Ana')).toContain('Pasar mi cuaderno')
    expect(respuestaDeBoton('cartera_foto').texto).not.toMatch(/30\s+por\s+foto/i)
  })

  it('el saludo dice el nombre cuando lo hay, y no se rompe cuando no', () => {
    expect(mensajeBienvenida('Carlos')).toMatch(/^Listo, Carlos, /)
    expect(mensajeBienvenida('')).toMatch(/^Listo, tu cuenta/)
    expect(mensajeBienvenida(null)).toMatch(/cuaderno/)
    /* Y avisa de la trampa, no da la bienvenida: el 82 % se atasca por
       sentarse a teclear la cartera cliente por cliente. */
    expect(mensajeBienvenida('Ana')).toMatch(/no te sientes a escribir/i)
  })
})
