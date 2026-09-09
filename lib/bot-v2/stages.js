// lib/bot-v2/stages.js — Decide en que etapa de la venta esta la conversacion.
// El codigo decide el stage; el AI solo redacta. Modulo puro (sin imports) para
// poder testearlo aislado: antes vivia dentro de agente.js y no se podia probar.

/* ⚠ AMPLIADOS EL 8 SEP 2026 (BOT v3 · sprint 2) con lo que la traza de 733
   turnos reales demostró que se escapaba: «El básico q cuesta» no era precio;
   «No muy cara muchas gracias» no era objeción —el regex tenía «caro» y no
   «cara»— y se quedó sin respuesta; «No me gusta» iba a post-enlace. Los tres
   leads tenían temperatura 60-65 y ninguno se registró. */
const PRECIOS = /(?:cu[aá]nto|precio|costo|(?:qu[eé] |cu[aá]l (?:es )?(?:el )?)valor|plan(?:es)?|mensual|(?:cuanto|q|que|qu[eé]) (?:vale|cuesta|sale|es el valor)|forma de pago|como (?:se )?paga|cómo (?:se )?paga|mensualidad|tarifa|\b(?:inicial|b[aá]sico|crecimiento|profesional|empresarial)\b)/i

// Objecion real. Evita falsos positivos: "ya tengo 50 clientes" no es objecion.
const OBJECION = /(?:\bcar[oa]s?\b|costos[oa]|no tengo plata|mucha plata|es mucho|muy alto|pensarlo|voy a pensar|no me gusta|no me convence|no me sirve|ya tengo (?:un |otro |mi )?(?:sistema|app|programa|excel|libreta|cuaderno|hoja|aplicaci[oó]n)|ya uso (?:otro|un)|me da miedo|desconfi|no s[eé] usar|dif[ií]cil|pago [uú]nico|un solo pago|no quiero mensual)/i

/* Lo que de verdad es «después del enlace»: un acuse corto. Para eso se escribió
   la etapa POST_LINK —«los ok, los gracias y el silencio»— y solo para eso se
   queda. Cualquier otra cosa que diga el lead con el enlace ya enviado la
   decide su intención, como si el enlace no estuviera. */
