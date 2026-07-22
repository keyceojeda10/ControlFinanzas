// scripts/compare-models.cjs — Comparación A/B: deepseek-chat vs deepseek-v4-pro
// Corre los mismos escenarios del bot de ventas con ambos modelos y compara resultados.
// Uso: node scripts/compare-models.cjs

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

if (!DEEPSEEK_API_KEY) {
  console.error('Falta DEEPSEEK_API_KEY en el entorno.')
  process.exit(1)
}

const MODELS = ['deepseek-v4-pro']

const TOOL_RESPONDER = {
  type: 'function',
  function: {
    name: 'responder_lead',
    description: 'Entrega la respuesta del agente para el prospecto de Control Finanzas.',
    parameters: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', description: 'El texto que se le enviara al prospecto por WhatsApp.' },
        temperatura: { type: 'integer', description: 'Que tan caliente esta el lead, de 0 a 100.' },
        escalar: { type: 'boolean', description: 'true si hay que pasar el lead a un humano.' },
        motivo: { type: 'string', description: 'Si escalar es true, una frase explicando por que.' },
        enviarGuia: { type: 'string', description: 'Slug de una guia visual a enviar. Dejar vacio si no se va a enviar ninguna.' },
      },
      required: ['mensaje', 'temperatura', 'escalar', 'motivo'],
    },
  },
}

const SYSTEM_PROMPT = `Eres el agente de ventas de Control Finanzas por WhatsApp. Hablas con prestamistas colombianos que llegaron por Facebook.

Tu objetivo: que el lead se registre y pruebe 14 dias gratis.

## IDENTIDAD
En tu PRIMER mensaje de la conversacion, di "Soy el asistente de Control Finanzas". Despues no lo repitas.

Si preguntan si eres robot/bot/persona: di que eres el asistente virtual, que puedes darle toda la info, y que si prefiere hablar con alguien del equipo le pasas el numero. NO escales por esto, sigue la conversacion.

## TONO
- WhatsApp colombiano real. Usted amable. Si te tutean, tutea.
- Maximo 2-4 lineas por mensaje. Una idea por mensaje.
- Separa ideas con doble salto de linea. NUNCA listas, negritas ni markdown.
- Ortografia perfecta: tildes y enes siempre.
- NO uses emojis decorativos (flores, corazones, estrellas, brillos). Es mejor sin ninguno.
- Si el lead usa expresiones coloquiales ("de una", "hagale", "dele"), puedes responder en el mismo tono.

## EXPRESIONES COLOMBIANAS (NO son rechazo)
"No si quiero", "No pues si", "De una", "Hagale", "Dele", "Listo", "Va" = SI quiere.
Solo es rechazo real: "no me interesa", "no gracias", "dejeme en paz", "no llame mas".

## STAGES — SIGUE EL ORDEN, NO TE SALTES

SALUDO (primer mensaje):
- Saluda segun la hora. Identifica que eres el asistente.
- Reconoce datos del formulario sin preguntarlos.
- Cierra con UNA pregunta sobre su negocio.
- PROHIBIDO mencionar precios o planes en este stage.

DESCUBRIMIENTO (mensajes 2-3):
- Haz UNA pregunta para entender su dolor. NO respondas con funciones todavia.

VALOR (mensajes 4-5):
- Conecta UNA funcion real con SU dolor especifico.

CIERRE (cuando el lead esta caliente):
- "14 dias gratis, sin tarjeta. Quiere que le mande el link?"

## PRECIOS — responde DIRECTO cuando pregunten
- Inicial: $39.000/mes (150 clientes, 1 ruta, 1 usuario)
- Basico: $59.000/mes (450 clientes, 1 ruta, 1 usuario)
- Crecimiento: $79.000/mes (1.000 clientes, 3 rutas, 2 usuarios)
- Profesional: $119.000/mes (2.000 clientes, 6 rutas, 5 usuarios)
- Empresarial: $259.000/mes (10.000 clientes, 10 rutas, 10 usuarios)

RECOMENDAR PLAN segun cantidad de clientes:
- Menos de 50: Inicial ($39k)
- Entre 50-100: Basico ($59k)
- Mas de 100: Crecimiento ($79k) o Profesional ($119k)
Siempre di el precio y luego ofrece la prueba gratis.

## OBJECIONES
- "Esta caro" -> PRIMERO: "El plan Inicial son solo $39.000 al mes." SEGUNDO: "Puede probarlo 14 dias gratis sin pagar nada."
- "Lo voy a pensar" -> Ofrece video.
- "Ya tengo libreta/Excel" -> "Sabe cuanto cobro cada cobrador hoy?"
- "No se usarlo" -> "Si sabe usar WhatsApp sabe usar esto."

## ESCALAMIENTO — REGLA CRITICA

Cuando marcas escalar=true, tu mensaje DEBE incluir AMBAS cosas:
1. "Ya le paso su caso a nuestro equipo."
2. "Puede escribir directo al 301 199 3001, lo atienden de 7am a 10pm."

SITUACIONES QUE OBLIGAN escalar=true:
- "como pago", "quiero pagar", "activar plan", "se me acabo", "se me vencio", "quiero seguir", "renovar" -> escalar=true SIN EXCEPCION. NO intentes cobrar, SOLO escala.
- Problema tecnico -> solo escala.
- Pide hablar con persona -> escala.

## TEMPERATURA (0-100)
0-20: frio. 21-40: tibio. 41-60: interesado. 61-80: caliente. 81-100: listo.
"dale", "de una", "hagale" = 75+. Pregunta de precio = minimo 50.

## PROHIBIDO
- Inventar testimonios, cifras, funciones, descuentos, cupones.
- Dar pasos tecnicos de soporte.
- Decir 15 dias (son 14).
- Emojis decorativos.

Usa SIEMPRE la herramienta "responder_lead". Nunca texto suelto.

DATOS: Registro https://app.control-finanzas.com/registro?r=2 | Soporte 301 199 3001 (7am-10pm)`

