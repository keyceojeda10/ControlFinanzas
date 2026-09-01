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
  const filas = tablaDePrecios(country)
    .map((p) => `· Hasta ${p.tope.toLocaleString('es-CO')} clientes — ${pesos(p.precio)}/mes`)
    .join('\n')
  return `Depende de cuántos clientes maneje:

${filas}

Los primeros ${DIAS_PRUEBA} días son gratis y no le pedimos tarjeta.`
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
    texto: `Hola. Control Finanzas es el sistema para prestamistas: lleva sus clientes, préstamos, cobros y rutas desde el celular.

¿Por dónde quiere empezar?`,
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
    texto: 'Entiendo. ¿En qué parte se quedó?',
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
      texto: `Usted anota a sus clientes y sus préstamos, y el sistema le lleva solo las cuotas, los intereses, la mora y la ruta del día.

Si ya tiene la cartera en un cuaderno, le toma fotos a las hojas y el sistema saca los clientes solos: hasta 30 fotos de una vez.`,
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
      texto: `Listo. Se registra aquí, sin tarjeta y con ${DIAS_PRUEBA} días gratis:

${LINK_REGISTRO}

Cuando entre, le ayudo a pasar su cartera.`,
      botones: [],
    },
    cf_humano: {
      texto: 'Claro. Cuénteme qué necesita y le respondo por aquí mismo.',
      botones: [],
      avisar: 'pidió hablar con una persona',
    },
    cf_at_registro: {
      texto: `Vamos a mirarlo. ¿Qué le salió cuando intentó entrar: le pidió un dato que no tenía, o no le abrió el link?

Si prefiere, el link es este: ${LINK_REGISTRO}`,
      botones: [],
      avisar: 'no pudo registrarse',
    },
    cf_at_clientes: {
      texto: `Para pasar su cartera no hace falta escribirla:

1. En el menú, entre a «Pasar mi cuaderno».
2. Tome las fotos de las hojas, derechas y con buena luz. Hasta 30 de una vez.
3. Revise lo que salió, corrija lo que haga falta y guarde.

Si algo no le sale, dígame en qué paso se quedó.`,
      botones: [],
      avisar: 'se atascó cargando clientes',
    },
    cf_at_otra: {
      texto: 'Cuénteme qué pasó y lo vemos por aquí mismo.',
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
    ? `\n\nAhora mismo hay ${prestamos.toLocaleString('es-CO')} préstamos activos llevándose en el sistema.`
    : ''
  return `${cabeza}${cuerpo}

Sus datos son suyos: puede exportarlos cuando quiera, y no le pedimos tarjeta para probarlo.`
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
let _cache = { hasta: 0, datos: null }

export async function datosDeConfianza() {
  if (_cache.datos && Date.now() < _cache.hasta) return _cache.datos
  try {
    const { prisma } = await import('@/lib/prisma')
    const [primera, negocios, prestamos] = await Promise.all([
      prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      prisma.organization.count({ where: { clientes: { some: {} } } }),
      prisma.prestamo.count({ where: { estado: 'activo' } }),
    ])
    const meses = primera
      ? Math.max(1, Math.floor((Date.now() - new Date(primera.createdAt).getTime()) / (30 * 86400000)))
      : 0
    _cache = { hasta: Date.now() + CACHE_MS, datos: { meses, negocios, prestamos } }
    return _cache.datos
  } catch (e) {
    console.error('[flujo-anuncio] no pude leer los datos de confianza:', e.message)
    /* Sin datos se contesta igual, con la parte que no depende de números. */
    return {}
  }
}
