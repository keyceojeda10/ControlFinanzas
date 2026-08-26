// Simulación end-to-end del CEREBRO real del bot (responder()).
// - LLM real (Claude Haiku) — respuestas auténticas, no mockeadas.
// - DB mockeada — CERO escrituras, control total de si el lead está registrado.
// - NO envía WhatsApp (el envío vive en el webhook, no en responder()).
//
// Correr en el VPS (donde está la ANTHROPIC_API_KEY):
//   SIM_LIVE=1 npx vitest run lib/bot-v2/simulacion.test.mjs
// Sin SIM_LIVE se salta (para no gastar API en `npm test` normal).
import 'dotenv/config'
import { describe, it, expect, vi } from 'vitest'

// Estado mutable: simula si el teléfono está registrado y su plan.
const estado = vi.hoisted(() => ({ registrado: false, plan: 'starter', demo: false }))

// Mock de la DB. El LLM NO se mockea (respuestas reales).
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: async () => estado.registrado
        ? { id: 'sim-user', telefono: '3009999999', organization: { plan: estado.plan, planDemoHasta: estado.demo ? new Date(Date.now() + 5 * 864e5) : null } }
        : null,
    },
    botLead: { update: async () => ({}) },
    botGastoApi: { create: async () => ({}) },
  },
}))

const { responder, generarSeguimiento } = await import('./agente.js')

const LIVE = !!process.env.SIM_LIVE
const suite = LIVE ? describe : describe.skip
const TIMEOUT = 90000

function leadBase(over = {}) {
  return {
    id: 'sim-lead', nombre: 'Cliente', telefono: '3009999999',
    temperatura: 40, estado: 'interesado', metodoActual: null, cantClientes: null,
    ...over,
  }
}

// Reproduce cómo el webhook arma el historial: guarda el msg del lead y LUEGO
// llama a responder() con ese historial + el mismo texto como "entrante".
async function turno(lead, historial, texto, tipo = 'chat') {
  historial.push({ rol: 'lead', texto, createdAt: new Date() })
  const d = await responder(lead, historial, { texto, tipoMensaje: tipo, imagenBase64: null, imagenMime: null })
  if (d?.mensaje) historial.push({ rol: 'bot', texto: d.mensaje, createdAt: new Date() })
  return d
}

function pintar(titulo, historial, extra = '') {
  console.log('\n' + '='.repeat(74))
  console.log('FLUJO: ' + titulo + (extra ? '   [' + extra + ']' : ''))
  console.log('='.repeat(74))
  for (const m of historial) {
    const who = m.rol === 'bot' ? 'BOT ' : 'LEAD'
    console.log(`  ${who}: ${(m.texto || '').replace(/\n+/g, ' ⏎ ')}`)
  }
}