// Escenarios de prueba que cubren distintos stages y situaciones del bot
const SCENARIOS = [
  {
    name: '1. Primer contacto (saludo)',
    context: `Datos del prospecto:
- Nombre: Carlos Mendez
- Clientes que maneja: entre 20 y 50
- Metodo actual: libreta
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 10:30 — es de mañana (buenos días)

IMPORTANTE: YA SABES del formulario que usa "libreta" y maneja "entre 20 y 50" clientes. NO le preguntes eso, ya lo sabes.

Stage actual: SALUDO | Mensajes: bot=0 lead=0`,
    messages: [
      { role: 'user', content: 'Buenos dias, vi el anuncio en Facebook' },
    ],
    criteria: ['Se identifica como asistente/bot', 'Saludo apropiado (buenos dias)', 'No pregunta datos que ya tiene', 'Corto (2-4 lineas)', 'Natural, no robotico'],
  },
  {
    name: '2. Pregunta de precio',
    context: `Datos del prospecto:
- Nombre: Maria Lopez
- Clientes que maneja: más de 100
- Metodo actual: Excel
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 14:00 — es de tarde (buenas tardes)

Stage actual: VALOR | Mensajes: bot=2 lead=2`,
    messages: [
      { role: 'user', content: 'Buenas tardes, estoy interesada' },
      { role: 'assistant', content: 'Buenas tardes, María. Soy el asistente de Control Finanzas.\n\nVi que maneja más de 100 clientes con Excel. ¿Cómo le va con eso?' },
      { role: 'user', content: 'Bien pero a veces se me pierden datos. Cuánto cuesta?' },
    ],
    criteria: ['Responde precio PRIMERO', 'Menciona plan relevante (Crecimiento o Profesional por 100+ clientes)', 'Conecta con su dolor (datos perdidos)', 'Ofrece prueba gratis', 'No inventa funciones'],
  },
  {
    name: '3. Objecion "esta caro"',
    context: `Datos del prospecto:
- Nombre: Pedro Ramirez
- Clientes que maneja: menos de 20
- Metodo actual: cuaderno
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 19:30 — es de noche (buenas noches)

Stage actual: CIERRE | Mensajes: bot=3 lead=3`,
    messages: [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Buenas noches, Pedro. Soy el asistente de Control Finanzas.\n\nVi que maneja sus préstamos con cuaderno. ¿Cómo lleva el control de quién le debe y cuánto?' },
      { role: 'user', content: 'Pues ahi mas o menos, a veces se me olvida cobrar' },
      { role: 'assistant', content: 'Eso pasa mucho con el cuaderno. Control Finanzas le marca automáticamente quién está en mora, así no se le pasa ningún cobro.\n\n¿Quiere probarlo 14 días gratis?' },
      { role: 'user', content: 'mmm cuanto vale? es que eso seguro es caro' },
    ],
    criteria: ['Menciona plan Inicial ($39.000)', 'Maneja objecion sin ser agresivo', 'Ofrece prueba gratis sin costo', 'No presiona demasiado', 'Maximo 3-4 lineas'],
  },
  {
    name: '4. Lead acepta registrarse ("de una")',
    context: `Datos del prospecto:
- Nombre: Andres Gutierrez
- Clientes que maneja: entre 50 y 100
- Metodo actual: otro sistema
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 11:00 — es de mañana (buenos días)

Stage actual: CIERRE | Mensajes: bot=2 lead=2`,
    messages: [
      { role: 'user', content: 'Buenos dias, me interesa' },
      { role: 'assistant', content: 'Buenos días, Andrés. Soy el asistente de Control Finanzas.\n\nVi que ya usa otro sistema. ¿Qué es lo que más le gustaría mejorar?' },
      { role: 'user', content: 'de una, hagale, mandeme el link' },
    ],
    criteria: ['Entiende "de una/hagale" como ACEPTACION (no rechazo)', 'Envia link de registro', 'Temperatura alta (75+)', 'Mensaje corto y directo', 'No repite pitch innecesario'],
  },
  {
    name: '5. Escalamiento (quiere pagar)',
    context: `Datos del prospecto:
- Nombre: Sandra Perez
- Clientes que maneja: entre 20 y 50
- Metodo actual: Excel
- Estado de registro: registrado_demo_basic
- Hora Colombia: 2026-07-07 09:00 — es de mañana (buenos días)

Stage actual: POST_LINK | Mensajes: bot=4 lead=4`,
    messages: [
      { role: 'user', content: 'Hola, ya me registré y me gustó mucho' },
      { role: 'assistant', content: 'Qué bueno, Sandra. Me alegra que le haya gustado. ¿Tiene alguna duda sobre el sistema?' },
      { role: 'user', content: 'si, como hago para pagar? se me acaba la prueba pronto' },
    ],
    criteria: ['escalar=true OBLIGATORIO', 'Incluye numero de soporte (301 199 3001)', 'Incluye horario (7am a 10pm)', 'NO intenta cobrar', 'Temperatura alta'],
  },
  {
    name: '6. "Eres un robot?"',
    context: `Datos del prospecto:
- Nombre: Juan Torres
- Clientes que maneja: no especificado
- Metodo actual: no especificado
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 15:00 — es de tarde (buenas tardes)

Stage actual: SALUDO | Mensajes: bot=1 lead=1`,
    messages: [
      { role: 'user', content: 'Buenas' },
      { role: 'assistant', content: 'Buenas tardes, Juan. Soy el asistente de Control Finanzas.\n\n¿Ya maneja préstamos o está pensando en arrancar?' },
      { role: 'user', content: 'estoy hablando con una persona o con un robot?' },
    ],
    criteria: ['Admite que es asistente virtual', 'NO escala (escalar=false)', 'Ofrece numero de soporte si quiere hablar con persona', 'Tono natural, no defensivo', 'Continua la conversacion'],
  },
  {
    name: '7. Lead dice 15 dias (debe corregir a 14)',
    context: `Datos del prospecto:
- Nombre: Rosa Martinez
- Clientes que maneja: entre 20 y 50
- Metodo actual: libreta
- Estado de registro: no_registrado
- Hora Colombia: 2026-07-07 16:00 — es de tarde (buenas tardes)

Stage actual: DESCUBRIMIENTO | Mensajes: bot=1 lead=1`,
    messages: [
      { role: 'user', content: 'Me dijeron que hay 15 dias de prueba gratis cierto?' },
    ],
    criteria: ['Corrige a 14 dias (no 15)', 'Confirma que es gratis', 'Aprovecha interes para avanzar al cierre', 'No es condescendiente con la correccion'],
  },
]

