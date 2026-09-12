/**
 * MODO SOMBRA DEL BOT NUEVO.
 *
 * El webhook manda una copia de cada turno —lo que dijo el lead y lo que el bot
 * de siempre acaba de contestarle— a un servicio local que calcula qué habría
 * respondido el motor nuevo y lo guarda. NO envía nada a nadie.
 *
 * Lo que estas pruebas protegen es lo único que importa aquí: que la sombra no
 * pueda tocar al lead. Si mañana alguien le pone un `await` sin `catch`, o la
 * sube antes de responder, el fallo se lo come el cliente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(process.cwd(), 'app/api/webhook/whatsapp-cloud/route.js'), 'utf8')

/* El cuerpo de una función, de su cabecera al cierre a nivel cero. Recortar a
   ojo con un número de caracteres se quedaba corto en cuanto crecía un
   comentario, y la prueba fallaba sin que nada estuviera mal. */
const cuerpoDe = (nombre) => {
  const i = src.indexOf(nombre)
  if (i < 0) return ''
  const fin = src.indexOf('\n}', i)
  return fin < 0 ? src.slice(i) : src.slice(i, fin + 2)
}

describe('la sombra no puede tocar al bot', () => {
  it('⚠ va DESPUÉS de responder, nunca antes', () => {
    const responder = src.indexOf('await _responderAlLead(msg, lead, tipo, messageId, botApagado)')
    const sombra = src.indexOf('await copiarASombra(')
    expect(responder, 'no encuentro la llamada que responde').toBeGreaterThan(-1)
    expect(sombra, 'no encuentro la copia a la sombra').toBeGreaterThan(-1)
    expect(sombra, 'la sombra se adelantó a la respuesta al lead').toBeGreaterThan(responder)
  })

  it('⚠ fuego y olvido: el `fetch` no se espera y su fallo se traga', () => {
    const cuerpo = cuerpoDe('function enviarASombra(')
    expect(cuerpo).toMatch(/\n\s*fetch\('http:\/\/127\.0\.0\.1:3011\/api\/shadow\/turn'/)
    expect(cuerpo, 'alguien puso un await delante del fetch').not.toMatch(/await fetch\(/)
    expect(cuerpo, 'sin catch, un fallo de red tumbaría el handler').toMatch(/\.catch\(\(\) => \{\}\)/)
    expect(cuerpo, 'sin corte, una sombra colgada retiene el handler').toMatch(/AbortSignal\.timeout\(2000\)/)
  })

  it('y lo que rodea a la lectura de la base también está envuelto', () => {
    const cuerpo = cuerpoDe('async function copiarASombra(')
    expect(cuerpo).toMatch(/try \{/)
    expect(cuerpo).toMatch(/catch \(e\)/)
  })
})

describe('el interruptor', () => {
  it('apagado por defecto: sin SOMBRA_ACTIVA=true no sale un solo byte', () => {
    // Las DOS puertas lo comprueban, para que no dependa de una sola línea.
    expect((src.match(/process\.env\.SOMBRA_ACTIVA !== 'true'\) return/g) || [])).toHaveLength(2)
  })

  it('el secreto va en cabecera y sale del entorno, nunca escrito aquí', () => {
    expect(src).toMatch(/'x-shadow-secret': process\.env\.SOMBRA_SECRETO/)
  })
})

describe('qué se manda, y qué no', () => {
  it('⚠ solo el teléfono, el texto, el id y lo que contestó el bot', () => {
    const cuerpo = cuerpoDe('function enviarASombra(')
    const campos = /JSON\.stringify\(\{([^}]+)\}\)/.exec(cuerpo)?.[1] ?? ''
    const nombres = [...campos.matchAll(/(\w+):/g)].map((m) => m[1]).sort()
    expect(nombres).toEqual(['botReply', 'contactId', 'externalId', 'text'])
    // Nada de la organización, el plan ni la cartera.
    for (const prohibido of ['organizationId', 'plan', 'cartera', 'orgNombre', 'email']) {
      expect(cuerpo, `se coló ${prohibido}`).not.toContain(prohibido)
    }
  })

  it('solo texto y audio transcrito: la imagen y los botones se quedan fuera', () => {
    const cuerpo = cuerpoDe('async function copiarASombra(')
    expect(cuerpo).toMatch(/tipo !== 'text' && tipo !== 'audio'\) return/)
    // El audio sin transcribir se guarda como «[nota de voz]» y no vale.
    expect(cuerpo).toMatch(/\[nota de voz\]/)
  })
})

describe('la respuesta se lee de la base, no se pasa desde cada rama', () => {
  it('⚠ así entran las OCHO salidas de _responderAlLead, no solo la del modelo', () => {
    /* Meter la llamada en cada rama es el fallo que este repositorio ya pagó
       tres veces: se arregla una vía y se deja la otra. Todas las ramas que
       contestan escriben en `BotConversacion` con rol 'bot', así que se
       pregunta por la última respuesta posterior al mensaje del lead. */
    const cuerpo = cuerpoDe('async function copiarASombra(')
    expect(cuerpo).toMatch(/rol: 'bot', createdAt: \{ gt: entrante\.createdAt \}/)
    expect(cuerpo).toMatch(/orderBy: \{ createdAt: 'desc' \}/)
    // Y si no contestó nadie, se manda «», que es lo que el servicio espera.
    expect(cuerpo).toMatch(/respuesta\?\.texto \?\? ''/)
  })

  it('no se llama a la sombra desde dentro de _responderAlLead', () => {
    const ini = src.indexOf('async function _responderAlLead(')
    const fin = src.indexOf('async function atenderDesdeAnuncio(')
    expect(ini).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(ini)
    expect(src.slice(ini, fin)).not.toMatch(/Sombra|enviarASombra|copiarASombra/)
  })
})
