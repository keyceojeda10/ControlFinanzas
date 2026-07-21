// lib/bot-v2/stages.js — Decide en que etapa de la venta esta la conversacion.
// El codigo decide el stage; el AI solo redacta. Modulo puro (sin imports) para
// poder testearlo aislado: antes vivia dentro de agente.js y no se podia probar.

const PRECIOS = /(?:cu[aá]nto|precio|costo|(?:qu[eé] |cu[aá]l (?:es )?(?:el )?)valor|plan(?:es)?|mensual|cuanto (?:vale|cuesta|sale)|forma de pago|como (?:se )?paga|cómo (?:se )?paga)/i

// Objecion real. Evita falsos positivos: "ya tengo 50 clientes" no es objecion.
const OBJECION = /(?:caro|costoso|muy caro|no tengo plata|pensarlo|voy a pensar|ya tengo (?:un |otro |mi )?(?:sistema|app|programa|excel|libreta|cuaderno|hoja|aplicaci[oó]n)|ya uso (?:otro|un)|me da miedo|desconfi|no s[eé] usar|dif[ií]cil|pago [uú]nico|un solo pago|no quiero mensual)/i

export const CONFIRMACION_CORTA = /^(ok|okey|okay|si|sí|claro|listo|dale|de una|hagale|hágale|dele|bien|bueno|super|súper|perfecto|interesante|me interesa|estoy interesado|si claro|claro que si|si señor|sí señor|genial|chevere|chévere)[.!,?\s]*$/i

// Intencion de compra explicita: aqui SI hay que cerrar de una. Mandar el link
// rapido es lo que mejor funciona (medido), asi que esto va antes que todo.
const SENAL_COMPRA = /me interesa|estoy interesado|quiero (?:probar|registrarme|registrar|empezar|arrancar|el link|la prueba)|mand[eé]me|env[ií]eme|p[aá]seme|d[eé]me el link|c[oó]mo me registro|d[oó]nde me registro/i

// El lead esta preguntando algo de verdad (no es un "ok" ni un "dale").
const PREGUNTA = /^(?:qu[eé]|c[oó]mo|cu[aá]l|d[oó]nde|cu[aá]ndo|qui[eé]n|por qu[eé]|para qu[eé]|sirve|funciona|puedo|se puede|tienen?|hay|es posible|acepta|maneja|incluye)\b/i

export function contarMensajes(historial = []) {
  let bot = 0, lead = 0
  for (const m of historial) {
    if (m.rol === 'bot') bot++
    else lead++
  }
  return { bot, lead, total: bot + lead }
}

export function detectarStage(historial, textoEntrante, yaRegistrado, lead) {
  const texto = (textoEntrante || '').toLowerCase()
  const crudo = (textoEntrante || '').trim()
  const counts = contarMensajes(historial)
  const textosBot = (historial || []).filter(m => m.rol === 'bot').map(m => (m.texto || '').toLowerCase()).join(' ')
  const linkEnviado = textosBot.includes('app.control-finanzas.com/registro')

  // Precios primero, para que los registrados tambien puedan ver planes.
  if (PRECIOS.test(texto)) return 'PRECIOS'
  if (OBJECION.test(texto)) return 'OBJECION'
  if (yaRegistrado) return 'POST_LINK'

  // Saludo: solo si el bot todavia no ha dicho nada. Antes la condicion era
  // `counts.lead === 0`, que NUNCA se cumple: el webhook guarda el mensaje
  // entrante antes de llamar, asi que siempre hay >=1 mensaje del lead. El
  // stage SALUDO estaba muerto y los leads organicos entraban directo a VALOR.
  if (counts.bot === 0) return 'SALUDO'

  if (linkEnviado) return 'POST_LINK'

  // Con datos del formulario de Facebook nos saltamos DESCUBRIMIENTO.
  const tieneContextoFB = Boolean(lead?.metodoActual || lead?.cantClientes)

  // Señal de compra explicita -> cerrar ya, sin importar en que punto vamos.
  if (CONFIRMACION_CORTA.test(crudo) || SENAL_COMPRA.test(texto)) return 'CIERRE'

  // Etapa temprana.
  if (counts.total <= 3) return tieneContextoFB ? 'VALOR' : 'DESCUBRIMIENTO'
  if (counts.total <= 5 && !tieneContextoFB) return 'VALOR'

  // El lead sigue preguntando y no ha dado señal de compra: responderle
  // aportando valor. Antes TODO caia a CIERRE por defecto, asi que el bot
  // atropellaba la pregunta empujando el link en vez de contestar.
  if (PREGUNTA.test(crudo) || crudo.includes('?')) return 'VALOR'

  return 'CIERRE'
}