async function callModel(model, systemPrompt, messages) {
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  const start = Date.now()
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: allMessages,
      tools: [TOOL_RESPONDER],
      tool_choice: { type: 'function', function: { name: 'responder_lead' } },
      ...(model === 'deepseek-v4-pro' ? { thinking: { type: 'disabled' } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  })

  const latency = Date.now() - start

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { error: `HTTP ${res.status}: ${body.slice(0, 300)}`, latency }
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]
  const usage = data.usage || {}

  let parsed = null
  if (toolCall?.function?.arguments) {
    try {
      parsed = JSON.parse(toolCall.function.arguments)
    } catch (e) {
      return { error: `JSON parse error: ${e.message}`, latency, usage }
    }
  }

  return { parsed, rawText: choice?.message?.content || '', usage, latency }
}

function truncate(s, max) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '...' : s
}

async function runComparison() {
  console.log('='.repeat(80))
  console.log('  COMPARACION A/B: deepseek-chat (V3) vs deepseek-v4-pro (V4)')
  console.log('  Bot de ventas WhatsApp — Control Finanzas')
  console.log('  ' + new Date().toISOString())
  console.log('='.repeat(80))

  const results = []

  for (const scenario of SCENARIOS) {
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`  ESCENARIO: ${scenario.name}`)
    console.log(`  Ultimo mensaje lead: "${truncate(scenario.messages[scenario.messages.length - 1].content, 60)}"`)
    console.log(`  Criterios: ${scenario.criteria.join(' | ')}`)
    console.log(`${'─'.repeat(80)}`)

    const fullMessages = [
      { role: 'user', content: scenario.context + '\n\n(Inicio de la conversacion)' },
      ...scenario.messages,
    ]

    const modelResults = {}

    for (const model of MODELS) {
      process.stdout.write(`  [${model}] llamando... `)
      const result = await callModel(model, SYSTEM_PROMPT, fullMessages)

      if (result.error) {
        console.log(`ERROR: ${result.error}`)
        modelResults[model] = { error: result.error, latency: result.latency }
        continue
      }

      const p = result.parsed
      console.log(`OK (${result.latency}ms, ${result.usage.prompt_tokens || '?'}in/${result.usage.completion_tokens || '?'}out)`)

      modelResults[model] = {
        mensaje: p?.mensaje || result.rawText || '(vacio)',
        temperatura: p?.temperatura,
        escalar: p?.escalar,
        motivo: p?.motivo || '',
        enviarGuia: p?.enviarGuia || '',
        latency: result.latency,
        tokensIn: result.usage.prompt_tokens || 0,
        tokensOut: result.usage.completion_tokens || 0,
      }
    }

    // Print side by side
    for (const model of MODELS) {
      const r = modelResults[model]
      const label = model === 'deepseek-chat' ? 'V3 (deepseek-chat)' : 'V4 (deepseek-v4-pro)'
      console.log(`\n  ┌─ ${label} ─ ${r.latency}ms`)
      if (r.error) {
        console.log(`  │ ERROR: ${r.error}`)
      } else {
        const lines = r.mensaje.split('\n')
        for (const line of lines) {
          console.log(`  │ ${line}`)
        }
        console.log(`  │`)
        console.log(`  │ temp=${r.temperatura} escalar=${r.escalar} motivo="${truncate(r.motivo, 50)}"`)
        if (r.enviarGuia) console.log(`  │ guia="${r.enviarGuia}"`)
        console.log(`  │ tokens: ${r.tokensIn} in / ${r.tokensOut} out`)
      }
      console.log(`  └${'─'.repeat(60)}`)
    }

    results.push({ scenario: scenario.name, criteria: scenario.criteria, models: modelResults })
  }

  // Summary table
  console.log(`\n${'='.repeat(80)}`)
  console.log('  RESUMEN')
  console.log(`${'='.repeat(80)}`)

  let totalLatencyV3 = 0, totalLatencyV4 = 0
  let totalTokensInV3 = 0, totalTokensInV4 = 0
  let totalTokensOutV3 = 0, totalTokensOutV4 = 0
  let errorsV3 = 0, errorsV4 = 0

  for (const r of results) {
    const v3 = r.models['deepseek-chat']
    const v4 = r.models['deepseek-v4-pro']

    if (v3?.error) errorsV3++
    else {
      totalLatencyV3 += v3.latency || 0
      totalTokensInV3 += v3.tokensIn || 0
      totalTokensOutV3 += v3.tokensOut || 0
    }

    if (v4?.error) errorsV4++
    else {
      totalLatencyV4 += v4.latency || 0
      totalTokensInV4 += v4.tokensIn || 0
      totalTokensOutV4 += v4.tokensOut || 0
    }
  }

  const n = results.length
  const successV3 = n - errorsV3
  const successV4 = n - errorsV4

  console.log(`\n  deepseek-chat (V3):`)
  console.log(`    Exitosos: ${successV3}/${n}`)
  console.log(`    Latencia promedio: ${successV3 ? Math.round(totalLatencyV3 / successV3) : 'N/A'}ms`)
  console.log(`    Tokens promedio: ${successV3 ? Math.round(totalTokensInV3 / successV3) : 'N/A'} in / ${successV3 ? Math.round(totalTokensOutV3 / successV3) : 'N/A'} out`)

  console.log(`\n  deepseek-v4-pro (V4):`)
  console.log(`    Exitosos: ${successV4}/${n}`)
  console.log(`    Latencia promedio: ${successV4 ? Math.round(totalLatencyV4 / successV4) : 'N/A'}ms`)
  console.log(`    Tokens promedio: ${successV4 ? Math.round(totalTokensInV4 / successV4) : 'N/A'} in / ${successV4 ? Math.round(totalTokensOutV4 / successV4) : 'N/A'} out`)

  if (successV3 && successV4) {
    const avgV3 = totalLatencyV3 / successV3
    const avgV4 = totalLatencyV4 / successV4
    const diff = ((avgV4 - avgV3) / avgV3 * 100).toFixed(1)
    console.log(`\n  Diferencia latencia: V4 es ${diff > 0 ? diff + '% mas lento' : Math.abs(diff) + '% mas rapido'} que V3`)
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('  Revisa las respuestas arriba para comparar calidad.')
  console.log('  Criterios clave: naturalidad, precision, manejo de colombianismos,')
  console.log('  seguimiento de reglas (14 dias, escalar pagos, no inventar).')
  console.log(`${'='.repeat(80)}`)
}

runComparison().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
