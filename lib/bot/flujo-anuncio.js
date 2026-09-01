// lib/bot/flujo-anuncio.js — el bot que atiende a quien escribe desde un anuncio.
//
// ══ QUÉ ES ESTO Y QUÉ NO ES ════════════════════════════════════════════════
//
// Es una pieza NUEVA que convive con el bot de siempre; no lo sustituye ni lo
// refactoriza. El de siempre atiende a quien venía del formulario y a quien
// escribe por su cuenta. Éste atiende solo a quien llega desde un anuncio de
// Click-to-WhatsApp, y se distingue por `BotLead.anuncioId`.
//
// Se hizo así por tres razones, y conviene no perderlas:
//
//   · **Para poder volver atrás.** Si esto no rinde, se apaga y el tráfico
//     vuelve al bot de siempre sin haber perdido nada.
//   · **Para no romper lo que hoy funciona** mientras el negocio está frágil.
//   · **Porque el tráfico es distinto.** El bot de siempre está escrito para
//     ABRIR la conversación —escribimos nosotros—. Éste es para RESPONDER a
//     alguien que ya escribió. Son dos guiones, no dos versiones del mismo.
//
// ══ POR QUÉ BOTONES ════════════════════════════════════════════════════════
//
// Medido sobre las conversaciones desde julio: de los que contestan algo, la
// mitad se queda en dos o tres mensajes. Con tres turnos no hay sitio para dar
// rodeos — o se resuelve en los primeros dos, o no se resuelve.
//
// ══ EL ORDEN NO ES EL DE LAS PREGUNTAS, ES EL DE LO QUE PAGA ═══════════════
//
// Cruzando cada tema con quién terminó pagando (línea base: 13,3 % de 1.656
// leads se registran):
//
//   ¿es seguro? / ¿cuánto llevan? ...  14 personas · 57 % registro · 21 % PAGA
//   quiero pagar / activar .........   54 personas · 44 % registro · 22 % PAGA
//   no pude / no entiendo ..........   39 personas · 44 % registro · 10 % paga
//   precio / cuánto vale ........... **127 personas** · 20 % registro · 5 % paga
//   cómo funciona ..................   50 personas · 24 % registro ·  2 % paga
//
// **El precio es lo más preguntado y de lo que menos paga.** No se esconde
// —esquivarlo pierde la venta— pero no puede ser el eje: se contesta de frente,
// rápido, y se devuelve el control con un botón.
//
// **«¿Es confiable?» es lo que más paga y hoy no tenía respuesta preparada.**
// Tiene sentido: quien evalúa el riesgo de entregarle sus números a un tercero
// está considerándolo en serio.
//
// ⚠ NADA DE ESTO PASA POR EL MODELO. Son respuestas fijas: el camino conocido
// no necesita interpretación, no debe costar tokens y no puede improvisar
// precios. El modelo sigue atendiendo todo lo que llegue como texto libre.

import { PLANES_CONFIG, getPrecioPlan, DIAS_PRUEBA } from '@/lib/planes'

/* ══ CÓMO SE ESCRIBE AQUÍ ══════════════════════════════════════════════════
 *
 * ⚠ LA PRIMERA VERSIÓN DE ESTOS TEXTOS ERAN FICHAS DE PRODUCTO —«el sistema
 * lleva sus clientes, préstamos, cobros y rutas»— y el dueño las tumbó enteras.
 * Tenía razón: eso describe el software, no le habla al prestamista.
 *
 * La voz que sí convierte está MEDIDA y estaba escrita desde julio:
 *
 * · **Test A/B de julio 2026, 194 leads.** El hook de dolor directo —«¿usted
 *   sabe exactamente cuánto le deben hoy, o le toca sumar a mano?»— convirtió
 *   **9,4 veces más** que la pregunta abierta. Genera menos respuestas (38 %
 *   contra 57 %) pero filtra: contesta quien siente el dolor, y de esos se
 *   registra el 22,6 %.
 * · **`guia_ventas_whatsapp_control_finanzas.txt`:** «la mayoría me dice "más o
 *   menos tengo X en calle" pero nunca saben el número real. Y ahí es donde se
 *   pierde plata sin darse cuenta.»
 * · **El prompt del bot** (`lib/bot/prompts/ventas.js`): usted amable, dos a
 *   cuatro líneas, una idea por mensaje, **nunca listas con guiones ni
 *   markdown** —en WhatsApp se ven mal—, y solo funciones que existen.
 *
 * Reglas al tocar cualquier frase de este fichero:
 *
 *   1. **Habla del día del prestamista, no del software.** Sumar de noche,
 *      cuadrar con el cobrador, el cuaderno mojado, no saber quién debe.
 *   2. **El vocabulario es el suyo**: en calle, cartera, cuota, cuaderno,
 *      cobrador, mora, cuadrar. No «gestionar», no «optimizar», no «solución».
 *   3. **Cero funciones inventadas.** La lista de lo que existe está en
 *      `lib/bot/prompts/contexto.js`. Prometer de más se paga cuando entra.
 *   4. Nada de viñetas ni negritas: WhatsApp las enseña en crudo. */

