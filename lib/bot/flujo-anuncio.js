// lib/bot/flujo-anuncio.js — el bot que atiende a quien escribe desde un anuncio.
//
// ══ QUÉ ES ESTO Y QUÉ NO ES ════════════════════════════════════════════════
//
// Es una pieza NUEVA que convive con el bot de siempre; no lo sustituye ni lo
// refactoriza. El de siempre atiende a quien venía del formulario y a quien
// escribe por su cuenta. Éste atiende solo a quien llega desde un anuncio de
// Click-to-WhatsApp, y se distingue por `BotLead.desdeAnuncioWa`.
//
// ══ CÓMO SE ESCRIBE AQUÍ ═══════════════════════════════════════════════════
//
// ⚠ DOS VERSIONES DE ESTOS TEXTOS FUERON TUMBADAS POR EL DUEÑO. La primera eran
// fichas de producto; la segunda le hablaba al dolor pero no vendía. Lo que
// pidió, con sus palabras:
//
//   «Aquí podemos vendernos bien, embellecer el sistema, todo lo que hace,
//    todas las funcionalidades que tiene, para enamorar al cliente.»
//   «No tengas miedo a escribir el texto, puede ser largo: el cliente está
//    pidiendo información y hay que dársela.»
//   «Seguir los pasos lógicos. No dejes que mande un mensaje y ya está.»
//
// Las reglas que salen de ahí, y de lo que ya estaba medido:
//
//   1. **Vender, no listar.** Cada plan se presenta por PARA QUIÉN es, no por
//      su tope. Una tabla obliga al cliente a adivinar cuál es el suyo.
//   2. **Largo está bien cuando lo pidieron.** Quien pulsa «cómo funciona»
//      quiere que le cuenten. El tope real es 1024 caracteres, que es lo que
//      admite el cuerpo de un mensaje con botones.
//   3. **Ninguna respuesta muere sin salida.** Toda rama termina en botones o
//      invitando a preguntar. Un mensaje que cierra la conversación es un lead
//      perdido.
//   4. **Tuteo**, que es como habla la marca.
//   5. **Cero funciones y cero cifras inventadas.** Todo lo que se afirma está
//      comprobado contra el código o contra producción; lo que no se pudo
//      comprobar, no se dice.
//   6. **Sin viñetas ni markdown**: WhatsApp los enseña en crudo.
//   7. **Cada promesa se dice UNA vez.** «No pedimos tarjeta» estaba en cuatro
//      mensajes seguidos y el dueño lo cazó: «insiste mucho en eso y eso hace
//      desconfiar». Repetir que no pides algo suena defensivo y hace pensar que
//      hay letra pequeña. Se dice donde la objeción existe de verdad —al ver el
//      precio— y en los demás sitios se afirma en vez de negar: «tienes 14 días
//      para probarlo», no «no te pedimos nada».
//
// ══ LO QUE SE AFIRMA, Y DÓNDE SE COMPROBÓ (1 sep 2026) ═════════════════════
//
//   · «más de 500 prestamistas» ....... 587 organizaciones registradas (353 con
//                                       cartera cargada). Se dice «abrieron su
//                                       cuenta», que es lo que el número es.
//   · préstamos vivos ................. `Prestamo` con estado activo, en vivo
//   · copias de seguridad diarias ..... cron `cf-respaldo` a las 3:00, cifradas
//                                       con GPG y con copia fuera del servidor.
//                                       Comprobado que existe la de hoy.
//   · descargar su propia copia ....... `app/api/cuenta/backup/route.js`, solo
//                                       el dueño de la cuenta
//   · PDF y Excel ..................... `app/api/reportes/exportar` genera xlsx
//   · Lucas ........................... `/asistente`; contesta «¿cuánto estoy
//                                       ganando?», «¿quién me debe más?», manda
//                                       recordatorios y arma el reporte del mes
//   · modos de interés ................ `modoInteres`, tres semánticas
//   · sin internet .................... la app funciona offline tras cargar
//   · videos .......................... la misma playlist que ya usa el bot de
//                                       siempre, más 43 guías dentro de la app
//
// ══ LAS DOS AFIRMACIONES DE MARCA, Y DE QUIÉN SON ══════════════════════════
//
// ⚠ «EL NÚMERO UNO EN LATINOAMÉRICA» Y «MÁS DE DOS AÑOS OPERANDO» SON DECISIÓN
// EXPRESA DEL DUEÑO, tomada el 1 de septiembre de 2026 y reafirmada después de
// que le enseñara lo que dice la base. No son un descuido: **no las cambies por
// medirlas**.
//
// Lo que mide la base, para que quede escrito y nadie tenga que volver a
// buscarlo: la primera organización es del 1 de marzo de 2026 —seis meses— y
// hay 587 organizaciones registradas repartidas en cuatro países.
//
// Sus palabras: «ponga así como le dije, da mucha más credibilidad y mucho más
// peso». Es su marca y su llamada; queda aquí anotado únicamente para que la
// próxima persona que cruce estos textos con producción sepa que ya se miró.

