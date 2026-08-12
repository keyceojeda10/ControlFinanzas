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

/* PIDE EXPLICACION SIN SIGNO DE PREGUNTA. Ninguna de estas empieza por «que» ni
   lleva «?», y todas son la misma peticion: explicame. Salen textuales de los
   chats: «Mas informacion», «Por favor», «No me has dicho nada», «Todas [las
   dudas]», «No entiendo», «Y ya».

   ⚠ Son las que mas duelen porque el lead ya se esta quejando de que no le han
   contestado, y con la regla vieja caian en POST_LINK — donde el bot le
   preguntaba si ya se habia registrado. */
const PIDE_EXPLICACION = /m[aá]s informaci|mas info|no me has dicho|no me ha dicho|no entiendo|no comprendo|explic|de qu[eé] se trata|en qu[eé] consiste|no me queda claro|tengo dudas|unas dudas|todas las dudas|amplia|detalle/i

/* Dos formas de pedir explicación que la lista de arriba NO caza, y las dos
   salen del chat de Luis. Van aparte porque dependen de DÓNDE están:

   · «Por favor» SOLO. Luis escribió «Mas información» y en el mensaje siguiente
     «Por favor»: es la misma petición partida en dos. Suelto es un ruego de que
     sigas; dentro de una frase («por favor mándeme el link») no, y por eso se
     exige que sea el mensaje entero.
   · «Todas…» AL PRINCIPIO. Es la respuesta a «¿qué dudas tiene?» — la señal de
     compra más fuerte que puede dar alguien, y el bot se despidió. Anclado al
     inicio para no cazar «todas las funciones me sirven». */
const RUEGO_SOLO = /^(?:por favor|porfa|porfis|porfavor|dale pues)[.!,\s]*$/i
const TODAS_LAS_DUDAS = /^todas\b/i

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

  /* ══ ⚠ UNA PREGUNTA GANA AL LINK ══════════════════════════════════════════
   *
   * Aqui estaba el fallo que el dueño describio como «le falta viveza». Esto
   * era `if (linkEnviado) return 'POST_LINK'` a secas, ANTES de mirar lo que el
   * lead acababa de escribir. Osea: mandado el link una vez, TODO lo que dijera
   * el lead caia en POST_LINK, cuyo prompt dice «si no ha hecho nada, pregunta
   * si se pudo registrar».
   *
   * El chat de Luis, entero, despues del link (08:52):
   *
   *   «Mas informacion»          -> POST_LINK -> el mismo pitch y el link
   *   «Como funciona»            -> POST_LINK -> «ya se registro o tiene dudas?»
   *   «No me has dicho nada»     -> POST_LINK -> el mismo pitch y el link
   *   «Yo no estoy pidiendo registro»
   *
   * Cuatro links en diez minutos y el lead diciendolo en la cara. No era el
   * modelo redactando mal: era el codigo mandandolo a la etapa equivocada.
   *
   * Medido sobre 510 conversaciones reales de 45 dias: **65 (12,7%) tienen al
   * menos una pregunta tragada asi, 113 preguntas en total**.
   *
   * Ahora una pregunta de verdad se contesta, se haya mandado el link o no. Lo
   * que sigue yendo a POST_LINK es lo que NO es pregunta: los «ok», los
   * «gracias» y el silencio, que es para lo que se escribio esa etapa. */
  const preguntaDeVerdad = PREGUNTA.test(crudo) || crudo.includes('?')
    || PIDE_EXPLICACION.test(texto) || RUEGO_SOLO.test(crudo) || TODAS_LAS_DUDAS.test(crudo)

  if (linkEnviado && !preguntaDeVerdad) return 'POST_LINK'

  // Con datos del formulario de Facebook nos saltamos DESCUBRIMIENTO.
  const tieneContextoFB = Boolean(lead?.metodoActual || lead?.cantClientes)

  /* Señal de compra explicita -> cerrar ya, sin importar en que punto vamos.
     ⚠ PERO NO SI ACABA DE PREGUNTAR ALGO. «Claro» a secas es una confirmacion;
     «Claro, y como funciona?» no. Luis escribio «Claro» queriendo decir «claro
     que no me has dicho nada», y con la confirmacion por delante se leia como
     un si. Si hay pregunta en el mismo mensaje, manda la pregunta. */
  if (!preguntaDeVerdad && (CONFIRMACION_CORTA.test(crudo) || SENAL_COMPRA.test(texto))) return 'CIERRE'

  // Etapa temprana.
  if (counts.total <= 3) return tieneContextoFB ? 'VALOR' : 'DESCUBRIMIENTO'
  if (counts.total <= 5 && !tieneContextoFB) return 'VALOR'

  // El lead sigue preguntando y no ha dado señal de compra: responderle
  // aportando valor. Antes TODO caia a CIERRE por defecto, asi que el bot
  // atropellaba la pregunta empujando el link en vez de contestar.
  if (PREGUNTA.test(crudo) || crudo.includes('?')) return 'VALOR'

  return 'CIERRE'
}