const LINK_REGISTRO = 'https://app.control-finanzas.com/registro?r=2'

/** ¿Este lead escribió desde un anuncio de WhatsApp?
 *
 * ⚠ NO SE MIRA `anuncioId`, AUNQUE LO PAREZCA. Ese campo lo escriben TRES
 * sitios con significados distintos: el webhook del formulario de Facebook
 * —1.501 de los 1.657 leads—, el sync (`fb_sync`) y el webhook de WhatsApp.
 * Usarlo como discriminador metía a TODO el tráfico del formulario en este
 * flujo, que es exactamente lo contrario de lo acordado. Se vio contando en
 * producción: 1.587 leads lo tenían.
 *
 * `desdeAnuncioWa` lo pone solo el webhook de WhatsApp, cuando el mensaje trae
 * `referral`. Eso —y nada más— significa «escribió desde un anuncio». */
export function esDeAnuncio(lead) {
  return lead?.desdeAnuncioWa === true
}

const pesos = (n) => '$' + Number(n).toLocaleString('es-CO')

/* ⚠ LOS PRECIOS Y LOS TOPES SALEN DE `lib/planes.js`, NO SE ESCRIBEN AQUÍ.
 *
 * Ya pasó tres veces con la pantalla de planes: el tope se bajó de 150 a 100 en
 * la configuración y la pantalla siguió prometiendo 150 a quien estaba a punto
 * de pagar. Un bot que promete un tope que no existe es lo mismo, pero peor,
 * porque lo dice antes de que la persona entre.
 *
 * Tres tramos, no cinco: la conversación tiene dos o tres turnos y una lista de
 * cinco planes no se lee en WhatsApp. Quien necesite más lo ve en la app. */
export function tablaDePrecios(country = 'co') {
  return ['starter', 'basic', 'growth'].map((key) => ({
    key,
    tope: PLANES_CONFIG[key].maxClientes,
    precio: getPrecioPlan(key, country),
  }))
}

function textoPrecios(country = 'co') {
  /* ⚠ SIN VIÑETAS: WhatsApp no las formatea y salen los puntos en crudo. */
  const filas = tablaDePrecios(country)
    .map((p) => `Hasta ${p.tope.toLocaleString('es-CO')} clientes: ${pesos(p.precio)} al mes`)
    .join('\n')
  /* El precio por día es como piensa un prestamista: en cuotas, no en
     mensualidades. $39.000 al mes son $1.300 diarios, menos de lo que deja una
     sola cuota mal anotada. */
  const masBarato = tablaDePrecios(country)[0]
  const alDia = Math.round(masBarato.precio / 30)
  return `Va por el tamaño de la cartera:

${filas}

El más barato le sale en ${pesos(alDia)} al día. Menos de lo que se pierde en una cuota mal anotada.

Y los primeros ${DIAS_PRUEBA} días no cuesta nada, sin tarjeta.`
}

/* ── Momento 1 · escribe desde el anuncio ─────────────────────────────────
 *
 * En Click-to-WhatsApp la persona escribe primero, y casi siempre algo genérico
 * («hola», «información», «precios»). Ya demostró intención al pulsar el
 * anuncio, así que el diagnóstico de venta sobra: se le enseña por dónde puede
 * seguir y se le deja elegir. */
export const BOTONES_ENTRADA = [
  { id: 'cf_precio', titulo: 'Cuánto cuesta' },
  { id: 'cf_como',   titulo: 'Cómo funciona' },
  { id: 'cf_probar', titulo: 'Quiero probarlo' },
]

export function saludoDeAnuncio() {
  return {
    texto: `¿Usted sabe ahora mismo, sin sumar a mano, cuánto tiene en la calle?

Casi todos me dicen «más o menos tanto». Ahí es donde se pierde la plata sin darse cuenta.

Control Finanzas se lo dice en dos segundos: cuánto tiene afuera, quién le pagó hoy y quién le quedó debiendo.`,
    botones: BOTONES_ENTRADA,
  }
}