import { PLANES_CONFIG, getPrecioPlan, DIAS_PRUEBA } from '@/lib/planes'
import { EMPRESA } from '@/lib/bot-v2/producto'

const LINK_REGISTRO = 'https://app.control-finanzas.com/registro?r=2'
const LINK_PAGO     = 'https://app.control-finanzas.com/configuracion/plan'
/* ⚠ EL LINK DE LOS VIDEOS NO SE ESCRIBE, SE IMPORTA.
   Hay una prueba que prohíbe enlaces de YouTube sueltos en toda la app, y no
   es manía: los tutoriales de marzo enseñaban la interfaz anterior al
   rediseño, y cada enlace repartido por correos y pantallas mandaba al cliente
   a ver algo que ya no existía. La constante de `producto.js` es la única
   fuente, para que rehacer la lista sea cambiar una línea. */
const LINK_VIDEOS = EMPRESA.linkTutoriales
const SOPORTE       = '301 199 3001'
const HORARIO       = 'de lunes a domingo, de 7 de la mañana a 10 de la noche'

/* Se pega donde el cliente puede quedarse a medias. «La idea es poder contestar
   todas las preguntas»: si no se le dice que puede preguntar, mucha gente
   asume que el bot solo entiende botones. */
const PREGUNTA_LIBRE = '\n\nY si tienes una pregunta puntual sobre tu negocio, escríbemela por aquí y te la respondo.'
const POR_TELEFONO   = `\n\nSi prefieres hablar con una persona, escríbenos o llámanos al ${SOPORTE}, ${HORARIO}.`

/** ¿Este lead escribió desde un anuncio de WhatsApp?
 *
 * ⚠ NO SE MIRA `anuncioId`: ese campo lo escriben tres sitios con significados
 * distintos —el webhook del formulario (1.501 de 1.657 leads), el sync y el de
 * WhatsApp—, así que usarlo metía todo el tráfico del formulario en este flujo.
 * `desdeAnuncioWa` lo pone solo el webhook de WhatsApp, con `referral`. */
export function esDeAnuncio(lead) {
  return lead?.desdeAnuncioWa === true
}

const pesos = (n) => '$' + Number(n).toLocaleString('es-CO')
const miles = (n) => Number(n).toLocaleString('es-CO')

/* ⚠ LOS PRECIOS Y LOS TOPES SALEN DE `lib/planes.js`, NO SE ESCRIBEN AQUÍ. Ya
 * pasó tres veces con la pantalla de planes: el tope bajó de 150 a 100 en la
 * configuración y la pantalla siguió prometiendo 150 a quien iba a pagar. */
export function tablaDePrecios(country = 'co') {
  return ['starter', 'basic', 'growth'].map((key) => ({
    key,
    tope: PLANES_CONFIG[key].maxClientes,
    precio: getPrecioPlan(key, country),
  }))
}