suite('Simulación de flujos reales del bot', () => {
  it('1) Happy path completo → termina enviando el LINK de registro', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Wilmer', metodoActual: 'cuaderno_papel', cantClientes: '20_50' })
    const h = []
    await turno(lead, h, 'Hola, vi el anuncio en Facebook')
    await turno(lead, h, 'Sí, presto y llevo todo en un cuaderno')
    await turno(lead, h, 'Sumo a mano y a veces me pierdo')
    await turno(lead, h, 'Me interesa, cómo funciona')
    await turno(lead, h, 'Sí dale, muéstrame')
    pintar('Envío de link (happy path)', h)
    const bots = h.filter(m => m.rol === 'bot').map(m => m.texto).join('  ')
    expect(bots).toContain('app.control-finanzas.com/registro')
  }, TIMEOUT)

  it('2) Problema técnico (registrado) → escala a soporte con el 301', async () => {
    estado.registrado = true; estado.plan = 'basic'
    const lead = leadBase({ nombre: 'Oswaldo', estado: 'registrado', temperatura: 80 })
    const h = [{ rol: 'bot', texto: 'Hola Oswaldo, bienvenido a Control Finanzas', createdAt: new Date() }]
    const d = await turno(lead, h, 'Hermano no me carga la app, me sale error')
    pintar('Escalado a soporte técnico', h, `escalar=${d.escalar}`)
    expect(d.escalar).toBe(true)
    expect(d.mensaje).toContain('301 199 3001')
  }, TIMEOUT)

  it('3) Solicitud de asesor / llamada', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Gabriel', temperatura: 70 })
    const base = () => [
      { rol: 'bot', texto: 'Hola Gabriel, gracias por su interés', createdAt: new Date() },
      { rol: 'lead', texto: 'quiero info', createdAt: new Date() },
      { rol: 'bot', texto: 'Claro, es un sistema para su cartera de cobros', createdAt: new Date() },
    ]
    const h1 = base()
    const d1 = await turno(lead, h1, 'Quiero hablar con un asesor')
    pintar('Pide asesor ("quiero hablar con un asesor")', h1, `escalar=${d1.escalar}`)
    expect(d1.escalar).toBe(true)

    const h2 = base()
    const d2 = await turno(lead, h2, 'Me pueden llamar al 3154467925')
    pintar('Pide llamada ("me pueden llamar") — revela comportamiento', h2, `escalar=${d2.escalar}`)
  }, TIMEOUT)

  it('4) Pregunta técnica de preventa → responde sin escalar ni inventar', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Ana', temperatura: 40 })
    const h = [
      { rol: 'bot', texto: 'Hola Ana, cómo lleva sus cobros hoy?', createdAt: new Date() },
      { rol: 'lead', texto: 'hola', createdAt: new Date() },
      { rol: 'bot', texto: 'Cómo lleva el control de su cartera?', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'Cómo funciona exactamente el sistema?')
    pintar('Pregunta técnica preventa', h, `escalar=${d.escalar}`)
    expect(d.escalar).toBe(false)
  }, TIMEOUT)

  it('5) [FIX] Cliente REGISTRADO "retirar plata de caja" NO recibe la despedida', async () => {
    estado.registrado = true; estado.plan = 'growth'
    const lead = leadBase({ nombre: 'Oswaldo', estado: 'registrado', temperatura: 75 })
    const h = [
      { rol: 'bot', texto: 'Hola Oswaldo', createdAt: new Date() },
      { rol: 'lead', texto: 'buenos dias', createdAt: new Date() },
      { rol: 'bot', texto: 'Buenos días, en qué le ayudo?', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'Mano quiero retirar una plata del saldo de la caja')
    pintar('[FIX 1] Registrado: retirar plata (antes daba despedida)', h)
    expect(d.mensaje).not.toContain('Si en algun momento necesita una herramienta')
  }, TIMEOUT)

  it('6) [FIX] NO promete recordatorios automáticos a los clientes', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Luis', temperatura: 50, metodoActual: 'cuaderno_papel' })
    const h = [
      { rol: 'bot', texto: 'Hola Luis', createdAt: new Date() },
      { rol: 'lead', texto: 'hola', createdAt: new Date() },
      { rol: 'bot', texto: 'Cómo lleva sus cobros?', createdAt: new Date() },
      { rol: 'lead', texto: 'en cuaderno', createdAt: new Date() },
      { rol: 'bot', texto: 'Entiendo, con el sistema lo organiza fácil', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'El sistema le manda recordatorios de pago automáticos a mis clientes?')
    pintar('[FIX 3] Alucinación de recordatorios automáticos', h)
    const m = (d.mensaje || '').toLowerCase()
    expect(/(?:avisa|notifica|recuerda|env[ií]a|manda)[^.\n]{0,40}autom[aá]tic[^.\n]{0,40}(?:client|deudor)/i.test(m)).toBe(false)
  }, TIMEOUT)

  it('7) [FIX] "¿hay plan anual?" → lo ofrece, no lo niega', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Yesid', temperatura: 60, cantClientes: '20_50' })
    const h = [
      { rol: 'bot', texto: 'Hola Yesid', createdAt: new Date() },
      { rol: 'lead', texto: 'cuanto vale', createdAt: new Date() },
      { rol: 'bot', texto: 'El plan Inicial son $39.000/mes', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'No quiero mensual, tienen plan anual?')
    pintar('[FIX] Plan anual (antes lo negaba)', h)
    const m = (d.mensaje || '').toLowerCase()
    expect(/no (?:tenemos|hay|manejamos|existe|contamos con)[^.\n]{0,25}anual/.test(m)).toBe(false)
    expect(/solo (?:manejamos|tenemos|hay)[^.\n]{0,25}mensual/.test(m)).toBe(false)
  }, TIMEOUT)

  it('8) Seguimiento (cron): genera mensajes de intento 1 y 2', async () => {
    estado.registrado = false
    const lead = leadBase({ nombre: 'Erazo', temperatura: 55, metodoActual: 'cuaderno_papel', cantClientes: 'mas_de_100' })
    const h = [
      { rol: 'bot', texto: 'Hola Erazo, cómo lleva su cartera?', createdAt: new Date() },
      { rol: 'lead', texto: 'con cuaderno', createdAt: new Date() },
      { rol: 'bot', texto: 'Y sabe cuánto le deben en total?', createdAt: new Date() },
    ]
    const s1 = await generarSeguimiento(lead, h, 1)
    const s2 = await generarSeguimiento(lead, h, 2)
    console.log('\n' + '='.repeat(74))
    console.log('FLUJO: Seguimientos automáticos (cron)')
    console.log('='.repeat(74))
    console.log('  SEG #1:', (s1.mensaje || '').replace(/\n+/g, ' ⏎ '))
    console.log('  SEG #2:', (s2.mensaje || '').replace(/\n+/g, ' ⏎ '))
    expect(s1.mensaje).toBeTruthy()
    expect(s2.mensaje).toBeTruthy()
  }, TIMEOUT)

  it('9) [FIX] Registrado pregunta de PLATA → soporte, sin improvisar el procedimiento', async () => {
    estado.registrado = true; estado.plan = 'growth'
    const lead = leadBase({ nombre: 'Oswaldo', estado: 'registrado', temperatura: 70 })
    const h = [
      { rol: 'bot', texto: 'Hola Oswaldo', createdAt: new Date() },
      { rol: 'lead', texto: 'buenas', createdAt: new Date() },
      { rol: 'bot', texto: 'Buenas, en qué le ayudo?', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'El interés se calcula sobre el saldo o sobre el total?')
    pintar('[FIX] Pregunta operativa de plata (registrado)', h, `escalar=${d.escalar}`)
    expect(d.escalar).toBe(true)
    expect(d.mensaje).toContain('301 199 3001')
    // Lo crítico: que NO se invente el procedimiento.
    expect(/le\s+da\s+(?:en\s+)?egreso|ajuste\s+de\s+caja/i.test(d.mensaje || '')).toBe(false)
  }, TIMEOUT)

  it('10) [FIX 26-ago] Un «Sí» a la pregunta de deuda NO salta al link: explora', async () => {
    // La lección con 3 citas: Bot «Sabe exactamente cuánto le deben?» → «Sí»
    // → el bot ofrecía el link sin explorar. Ahora NO debe cerrar: o sigue
    // explorando (pregunta) o conecta valor — pero sin ofrecer la prueba ni
    // mandar el link todavía. (El LLM es no-determinista: a veces pregunta,
    // a veces conecta valor; ambas cumplen la regla.)
    estado.registrado = false
    const lead = leadBase({ nombre: 'Nelson', temperatura: 40 })
    const h = [
      { rol: 'bot', texto: 'Hola Nelson, cómo lleva sus cobros hoy?', createdAt: new Date() },
      { rol: 'lead', texto: 'presto y llevo la cartera en libreta', createdAt: new Date() },
      { rol: 'bot', texto: 'Sabe exactamente cuánto le deben en total hoy?', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'Sí')
    pintar('[FIX 26-ago] Sí a la pregunta de deuda → explora, no cierra', h)
    const m = (d.mensaje || '').toLowerCase()
    // Lo esencial: NO manda el link de registro ni ofrece la prueba todavía.
    expect(m).not.toContain('app.control-finanzas.com/registro')
    expect(m).not.toMatch(/probar(?:lo)? (?:gratis|14 dias)|14 dias gratis/)
    // Y sigue la conversación: o hace una pregunta o conecta valor con lo que
    // el lead dijo (no se despide ni se queda mudo).
    expect(m.length).toBeGreaterThan(20)
  }, TIMEOUT)

  it('11) [FIX 26-ago] Lead con interés explícito SÍ recibe el link directo', async () => {
    // La señal de compra explícita sigue cerrando de una (medido que funciona).
    estado.registrado = false
    const lead = leadBase({ nombre: 'Jhon', temperatura: 50, cantClientes: '20_50' })
    const h = [
      { rol: 'bot', texto: 'Hola Jhon, con el sistema organiza su cartera desde el celular', createdAt: new Date() },
      { rol: 'lead', texto: 'me interesa, cómo me registro?', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'mándeme el link para registrarme')
    pintar('[FIX 26-ago] Señal explícita → link directo', h)
    expect((d.mensaje || '')).toContain('app.control-finanzas.com/registro')
  }, TIMEOUT)

  it('12) [FIX 26-ago] No promete el link sin escribirlo (caso Luis/bandeja)', async () => {
    // «Perfecto Luis, ya esta en camino. Mire la bandeja de entrada» — el bot
    // prometía un link que no escribía. El sanitizador ahora lo agrega, y el
    // prompt lo prohíbe. El mensaje final debe llevar el link SIEMPRE.
    estado.registrado = false
    const lead = leadBase({ nombre: 'Luis', temperatura: 60 })
    const h = [
      { rol: 'bot', texto: 'Hola Luis, con el sistema ve al instante cuánto le deben', createdAt: new Date() },
      { rol: 'lead', texto: 'dale, me interesa probarlo', createdAt: new Date() },
      { rol: 'bot', texto: 'Perfecto, aquí se registra: https://app.control-finanzas.com/registro?r=2', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'Ya está en camino o cómo me llega el link?')
    pintar('[FIX 26-ago] Pregunta por el link prometido', h)
    // El mensaje NO debe decir "bandeja de entrada" ni prometer sin entregar:
    // si menciona el link, lo incluye.
    expect((d.mensaje || '').toLowerCase()).not.toMatch(/bandeja de entrada|en su correo|va (?:a )?llegar/)
    if (/(?:link|enlace)/i.test(d.mensaje || '')) {
      expect(d.mensaje).toMatch(/https?:\/\//)
    }
  }, TIMEOUT)

  it('13) [FIX 26-ago] Mantiene el "usted" cuando el lead usa "usted"', async () => {
    // Caso Wasson: el bot cambió a "tú" a mitad de conversación. Con el lead
    // hablando de usted, el bot debe responder de usted.
    estado.registrado = false
    const lead = leadBase({ nombre: 'Wasson', temperatura: 40 })
    const h = [
      { rol: 'bot', texto: 'Hola Wasson, cómo lleva sus cobros?', createdAt: new Date() },
      { rol: 'lead', texto: 'yo llevo todo en una libreta, usted me dice cómo funciona eso', createdAt: new Date() },
      { rol: 'bot', texto: 'Entiendo, con el sistema pasa de la libreta al celular en 5 minutos', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'y cuánto cuesta?')
    pintar('[FIX 26-ago] Usted consistente (caso Wasson)', h)
    const m = (d.mensaje || '').toLowerCase()
    // Si el lead usa "usted", el bot no debe tuteear (tienes, puedes, tu negocio).
    expect(/\btienes\b|\bpuedes\b|\btu\s+(?:negocio|plata|dinero)\b/.test(m)).toBe(false)
  }, TIMEOUT)

  it('14) [FIX 26-ago] Lead que manda publicidad de otro negocio se redirige', async () => {
    // Caso Luis Pérez: mandaba catálogos de motos y el bot le seguía la
    // conversación. Ahora debe redirigir al propósito o cerrar cordial.
    estado.registrado = false
    const lead = leadBase({ nombre: 'Luis', temperatura: 40 })
    const h = [
      { rol: 'bot', texto: 'Hola Luis, le escribimos de Control Finanzas', createdAt: new Date() },
      { rol: 'lead', texto: 'Tengo las mejores motos de la región, mírelas en mi catálogo', createdAt: new Date() },
    ]
    const d = await turno(lead, h, 'Las motos pasan del contenedor al comprador, precios y catálogos en mi página')
    pintar('[FIX 26-ago] Publicidad de otro negocio → redirige', h)
    const m = (d.mensaje || '').toLowerCase()
    // No debe entrar en el tema de las motos (no preguntar precios, no seguirlas).
    expect(/(?:moto|catálogo|catalogo|bicicleta)/.test(m)).toBe(false)
  }, TIMEOUT)
})