/* ── Momento 4 · señal de atasco ──────────────────────────────────────────
 *
 * 26 personas escribieron «no pude», «no entiendo», «no sé cómo usarlo» y
 * ninguna generó un aviso a nadie. Son pocas al mes: se pueden atender a mano
 * perfectamente, lo que faltaba era enterarse.
 *
 * ⚠ Y NO SE DERIVA AL 301 199 3001. Está medido: 274 derivaciones a ese número
 * en julio y agosto, y 4 tickets de soporte en toda la historia del producto.
 * El traspaso convierte cerca del 1 %. Quien dice «no pude» se registra en el
 * 44 % de los casos y paga en el 10 % — son clientes atascados, no gente que se
 * va, y hoy se les da un teléfono al que nadie escribe. */
/* ══ EL NÚMERO DE SOPORTE ══════════════════════════════════════════════════
 *
 * Lo pidió el dueño el 1 sep 2026: «¿por qué no se comparte el número de
 * soporte técnico?».
 *
 * El dato que había llevado a quitarlo: 274 derivaciones a ese número en julio
 * y agosto, y 4 tickets de soporte en toda la historia del producto. Pero ese
 * dato no dice «no des el número»: dice que el bot lo daba **en lugar de**
 * atender —«eso se lo muestran en vivo, escríbales al 301»— y ahí terminaba la
 * conversación. Lo que convertía al 1 % era el traspaso, no el número.
 *
 * Así que va, pero SIEMPRE DESPUÉS de haber preguntado y de haber avisado a un
 * humano por este mismo chat. Nunca como respuesta, siempre como salida
 * adicional: quien prefiere llamar, llama; quien se queda, es atendido aquí.
 *
 * ⚠ Si alguna vez esto vuelve a ser lo ÚNICO que se contesta a un «no pude»,
 * es el fallo viejo otra vez. */
const SOPORTE = '301 199 3001'
const TAMBIEN_POR_TELEFONO = `\n\nSi prefiere, también nos escribe o nos llama al ${SOPORTE}.`

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
    texto: `Entiendo. ¿En qué parte se quedó?${TAMBIEN_POR_TELEFONO}`,
    botones: BOTONES_ATASCO,
    /* Se avisa YA, sin esperar a que conteste el botón: si se va sin
       contestar, es justo el que había que atender. */
    avisar: 'escribió que se atascó',
  }
}

/* ── Momento 2 · responder rápido y devolver el control ───────────────── */

function respuestas(country) {
  return {
    cf_precio: {
      texto: textoPrecios(country),
      /* El segundo botón está por un dato concreto: quien pregunta por
         seguridad o antigüedad es el que más paga de todos. */
      botones: [
        { id: 'cf_probar',    titulo: 'Empezar gratis' },
        { id: 'cf_confiable', titulo: '¿Es confiable?' },
      ],
    },
    cf_como: {
      /* La que peor convierte (2 % paga). Se contesta corto y se ofrece la
         prueba en vez de invertir la conversación aquí. */
      texto: `Usted presta y cobra igual que siempre. Lo que se acaba es sentarse de noche a sumar.

Abre la app y ahí está la ruta del día: a quién le toca pagar, cuánto y quién viene atrasado. Marca el cobro y las cuentas se corren solas.

Y si su cartera está en el cuaderno, le toma foto a las hojas y de ahí salen los clientes. Hasta 30 fotos de una vez.`,
      botones: [
        { id: 'cf_probar', titulo: 'Empezar gratis' },
        { id: 'cf_precio', titulo: 'Cuánto cuesta' },
      ],
    },
    cf_confiable: {
      texto: null,   // se arma con datos reales, ver `respuestaDeBoton`
      botones: [
        { id: 'cf_probar', titulo: 'Empezar gratis' },
        { id: 'cf_humano', titulo: 'Hablar con alguien' },
      ],
    },
    cf_probar: {
      /* Quien pulsa esto ya decidió. Link y nada más: cada pregunta de aquí en
         adelante es una oportunidad de perderlo. */
      texto: `Listo. Se abre la cuenta aquí, sin tarjeta:

${LINK_REGISTRO}

Le toma dos minutos. Apenas entre le digo cómo pasar su cartera sin escribirla.`,
      botones: [],
    },
    cf_humano: {
      texto: `Claro. Cuénteme qué necesita y le respondo por aquí mismo.${TAMBIEN_POR_TELEFONO}`,
      botones: [],
      avisar: 'pidió hablar con una persona',
    },
    cf_at_registro: {
      texto: `Miremos qué pasó. ¿Le pidió algún dato que no tenía, o ni siquiera le abrió el link?

Por si acaso, este es: ${LINK_REGISTRO}${TAMBIEN_POR_TELEFONO}`,
      botones: [],
      avisar: 'no pudo registrarse',
    },
    cf_at_clientes: {
      texto: `No hace falta escribirla a mano.

En el menú entra a «Pasar mi cuaderno», le toma foto a las hojas y de ahí salen los nombres y los montos. Usted solo revisa y guarda.

Dígame en qué parte se le quedó trabada y lo miramos.${TAMBIEN_POR_TELEFONO}`,
      botones: [],
      avisar: 'se atascó cargando clientes',
    },
    cf_at_otra: {
      texto: `Cuénteme qué pasó y lo vemos por aquí mismo.${TAMBIEN_POR_TELEFONO}`,
      botones: [],
      avisar: 'se atascó, sin decir en qué',
    },
  }
}