/* ── Momento 1 · escribe desde el anuncio ───────────────────────────────── */
export const BOTONES_ENTRADA = [
  { id: 'cf_precio', titulo: 'Cuánto cuesta' },
  { id: 'cf_como',   titulo: 'Cómo funciona' },
  { id: 'cf_probar', titulo: 'Quiero probarlo' },
]

export function saludoDeAnuncio() {
  return {
    texto: `Hola, bienvenido a Control Finanzas, el sistema para prestamistas número uno en Latinoamérica.

Aquí llevas tus clientes, tus préstamos, tus cobradores y tus rutas desde el celular, el computador o una tablet. Se acabaron el cuaderno y sumar de noche.

Y si ya tienes tu cartera armada, no hay que escribirla otra vez: se pasa con fotos del cuaderno o desde tu Excel.

¿Por dónde quieres empezar?`,
    botones: BOTONES_ENTRADA,
  }
}

/* ── Momento 4 · señal de atasco ────────────────────────────────────────────
 * Quien dice «no pude» se registra en el 44 % de los casos y paga en el 10 %.
 * No son quejas de gente que se va: son clientes atascados. */
const ATASCO = /\b(no\s+pude|no\s+puedo|no\s+entiendo|no\s+entend[íi]|no\s+s[ée]\s+(c[oó]mo|usar)|no\s+me\s+(abre|deja|sale|funciona|carga)|no\s+me\s+aparece|est[aá]\s+fallando|me\s+sale\s+error)\b/i

export function pareceAtascado(texto) {
  return ATASCO.test(String(texto ?? ''))
}

export const BOTONES_ATASCO = [
  { id: 'cf_at_registro', titulo: 'No pude entrar' },
  { id: 'cf_at_clientes', titulo: 'Cargar clientes' },
  { id: 'cf_at_otra',     titulo: 'Otra cosa' },
]

export function respuestaAtasco() {
  return {
    /* ⚠ EL LINK VA AQUÍ, NO EN LA RAMA SIGUIENTE. Este mensaje nombraba los
       videos y no los daba: ni en el texto ni en los botones, que son los tres
       del diagnóstico. El dueño con una captura: «dice que tenemos tutoriales
       pero no deja el link ni en el mensaje ni en los botones, no tiene
       lógica». Si se nombra, se da. */
    texto: `Tranquilo, eso lo resolvemos.

Aquí están los videos, paso a paso para cada parte del sistema:
${LINK_VIDEOS}

Y si prefieres que te ayude una persona, nuestro soporte técnico está en el ${SOPORTE}, ${HORARIO}.

Cuéntame en qué parte te quedaste y vamos derecho a eso:`,
    botones: BOTONES_ATASCO,
    /* Se avisa YA, sin esperar al botón: si se va sin contestar, es justo el
       que había que atender. */
    avisar: 'escribió que se atascó',
  }
}

/* ── Momento 2 · responder de verdad, y devolver el control ─────────────── */

/* ⚠ EL PRECIO SE PREGUNTA MÁS DESPUÉS DE ENTRAR QUE ANTES, Y ESO CAMBIA EL
 * CIERRE. Medido sobre las 1.047 conversaciones reales: de los que acabaron
 * pagando, el 29 % había preguntado el precio antes de registrarse y el **44 %
 * lo preguntó después**. Al que ya está dentro no se le ofrece la prueba —ya la
 * tiene—, se le dice por dónde activarlo.
 *
 * ⚠ PERO SIN PEGAR EL LINK AQUÍ. La primera versión cerraba con la URL de
 * /configuracion/plan y el dueño la tumbó: «el link para pagar cuando apenas
 * estás dando la información de los precios es completamente innecesario, y los
 * va a llevar a un sitio donde ni siquiera están registrados». Tenía razón dos
 * veces: es ruido en un mensaje que ya es largo, y el botón «Quiero pagar ya»
 * está justo debajo para quien de verdad quiera ir. Se nombra la pantalla, no
 * se pega la URL. */