const ACUSE_CORTO = /^(?:ok|okey|okay|listo|gracias|muchas gracias|vale|bueno|dale|de una|perfecto|super|s[uú]per|bien|ya|ya vi|entendido|recibido|ah ok|a ok|mil gracias|gracias por la info(?:rmaci[oó]n)?)(?:\s+(?:pues|gracias|listo|ok|vale))?[.!,?\s]*$/i

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

  /* ══ ⚠ EL ENLACE NO DECIDE LA ETAPA. SOLO ATRAPA EL ACUSE CORTO. ═══════════
   *
   * Historia de esta regla, porque se corrigió dos veces y las dos a medias:
   *
   * 1. Era `if (linkEnviado) return 'POST_LINK'` a secas. Mandado el link una
   *    vez, TODO caía en post-enlace, cuyo prompt dice «si no ha hecho nada,
   *    pregunta si se pudo registrar». El chat de Luis: «Más información» → el
   *    pitch y el link; «Cómo funciona» → «¿ya se registró?»; «No me has dicho
   *    nada» → el pitch y el link; «Yo no estoy pidiendo registro». Medido:
   *    65 de 510 conversaciones (12,7 %) con una pregunta tragada.
   *
   * 2. Se añadió la excepción `preguntaDeVerdad`: si empieza por qué/cómo o
   *    lleva «?», se contesta. Y AUN ASÍ, sobre 733 turnos reales trazados el
   *    8 sep 2026, **129 turnos** siguieron cayendo aquí: «No me gusta», «Y los
   *    siguientes días», «El básico q cuesta», «llevo de 600 a mil clientes»
   *    (ese es de hoy) → «¿ya pudo entrar a probar los 14 días?». Tres
   *    auditorías externas coincidieron: el enlace enviado es un dato del
   *    historial, no la intención del lead.
   *
   * Ahora: con el enlace enviado, SOLO el acuse corto —«ok», «gracias»,
   * «listo»— va a POST_LINK, que es para lo que esa etapa se escribió. Todo lo
   * demás lo decide la intención del mensaje, como si el enlace no estuviera;
   * el prompt de VALOR sabe que el enlace ya se mandó y no lo repite. */
  if (linkEnviado && ACUSE_CORTO.test(crudo)) return 'POST_LINK'

  const preguntaDeVerdad = PREGUNTA.test(crudo) || crudo.includes('?')
    || PIDE_EXPLICACION.test(texto) || RUEGO_SOLO.test(crudo) || TODAS_LAS_DUDAS.test(crudo)

  // Con datos del formulario de Facebook nos saltamos DESCUBRIMIENTO.
  const tieneContextoFB = Boolean(lead?.metodoActual || lead?.cantClientes)

  /* Señal de compra EXPLÍCITA -> cerrar ya, sin importar en qué punto vamos.
     Esto es lo que está MEDIDO que funciona («quiero probarlo», «mándeme el
     link»): cuando el lead lo pide, se le da, sin vueltas.
     ⚠ PERO NO SI ACABA DE PREGUNTAR ALGO. «Claro» a secas es una confirmacion;
     «Claro, y como funciona?» no. Luis escribio «Claro» queriendo decir «claro
     que no me has dicho nada», y con la confirmacion por delante se leia como
     un si. Si hay pregunta en el mismo mensaje, manda la pregunta. */
  if (!preguntaDeVerdad && SENAL_COMPRA.test(texto)) return 'CIERRE'

  /* ══ ⚠ UN «SÍ» A UNA PREGUNTA DE DESCUBRIMIENTO NO ES SEÑAL DE COMPRA ══════
   *
   * Antes, cualquier confirmación corta («si», «claro», «dale», «listo») saltaba
   * a CIERRE desde el primer turno. Resultado medido por la autocrítica:
   *
   *   Bot: «Sabe exactamente cuánto le deben en total hoy?»  →  Lead: «Si»
   *   Bot: «Perfecto, aquí se registra en 2 minutos: <link>»  ← sin explorar nada
   *
   * El lead contestó UNA pregunta de diagnóstico y el bot le metió el link en la
   * cara. Tres lecciones con cita del 24 y 25-ago lo marcan. El lead que dice
   * «si» a «¿sabe cuánto le deben?» está respondiendo la pregunta, no comprando.
   *
   * La confirmación corta solo cierra cuando el bot YA ofreció la prueba (su
   * último mensaje la menciona) o cuando la conversación ya pasó por valor
   * (>= 5 mensajes: hubo descubrimiento y valor antes). Una señal de compra
   * EXPLÍCITA («quiero probarlo») sigue cerrando de una, arriba. */
  const ultimoBot = [...(historial || [])].reverse().find(m => m.rol === 'bot')?.texto || ''
  const botOfrecioPrueba = /registr|prueba gratis|d[ií]as gratis|link|probar(?:lo)?\s+sin/.test(ultimoBot)

  /* ⚠ Y ADEMÁS, EL LEAD TIENE QUE HABER CONTADO ALGO.
   *
   * El pitch fijo que abre la conversación menciona la prueba y el registro, o
   * sea que `botOfrecioPrueba` es cierto desde el SEGUNDO mensaje. Con eso, un
   * «sí» al pitch se llevaba el enlace de una, sin que el lead hubiera dicho
   * cuántos clientes tiene ni cómo cobra. El dueño, viéndolo el 8 sep: «contesta
   * preguntas, no incita, no vende».
   *
   * Un «sí» al pitch quiere decir «cuénteme», no «deme el enlace». Y lo que
   * está medido es que preguntar por el dolor convierte 9,4 veces más que
   * cerrar de una (test A/B de julio, 194 leads). Así que se cierra cuando el
   * lead ya puso algo suyo encima de la mesa. */
  const leadContoAlgo = (historial || []).some(
    (m) => m?.rol === 'lead' && String(m.texto || '').trim().split(/\s+/).length >= 2
      && !CONFIRMACION_CORTA.test(String(m.texto || '').trim()))
  /* Y si el bot PREGUNTÓ derecho si le manda el enlace, el «sí» es un sí: no
     hay nada que descubrir después de eso. Caso real Lead-34: «¿Quiere que le
     mande el link?» → «Si». */
  const botPidioCierre = /(?:mand|env[ií])\w*\s+(?:el\s+|un\s+)?(?:link|enlace)|\b(?:lo|la) prueba\b|\bempezamos\b|\bse lo (?:mando|env[ií]o)\b/i.test(ultimoBot)
  if (!preguntaDeVerdad && CONFIRMACION_CORTA.test(crudo)
      && ((botOfrecioPrueba && (leadContoAlgo || botPidioCierre)) || counts.total >= 5)) {
    return 'CIERRE'
  }

  // Etapa temprana. Con el enlace ya enviado, el descubrimiento quedó atrás:
  // lo que diga ahora se contesta con valor, no con otra pregunta de sondeo.
  if (counts.total <= 3) return (tieneContextoFB || linkEnviado) ? 'VALOR' : 'DESCUBRIMIENTO'
  if (counts.total <= 5 && !tieneContextoFB) return 'VALOR'

  /* ══ ⚠ LO QUE NO SE RECONOCE VA A VALOR, NO A CIERRE. ═════════════════════
   * El defecto era CIERRE: un mensaje que ninguna regla entendía significaba
   * «empuja el enlace». Una objeción mal parseada, una frase ambigua, un dato
   * del negocio suelto — todo eso cerraba. Lo señalaron las tres auditorías
   * (8 sep 2026). Cerrar es lo que hay que ganarse con una señal, no lo que
   * pasa cuando el bot no entiende. */
  return 'VALOR'
}