export function esBotonDelFlujo(id) {
  return Object.prototype.hasOwnProperty.call(respuestas('co'), String(id ?? ''))
}

/** La respuesta de un botón, o `null` si el id no es de este flujo.
 *
 *  `confianza` son los datos reales que se le dan a quien pregunta si esto es
 *  serio; se calculan fuera para no consultar la base desde aquí. */
export function respuestaDeBoton(id, { country = 'co', confianza = null } = {}) {
  const r = respuestas(country)[String(id ?? '')]
  if (!r) return null
  if (id === 'cf_confiable') {
    return { ...r, texto: textoConfianza(confianza) }
  }
  return r
}

/* ⚠ AQUÍ NO SE INFLA NADA. Lo que diga este mensaje tiene que ser verdad y
   tiene que poder comprobarse: se lo estamos diciendo a alguien que está
   decidiendo si nos entrega los números de su negocio. Si los datos no llegan,
   se dice lo que sí sabemos y ya — mejor corto que inventado. */
export function textoConfianza(datos) {
  /* ⚠ `datos` puede llegar `null`, no solo `undefined`: el valor por defecto de
     `respuestaDeBoton` es null y un destructuring en la firma no lo cubre. Lo
     encontró una prueba; en producción habría sido una excepción justo con
     quien pregunta si esto es serio. */
  const { meses, negocios, prestamos } = datos ?? {}
  const partes = []
  if (meses >= 1) partes.push(`Llevamos ${meses} ${meses === 1 ? 'mes' : 'meses'} operando`)
  if (negocios >= 10) partes.push(`y hoy nos usan ${negocios.toLocaleString('es-CO')} negocios de préstamos en Colombia`)
  const cabeza = partes.length
    ? partes.join(' ') + '.'
    : 'Somos un equipo colombiano y el sistema está en uso todos los días.'
  const cuerpo = prestamos >= 100
    ? `\n\nAhora mismo hay ${prestamos.toLocaleString('es-CO')} préstamos vivos corriendo ahí dentro.`
    : ''
  /* Quien pregunta esto está midiendo el riesgo de entregarle sus números a un
     desconocido. Lo que lo calma no es una promesa: es que no tiene que
     arriesgar nada para comprobarlo. */
  return `${cabeza}${cuerpo}

Su información es suya y se la puede llevar cuando quiera.

Y no hace falta que me crea: métale dos o tres clientes y mírelo usted mismo. No pedimos tarjeta.`
}

/* ══ LA DECISIÓN, SEPARADA DEL ENVÍO ═══════════════════════════════════════
 *
 * ⚠ ESTO EXISTE PARA QUE EL SIMULADOR PRUEBE EL MISMO CÓDIGO QUE CORRE DE
 * VERDAD. Un simulador con su propia copia del guion no sirve para nada: se
 * ajusta contra él, se despliega, y en WhatsApp sale otra cosa. Aquí se decide
 * QUÉ contestar; quién lo manda —el webhook— o quién lo pinta —el simulador—
 * es problema de cada uno.
 *
 * `yaHablamos` es cuántas veces ha hablado el bot en esta conversación: con
 * cero, lo que toca es el saludo. */