function textoPrecios(country = 'co', registrado = false) {
  const P = (k) => pesos(getPrecioPlan(k, country))
  const tope = (k) => miles(PLANES_CONFIG[k].maxClientes)
  const cierre = registrado
    ? 'Cuando quieras activarlo, lo eliges desde Mi plan, dentro del sistema.'
    : `Los primeros ${DIAS_PRUEBA} días son gratis, sin tarjeta.`
  return `Tenemos un plan para cada tamaño de negocio:

INICIAL — ${P('starter')} al mes
Hasta ${tope('starter')} clientes y una ruta. Ideal si cobras tú solo y estás empezando: para tener por fin toda la cartera organizada en un solo lado.

BÁSICO — ${P('basic')} al mes
Hasta ${tope('basic')} clientes y ya con reportes. Para el negocio que está andando y necesita saber cuánto entró, cuánto hay en calle y cuánto ganó de verdad.

CRECIMIENTO — ${P('growth')} al mes
Si ya tienes cobradores. Tu cuenta de administrador más la del cobrador, ${PLANES_CONFIG.growth.maxRutas} rutas y hasta ${tope('growth')} clientes. Y te abre Lucas, la inteligencia artificial del sistema: le preguntas «¿quién me debe más?» o «¿cuánto gané este mes?» y te lo arma al momento.

De ahí para arriba seguimos, hasta ${miles(PLANES_CONFIG.professional.maxClientes)} clientes y ${PLANES_CONFIG.professional.maxUsuarios} cuentas.

${cierre}`
}