/* ══ LA ETAPA DESDE LA INTENCIÓN (BOT v3 · sprint 3) ═══════════════════════
 *
 * Cuando el clasificador semántico (intencion.js) leyó el mensaje, esto
 * traduce su intención a la etapa. Es puro y va DESPUÉS de las reglas duras
 * del clasificador de texto (rechazo, humano, pago, soporte duro, tutoriales),
 * que no admiten ambigüedad y no gastan modelo.
 *
 * Devuelve null cuando la intención no merece confianza o no dice nada útil:
 * entonces decide `detectarStage` de siempre. Y devuelve `{ escalar }` cuando
 * el modelo vio soporte/humano/rechazo donde el regex no lo vio (el caso «no
 * pude iniciar»): el agente lo trata como si el clasificador lo hubiera dicho.
 */
export const CONFIANZA_MINIMA = 0.7

export function etapaDesdeIntencion(intencion, { historial = [], yaRegistrado = false, lead = {} } = {}) {
  if (!intencion || intencion.confianza < CONFIANZA_MINIMA) return null
  const counts = contarMensajes(historial)
  const ultimoBot = [...(historial || [])].reverse().find(m => m.rol === 'bot')?.texto || ''
  const botOfrecioPrueba = /registr|prueba gratis|d[ií]as gratis|link|probar(?:lo)?\s+sin/i.test(ultimoBot)
  /* El pitch de apertura ya menciona la prueba, así que sin esto un «sí» al
     segundo mensaje se llevaba el enlace sin que el lead contara nada. */
  const leadContoAlgo = (historial || []).some(
    (m) => m?.rol === 'lead' && String(m.texto || '').trim().split(/\s+/).length >= 2
      && !CONFIRMACION_CORTA.test(String(m.texto || '').trim()))
  /* Y si el bot PREGUNTÓ derecho si le manda el enlace, el «sí» es un sí: no
     hay nada que descubrir después de eso. Caso real Lead-34: «¿Quiere que le
     mande el link?» → «Si». */
  const botPidioCierre = /(?:mand|env[ií])\w*\s+(?:el\s+|un\s+)?(?:link|enlace)|\b(?:lo|la) prueba\b|\bempezamos\b|\bse lo (?:mando|env[ií]o)\b/i.test(ultimoBot)
  const tieneContextoFB = Boolean(lead?.metodoActual || lead?.cantClientes)
  const linkEnviado = (historial || []).some(m => m.rol === 'bot' && /app\.control-finanzas\.com\/registro/.test(m.texto || ''))

  switch (intencion.intencion) {
    case 'soporte':   return { escalar: yaRegistrado ? 'soporte_registrado' : 'soporte' }
    case 'humano':    return { escalar: 'pide_humano' }
    /* ⚠ EL RECHAZO NO LO DECIDE LA SEMÁNTICA. Medido el 8 sep sobre 80 turnos
       reales: el modelo marcó «No» a secas y «No me gusta» como rechazo con
       0,95. El rechazo apaga los seguimientos y reporta a Meta como no
       cualificado: irreversible en la práctica. Solo el regex del clasificador
       («no me interesa», «no me escriba») puede disparar eso; lo que el modelo
       lee como rechazo se trata como objeción, que es conversar. */
    case 'rechazo':   return { etapa: 'OBJECION' }
    /* «Estoy mirando el tutorial» salió como tutoriales 0,90: mandarle la
       lista a quien ya la está viendo es no haber leído. Solo con mucha
       confianza, y el prompt ya avisa. */
    case 'tutoriales': return intencion.confianza >= 0.9 ? { tutoriales: yaRegistrado ? 'registrado' : 'lead' } : { etapa: 'VALOR' }
    case 'precio':    return { etapa: 'PRECIOS' }
    case 'objecion':  return { etapa: 'OBJECION' }
    case 'compra':    return { etapa: yaRegistrado ? 'POST_LINK' : 'CIERRE' }
    case 'confirmacion':
      if (yaRegistrado) return { etapa: 'POST_LINK' }
      /* Igual que en el árbol: un «sí» solo cierra si el lead ya contó algo.
         Si no, es «cuénteme» y toca preguntarle por su negocio. */
      return { etapa: ((botOfrecioPrueba && (leadContoAlgo || botPidioCierre)) || intencion.intencionCompra >= 70) ? 'CIERRE' : (leadContoAlgo ? 'VALOR' : 'DESCUBRIMIENTO') }
    case 'saludo':    return { etapa: counts.bot === 0 ? 'SALUDO' : 'VALOR' }
    case 'dato_negocio':
    case 'pregunta_producto':
    case 'aclaracion':
    case 'otro':
      if (yaRegistrado) return { etapa: 'POST_LINK' }
      // Con el enlace enviado el descubrimiento quedó atrás (misma regla que el árbol).
      if (counts.total <= 3 && !tieneContextoFB && !linkEnviado && intencion.intencion === 'dato_negocio') return { etapa: 'DESCUBRIMIENTO' }
      return { etapa: 'VALOR' }
    default: return null
  }
}