export async function decidirDesdeAnuncio({ botonId = null, texto = '', yaHablamos = 0 } = {}) {
  if (botonId) {
    if (!esBotonDelFlujo(botonId)) return null
    const confianza = botonId === 'cf_confiable' ? await datosDeConfianza() : null
    return respuestaDeBoton(botonId, { confianza })
  }
  if (yaHablamos === 0) return saludoDeAnuncio()
  if (pareceAtascado(texto)) return respuestaAtasco()

  /* ⚠ EL CAMINO CONOCIDO TAMBIÉN LLEGA ESCRITO. Se vio en el simulador: quien
     teclea «cuánto cuesta» en vez de pulsar el botón iba al modelo, teniendo la
     respuesta hecha. Y es la pregunta de 127 personas, la más frecuente de
     todas. Contestarla con el guion ahorra tokens y, sobre todo, evita que el
     modelo se invente un precio. */
  const intencion = intencionDeTexto(texto)
  if (intencion) {
    const confianza = intencion === 'cf_confiable' ? await datosDeConfianza() : null
    return respuestaDeBoton(intencion, { confianza })
  }

  /* Cualquier otra cosa es texto libre y la atiende el modelo. */
  return null
}

/* ⚠ SOLO LAS TRES QUE TIENEN RESPUESTA FIJA Y NO CAMBIAN NADA MÁS.
 *
 * «Quiero pagar» NO está aquí a propósito, aunque sea de lo que más convierte
 * (22 % paga): el clasificador del bot lo ESCALA a un humano, y atajarlo con
 * una respuesta fija se llevaría por delante ese aviso. Lo mismo con quien pide
 * el link, que ya tiene su propio camino en el agente.
 *
 * Los patrones son estrictos a propósito: un falso positivo aquí contesta con
 * el guion equivocado, que es peor que pasar por el modelo. */
const INTENCIONES = [
  [/(cu[aá]nto|que|qu[eé])\s+(cuesta|vale|sale|es)\b|\bprecios?\b|mensualidad|\bvalor\b|tarifas?/i, 'cf_precio'],
  [/c[oó]mo\s+funciona|en\s+qu[eé]\s+consiste|qu[eé]\s+hace\s+(el\s+)?(sistema|app|programa)|para\s+qu[eé]\s+sirve/i, 'cf_como'],
  [/es\s+(confiable|seguro|serio|de\s+fiar)|son\s+serios|\bestafa\b|cu[aá]nto\s+(tiempo\s+)?llevan|desde\s+cu[aá]ndo/i, 'cf_confiable'],
]

export function intencionDeTexto(texto) {
  const t = String(texto ?? '')
  if (!t.trim()) return null
  for (const [patron, id] of INTENCIONES) if (patron.test(t)) return id
  return null
}

/* ══ LOS DATOS QUE SE LE DAN A QUIEN DESCONFÍA ═════════════════════════════
 *
 * Se calculan de la base, no se escriben, porque un número escrito a mano
 * envejece y acaba siendo mentira. Se guardan en memoria seis horas: esto lo
 * pregunta poca gente y no vale una consulta por mensaje.
 *
 * ⚠ «Negocios» son los que han cargado al menos un cliente, no los registrados.
 * Registrarse es gratis y no significa nada; decir «nos usan N negocios»
 * contando cuentas vacías sería inflarlo. */
const CACHE_MS = 6 * 3600000
/* Si la base no contesta, se calla cinco minutos antes de volver a intentarlo.
   Sin esto, cada persona que pulsara el botón dispararía tres consultas más
   contra una base que ya está en apuros. */
const CACHE_FALLO_MS = 5 * 60000
let _cache = { hasta: 0, datos: null }

export async function datosDeConfianza() {
  if (_cache.datos && Date.now() < _cache.hasta) return _cache.datos
  try {
    const { prisma } = await import('@/lib/prisma')
    /* ⚠ EN SERIE, NO EN PARALELO. Un `Promise.all` ocupa tres conexiones del
       pool a la vez, y aquí el `connection_limit` se multiplica por número de
       instancias. Medido en producción: 42 ms + 1 ms + 0,2 ms — no hay nada que
       ganar paralelizando y sí algo que perder. */
    const primera = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    const negocios = await prisma.organization.count({ where: { clientes: { some: {} } } })
    const prestamos = await prisma.prestamo.count({ where: { estado: 'activo' } })
    const meses = primera
      ? Math.max(1, Math.floor((Date.now() - new Date(primera.createdAt).getTime()) / (30 * 86400000)))
      : 0
    _cache = { hasta: Date.now() + CACHE_MS, datos: { meses, negocios, prestamos } }
    return _cache.datos
  } catch (e) {
    console.error('[flujo-anuncio] no pude leer los datos de confianza:', e.message)
    /* Sin datos se contesta igual, con la parte que no depende de números. */
    _cache = { hasta: Date.now() + CACHE_FALLO_MS, datos: {} }
    return {}
  }
}