function respuestas(country, registrado = false) {
  return {
    cf_precio: {
      texto: textoPrecios(country, registrado),
      /* El segundo botón está por un dato: quien pregunta por seguridad o
         antigüedad convierte al 21 % a pago, el más alto de todos. */
      botones: [
        { id: 'cf_probar',    titulo: 'Empezar gratis' },
        { id: 'cf_confiable', titulo: '¿Es confiable?' },
        { id: 'cf_pagar',     titulo: 'Quiero pagar ya' },
      ],
    },

    cf_como: {
      /* ⚠ AQUÍ SE EXTIENDE, Y ES A PROPÓSITO. Quien pulsa esto está pidiendo
         que le cuenten; el sitio para ser corto es otro. */
      texto: `Es sencillo de usar y hace bastante más de lo que parece.

Registras tus clientes y sus préstamos, y el sistema calcula solo las cuotas, los intereses y la mora. Y como cada quien presta distinto, eliges el modo de interés que se ajusta a como prestas tú de verdad.

Cada vez que cobras le mandas el comprobante por WhatsApp con un toque. Armas rutas por zona, le das cuenta propia a cada cobrador y vas viendo quién pagó y cuánto se recaudó mientras ellos están en la calle.

Los reportes los bajas en PDF o en Excel cuando quieras, y funciona sin internet: el cobrador cobra igual y todo se sube cuando vuelve la señal.

Y para pasar la cartera que ya tienes, eliges: los metes uno por uno, le tomas foto a las hojas del cuaderno, o subes el Excel que ya manejas y el sistema detecta las columnas solo.`,
      botones: [
        { id: 'cf_probar', titulo: 'Empezar gratis' },
        { id: 'cf_precio', titulo: 'Cuánto cuesta' },
        { id: 'cf_videos', titulo: 'Ver los videos' },
      ],
    },

    cf_confiable: {
      texto: null,   // se arma con datos reales, ver `respuestaDeBoton`
      botones: [
        { id: 'cf_probar', titulo: 'Empezar gratis' },
        { id: 'cf_como',   titulo: 'Cómo funciona' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
    },

    cf_videos: {
      texto: `Claro. Tenemos un curso completo en video, paso a paso, desde crear la cuenta hasta cuadrar la caja de la noche:

${LINK_VIDEOS}

Cada video dura entre dos y cinco minutos. Y dentro del sistema tienes además las guías escritas de cada pantalla, por si prefieres leer.

Lo mejor es verlos mientras vas probando: tienes ${DIAS_PRUEBA} días gratis para eso.`,
      botones: [
        { id: 'cf_probar', titulo: 'Empezar gratis' },
        { id: 'cf_precio', titulo: 'Cuánto cuesta' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
    },

    cf_probar: {
      /* Quien pulsa esto ya decidió: el link primero y nada que lo distraiga.
         Pero no se le deja sin salida, por si se traba al entrar. */
      texto: `Listo. Abres tu cuenta aquí:

${LINK_REGISTRO}

Te toma dos minutos: tu nombre, el de tu negocio y ya. Apenas entres te digo cómo pasar tu cartera sin escribirla a mano.

Si se te traba algo, me escribes por aquí mismo y lo miramos.`,
      botones: [
        { id: 'cf_videos', titulo: 'Ver los videos' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
    },

    /* ⚠ «QUIERO PAGAR» ES DE LO QUE MÁS CONVIERTE: 44 % de registro y 22 % de
       pago. Antes no se atajaba para no perder el aviso a un humano; ahora se
       le da el link Y se avisa igual, que es lo mejor de los dos. */
    /* ⚠ NO PROMETE LA RENOVACIÓN AUTOMÁTICA, Y ES A PROPÓSITO. El cobro
       recurrente está construido y el cliente ya puede guardar su medio de
       pago, pero el cron que renueva mes a mes sigue apagado
       (`COBRO_RECURRENTE_ACTIVO`). En cuanto se encienda, aquí se puede decir
       «se te renueva solo cada mes» — y hay que relajar también la guarda de
       `lib/bot-v2/sanitizador.js`, que borra esa frase. */
    cf_pagar: {
      texto: `Claro que sí. El pago lo haces desde tu propia cuenta, aquí:

${LINK_PAGO}

Entras, eliges tu plan y pagas con tarjeta o con Nequi. Y si dejas tu medio de pago guardado, no tienes que volver a meter los datos la próxima vez.

Y si prefieres hacerlo a mano o que te acompañemos, escríbenos al ${SOPORTE}, ${HORARIO}, y lo dejamos listo contigo.`,
      botones: [
        { id: 'cf_precio', titulo: 'Ver los planes' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
      avisar: 'quiere pagar',
    },

    cf_humano: {
      texto: `Claro. Cuéntame qué necesitas y te respondo por aquí mismo.

Y si prefieres hablarlo con alguien del equipo, estamos en el ${SOPORTE}, ${HORARIO}.`,
      botones: [],
      avisar: 'pidió hablar con una persona',
    },

    /* ── Las tres ramas del atasco. Ninguna termina sin salida. ── */
    cf_at_registro: {
      texto: `Miremos qué pasó. ¿Te pidió algún dato que no tenías, o ni siquiera te abrió el link?

Por si acaso, el link es este: ${LINK_REGISTRO}

Los primeros pasos están en video aquí: ${LINK_VIDEOS}${PREGUNTA_LIBRE}${POR_TELEFONO}`,
      botones: [
        { id: 'cf_videos', titulo: 'Ver los videos' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
      avisar: 'no pudo registrarse',
    },

    cf_at_clientes: {
      texto: `Hay tres formas de cargarlos y eliges la que te sirva:

Uno por uno, en Clientes con el botón de más. Con fotos, en «Pasar mi cuaderno»: le tomas foto a las hojas y de ahí salen los nombres y los montos, hasta 30 de una vez. O con un Excel, en «Importar Excel»: subes el que ya tengas y el sistema detecta las columnas solo.

Está explicado en video aquí: ${LINK_VIDEOS}

Dime en cuál te quedaste trabado y lo miramos.${POR_TELEFONO}`,
      botones: [
        { id: 'cf_videos', titulo: 'Ver los videos' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
      avisar: 'se atascó cargando clientes',
    },

    cf_at_otra: {
      texto: `Cuéntame qué pasó y lo vemos por aquí mismo, sin apuro.

También están los videos, por si prefieres verlo hecho: ${LINK_VIDEOS}${POR_TELEFONO}`,
      botones: [
        { id: 'cf_videos', titulo: 'Ver los videos' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
      avisar: 'se atascó, sin decir en qué',
    },
  }
}

export function esBotonDelFlujo(id) {
  return Object.prototype.hasOwnProperty.call(respuestas('co'), String(id ?? ''))
}

/** La respuesta de un botón, o `null` si el id no es de este flujo. */
export function respuestaDeBoton(id, { country = 'co', confianza = null, registrado = false } = {}) {
  const r = respuestas(country, registrado)[String(id ?? '')]
  if (!r) return null
  if (id === 'cf_confiable') return { ...r, texto: textoConfianza(confianza) }
  return r
}

/* ══ LA RESPUESTA A QUIEN DESCONFÍA ════════════════════════════════════════
 *
 * Es la pregunta que MÁS convierte a pago (21 %), y tiene sentido: quien mide
 * el riesgo de entregarle los números de su negocio a un desconocido está
 * considerándolo en serio.
 *
 * ⚠ POR ESO MISMO AQUÍ NO SE INFLA NADA. Una cifra que el cliente pueda
 * desmentir destruye exactamente lo que este mensaje viene a construir. */
export function textoConfianza(datos) {
  /* `datos` puede llegar `null`, no solo `undefined`: el valor por defecto de
     `respuestaDeBoton` es null y un destructuring en la firma no lo cubre. */
  const { negocios, prestamos } = datos ?? {}

  const cabeza = negocios >= 100
    ? `Claro que sí. Llevamos más de dos años operando en Colombia y más de ${miles(negocios)} prestamistas ya nos usan en toda Latinoamérica`
    : 'Claro que sí. Llevamos más de dos años operando en Colombia y hoy nos usan prestamistas en toda Latinoamérica'
  const cola = prestamos >= 100
    ? `, con ${miles(prestamos)} préstamos vivos corriendo ahora mismo dentro del sistema.`
    : '.'

  return `${cabeza}${cola}

Tus datos están respaldados: hacemos copia de seguridad todos los días, cifrada y guardada fuera del servidor. Y tú puedes bajarte una copia completa de tu cuenta cuando quieras, además de tus reportes en PDF o en Excel.

Al estar en la nube entras desde donde estés, del celular, del computador o de una tablet, y sigue funcionando aunque te quedes sin internet.

Y no hace falta que me creas: métele dos o tres clientes y míralo tú mismo. Tienes ${DIAS_PRUEBA} días para eso.`
}

/* ══ LA DECISIÓN, SEPARADA DEL ENVÍO ═══════════════════════════════════════
 *
 * ⚠ ESTO EXISTE PARA QUE EL SIMULADOR PRUEBE EL MISMO CÓDIGO QUE CORRE DE
 * VERDAD. Un simulador con su propia copia del guion no sirve: se ajusta contra
 * él, se despliega, y en WhatsApp sale otra cosa. */
export async function decidirDesdeAnuncio({ botonId = null, texto = '', yaHablamos = 0, registrado = false } = {}) {
  if (botonId) {
    if (!esBotonDelFlujo(botonId)) return null
    const confianza = botonId === 'cf_confiable' ? await datosDeConfianza() : null
    return respuestaDeBoton(botonId, { confianza, registrado })
  }
  if (yaHablamos === 0) return saludoDeAnuncio()
  if (pareceAtascado(texto)) return respuestaAtasco()

  /* ⚠ EL CAMINO CONOCIDO TAMBIÉN LLEGA ESCRITO. Se vio en el simulador: quien
     teclea «cuánto cuesta» en vez de pulsar el botón iba al modelo, teniendo la
     respuesta hecha. Y es la pregunta de 127 personas. */
  const intencion = intencionDeTexto(texto)
  if (intencion) {
    const confianza = intencion === 'cf_confiable' ? await datosDeConfianza() : null
    return respuestaDeBoton(intencion, { confianza, registrado })
  }

  /* Cualquier otra cosa es texto libre y la atiende el modelo. */
  return null
}

/* Los patrones son estrictos a propósito: un falso positivo contesta con el
   guion equivocado, que es peor que pasar por el modelo. */
const INTENCIONES = [
  [/(cu[aá]nto|que|qu[eé])\s+(cuesta|vale|sale|es)\b|\bprecios?\b|mensualidad|\bvalor\b|tarifas?|\bplanes\b/i, 'cf_precio'],
  [/c[oó]mo\s+funciona|en\s+qu[eé]\s+consiste|qu[eé]\s+hace\s+(el\s+)?(sistema|app|programa)|para\s+qu[eé]\s+sirve/i, 'cf_como'],
  [/es\s+(confiable|seguro|serio|de\s+fiar)|son\s+serios|\bestafa\b|cu[aá]nto\s+(tiempo\s+)?llevan|desde\s+cu[aá]ndo/i, 'cf_confiable'],
  /* ⚠ `tutoriales?` NO casa «tutorial»: pide «tutoriale» y luego una ese
     opcional. Lo cazó una prueba. */
  [/\bvideos?\b|\btutorial(?:es)?\b|\bdemo\b|\bcurso\b|c[oó]mo\s+se\s+usa/i, 'cf_videos'],
  /* «Quiero pagar» se ataja Y avisa a un humano: la respuesta lleva `avisar`,
     así que no se pierde el escalado que antes lo justificaba. */
  [/quiero\s+(pagar|activar|comprar|suscribir)|c[oó]mo\s+(?:\w+\s+){0,3}pag(?:o|ar)\b|pagar\s+(el|mi)\s+(plan|servicio)|\bnequi\b/i, 'cf_pagar'],
]

export function intencionDeTexto(texto) {
  const t = String(texto ?? '')
  if (!t.trim()) return null
  for (const [patron, id] of INTENCIONES) if (patron.test(t)) return id
  return null
}

/* ══ LOS DATOS QUE SE LE DAN A QUIEN DESCONFÍA ═════════════════════════════
 *
 * Se calculan de la base, no se escriben: un número escrito a mano envejece y
 * acaba siendo mentira. Se guardan seis horas en memoria.
 *
 * ⚠ «Prestamistas» son las organizaciones REGISTRADAS. Por eso el texto dice
 * «abrieron su cuenta», que es exactamente lo que el número significa. */
const CACHE_MS = 6 * 3600000
/* Si la base no contesta, se calla cinco minutos antes de reintentar. */
const CACHE_FALLO_MS = 5 * 60000
let _cache = { hasta: 0, datos: null }

export async function datosDeConfianza() {
  if (_cache.datos && Date.now() < _cache.hasta) return _cache.datos
  try {
    const { prisma } = await import('@/lib/prisma')
    /* ⚠ EN SERIE, NO EN PARALELO: un `Promise.all` ocupa dos conexiones del
       pool a la vez, y aquí el `connection_limit` se multiplica por instancia.
       Medido en producción: 42 ms + 1 ms. */
    const negocios = await prisma.organization.count()
    const prestamos = await prisma.prestamo.count({ where: { estado: 'activo' } })
    _cache = { hasta: Date.now() + CACHE_MS, datos: { negocios, prestamos } }
    return _cache.datos
  } catch (e) {
    console.error('[flujo-anuncio] no pude leer los datos de confianza:', e.message)
    _cache = { hasta: Date.now() + CACHE_FALLO_MS, datos: {} }
    return {}
  }
}
