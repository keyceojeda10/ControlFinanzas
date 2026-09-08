// lib/bot-v2/soporte.js — SOPORTE EN TRES NIVELES (BOT v3 · sprint 8).
//
// ══ EL HUECO ════════════════════════════════════════════════════════════════
//
// Medido en producción el 2 sep 2026: 204 preguntas de gente YA REGISTRADA, en
// cuatro grupos casi iguales. El más grande (27 %) es «cómo hago tal cosa»:
// «Como se crea una ruta a ver», «a esa ruta asignarle al cobrador no me
// puede, ¿no?».
//
// Para eso hay 35 guías visuales con 119 capturas en `public/guias/`, un
// catálogo con sinónimos, un enviador por la Cloud API y el webhook cableado.
// Nunca se mandó ninguna: `agente.js` devolvía `enviarGuia: null` a fuego y el
// catálogo lo importaba solo el propio enviador. Esto es el hilo que faltaba.
//
// ══ TRES NIVELES, Y SOLO UNO SE CONTESTA SOLO ═══════════════════════════════
//
//   NAVEGACIÓN  «cómo creo una ruta» → la guía visual. Son capturas del equipo,
//               no una explicación improvisada por el modelo.
//   DINERO      «no me cuadra la caja», «por qué me da este saldo» → a soporte
//               humano. Es la regla de oro: si el bot se inventa esto, el
//               prestamista descuadra su plata de verdad.
//   TÉCNICO     «no me abre», «me da error» → a soporte humano.
//
// Guardarraíles acordados: solo a registrados, una guía por conversación,
// nunca en mitad de una venta.

import { GUIAS } from '@/lib/bot/guias-catalogo'

/* ⚠ APAGADO EL 8 SEP 2026, EL MISMO DÍA QUE SE ENCENDIÓ. LAS CAPTURAS SON DEL
 * 15 DE AGOSTO Y LA INTERFAZ YA NO ES ESA.
 *
 * Comparadas contra el espejo con el código de hoy, a la misma anchura:
 *   · La guía de crear un cliente dice «desde el inicio toca "Nuevo cliente"».
 *     Ese botón YA NO EXISTE: el inicio de hoy abre con la tarjeta negra de
 *     «recaudado hoy» y los tres botones grandes se fueron.
 *   · La guía de capital dice «+ Movimiento». Hoy hay DOS botones y el que
 *     sirve se llama «Registrar movimiento».
 * Entre medias van 130 commits de interfaz, uno de ellos renombrando el menú.
 *
 * Mandarle a un cliente una captura que le dice que pulse un botón que no
 * existe es peor que no mandarle nada: lo deja buscando y con menos confianza.
 * El resto del soporte en tres niveles (dinero y técnico a una persona) NO
 * depende de capturas y sigue en pie.
 *
 * Para volver a encenderlo: regenerar las 119 capturas y poner BOT_GUIAS=on
 * en el .env del VPS (`pm2 reload cf --update-env`). No hace falta desplegar. */
export const GUIAS_ENCENDIDAS = process.env.BOT_GUIAS === 'on'

/* Las claves del catálogo están en infinitivo («crear ruta») y la gente escribe
   conjugado: «como se crea una ruta a ver» es literalmente el ejemplo más
   frecuente que se midió, y no casaba con nada. Aquí las formas se llevan a una
   sola antes de comparar. Solo verbos, y solo los del catálogo. */
const VERBOS = [
  [/\b(?:cre(?:o|a|as|an|ando|e|en|ar)|crear[a-z]*)\b/g, 'crear'],
  [/\b(?:agreg[a-z]*|añad[a-z]*|anad[a-z]*|sum[ao]|meter|met[oe])\b/g, 'agregar'],
  [/\b(?:elimin[a-z]*|borr[a-z]*|quit[a-z]*)\b/g, 'eliminar'],
  [/\b(?:edit[a-z]*|modific[a-z]*|cambi[a-z]*|correg[a-z]*|corrij[a-z]*)\b/g, 'editar'],
  [/\b(?:registr[a-z]*|anot[a-z]*|apunt[a-z]*)\b/g, 'registrar'],
  [/\b(?:renov[a-z]*|refinanci[a-z]*)\b/g, 'renovar'],
  [/\b(?:pag(?:o|a|ar|ue|uen|ando)|pagar[a-z]*)\b/g, 'pagar'],
  [/\b(?:cobr[a-z]*)\b/g, 'cobrar'],
  [/\b(?:organiz[a-z]*|orden[a-z]*)\b/g, 'organizar'],
  [/\b(?:import[a-z]*|sub[oe]|subir)\b/g, 'importar'],
  [/\b(?:instal[a-z]*)\b/g, 'instalar'],
  [/\b(?:descarg[a-z]*|baj[oa]r?)\b/g, 'descargar'],
  [/\b(?:envi[a-z]*|mand[a-z]*)\b/g, 'enviar'],
  [/\b(?:inactiv[a-z]*|desactiv[a-z]*|paus[a-z]*)\b/g, 'inactivar'],
  [/\b(?:traslad[a-z]*|mover|muev[a-z]*)\b/g, 'trasladar'],
  /* «paso mis clientes» sí; «lo que pasa es que» no. La tercera persona se deja
     fuera a propósito: es la muletilla más común de Colombia y arrastraba
     preguntas enteras a la guía de trasladar un cliente. */
  [/\b(?:paso|pasar|pasarlos|pasarlas|pasarme|pasarle|pasarlo)\b/g, 'pasar'],
  [/\b(?:anul[a-z]*|deshac[a-z]*)\b/g, 'anular'],
  [/\b(?:cuadr[a-z]*)\b/g, 'cuadrar'],
  [/\b(?:cierr[a-z]*|cerr[a-z]*|cierre)\b/g, 'cerrar'],
  [/\b(?:reabr[a-z]*)\b/g, 'reabrir'],
  [/\b(?:aprob[a-z]*|apruev[a-z]*)\b/g, 'aprobar'],
  [/\b(?:rechaz[a-z]*)\b/g, 'rechazar'],
  [/\b(?:configur[a-z]*|ajust[a-z]*)\b/g, 'configurar'],
  [/\b(?:retir[a-z]*|sac[a-z]*)\b/g, 'retirar'],
  [/\b(?:inyect[a-z]*)\b/g, 'inyectar'],
  [/\b(?:reagend[a-z]*|posponer|pospong[a-z]*|aplaz[a-z]*)\b/g, 'reagendar'],
  [/\b(?:aplic[a-z]*|pon(?:er|go|e))\b/g, 'aplicar'],
  [/\b(?:asign[a-z]*)\b/g, 'asignar'],
]
const canon = (t) => VERBOS.reduce((x, [rx, v]) => x.replace(rx, v), t)
export const norm = (t) => canon(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())

/* Preguntas de plata: nunca las contesta el bot. Van antes que todo lo demás,
   incluso si alguna guía casa por palabras («caja», «ajuste»): que exista la
   guía de cuadrar caja no autoriza a decidir por qué HOY no le cuadra. */
const DINERO = /\bno me cuadra\b|\bno cuadra\b|\bdescuadr|\bpor que me (?:da|sale|aparece|figura|cobra)\b|\bpor que (?:me )?(?:esta|est[aá]) (?:mal|malo)\b|\bmal (?:el|la) (?:saldo|cuenta|total|cifra|mora|interes)\b|\bsaldo (?:en )?negativo\b|\bme (?:falta|sobra) (?:plata|dinero)\b|\bno me (?:suma|resta|calcula)\b|\bcalcul[oó] mal\b|\bestá mal (?:el|la)\b|\besta mal (?:el|la)\b|\bdiferencia en (?:la caja|el cuadre)\b/i

/* Fallos técnicos: tampoco. Un «reinicie e intente» del bot pierde al cliente. */
const TECNICO = /\bno (?:me )?(?:abre|carga|funciona|sirve|deja entrar|deja ingresar)\b|\bme (?:da|sale|aparece) (?:un )?error\b|\bse (?:me )?(?:cierra|traba|congela|cae|apaga)\b|\bno puedo (?:entrar|ingresar|abrir)\b|\bpantalla (?:en )?blanc|\bse me borr|\bperd[ií] (?:los|mis) datos\b/i

/* Y hay que estar preguntando cómo se hace algo, no solo nombrando la palabra:
   «ya cree la ruta» no pide una guía. */
export const PIDE_COMO = /\bcomo\b|\bc[oó]mo\b|\bdonde\b|\bd[oó]nde\b|\bse puede\b|\bpuedo\b|\bse hace\b|\bhago\b|\bhacer\b|\bme ayuda\b|\bme explica\b|\bme ense[ñn]a\b|\bpasos\b|\bmanera de\b|\bforma de\b|\bqu[eé] hago\b|\bque hago\b|\bno (?:se|s[eé]) (?:como|c[oó]mo)\b|\bensename\b|\bense[ñn]eme\b/i

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'un', 'una', 'los', 'las', 'del', 'al', 'por', 'para', 'con', 'que', 'como', 'mi', 'su', 'lo', 'se', 'en', 'y', 'o', 'a'])
/* Cortas pero con significado: sin esto, «descargar app» solo aportaba una
   palabra útil y no llegaba al mínimo. */
const CORTAS_UTILES = new Set(['app', 'pdf', 'iva', 'sms', 'mes', 'dia', 'pin'])
const util = (w) => (w.length > 3 || CORTAS_UTILES.has(w)) && !PALABRAS_VACIAS.has(w)

/* Guías que un REGISTRADO no puede necesitar. `crear-cuenta` casaba con medio
   catálogo por la palabra «registr…» y se llevó cuatro de trece emparejamientos
   en la medición contra mensajes reales: «quiero registrar a un cliente que ya
   lleva tres cuotas» no es «cómo abro una cuenta». */
const NO_PARA_REGISTRADOS = new Set(['crear-cuenta'])

/** Frases del catálogo, ya normalizadas. Se calcula una vez. */
const FRASES = Object.entries(GUIAS).map(([slug, g]) => ({
  slug, titulo: g.titulo,
  frases: [...String(g.claves).split(',').map(norm), norm(g.titulo)]
    .filter(Boolean)
    .map((f) => ({ f, palabras: f.split(' ').filter(util) })),
}))

/* Palabra COMPLETA, no subcadena: con `includes` a secas, «registro» casaba
   dentro de «registrando» y «cuenta» dentro de «cuentas», y el catálogo entero
   se volvía elástico. */
export const tienePalabra = (t, w) => new RegExp(`(?:^|\\s)${w}(?:s|es)?(?:$|\\s)`).test(t)

/**
 * La guía que corresponde a lo que pregunta, o null si no hay una clara.
 * Puntúa: la frase entera del catálogo dentro del texto vale 3; todas sus
 * palabras sueltas presentes valen 2. Gana la que pase de 3 y saque ventaja a
 * la siguiente: dos guías empatadas significan que no sabemos cuál quiere.
 */
export function elegirGuia(texto, { minimo = 4, paraRegistrado = true, forzar = false } = {}) {
  if (!GUIAS_ENCENDIDAS && !forzar) return null
  const t = norm(texto)
  const palabras = t.split(' ')
  if (!t || palabras.length < 3) return null
  /* Un mensaje largo y divagante no es una pregunta puntual, es un relato: ahí
     casan palabras por acumulación y sale la guía equivocada. «Necesito una
     inducción, porque aquí no me dan una inducción…» pedía «trasladar cliente». */
  if (palabras.length > 45) return null
  if (!PIDE_COMO.test(t)) return null
  const puntos = []
  for (const g of FRASES) {
    if (paraRegistrado && NO_PARA_REGISTRADOS.has(g.slug)) continue
    let p = 0
    for (const { f, palabras } of g.frases) {
      if (f.includes(' ') && t.includes(f)) p = Math.max(p, 4 + palabras.length)
      else if (palabras.length >= 2 && palabras.every((w) => tienePalabra(t, w))) p = Math.max(p, 2 + palabras.length)
    }
    if (p > 0) puntos.push({ slug: g.slug, p })
  }
  puntos.sort((a, b) => b.p - a.p)
  if (!puntos.length || puntos[0].p < minimo) return null
  // Dos guías empatadas significan que no sabemos cuál quiere: mejor ninguna.
  if (puntos[1] && puntos[1].p >= puntos[0].p) return null
  return puntos[0].slug
}

/* El mismo motor que elige guía sirve para elegir vídeo: entradas con frases
   ya normalizadas, puntuación por frase entera o por todas sus palabras, y
   ninguna respuesta si dos empatan. Vive aquí porque aquí se escribió. */
export function mejorCoincidencia(texto, entradas, { minimo = 4 } = {}) {
  const t = norm(texto)
  const puntos = []
  for (const e of entradas) {
    let p = 0
    for (const { f, palabras } of e.frases) {
      if (f.includes(' ') && t.includes(f)) p = Math.max(p, 4 + palabras.length)
      else if (palabras.length >= 2 && palabras.every((w) => tienePalabra(t, w))) p = Math.max(p, 2 + palabras.length)
    }
    if (p > 0) puntos.push({ clave: e.clave, p })
  }
  puntos.sort((a, b) => b.p - a.p)
  if (!puntos.length || puntos[0].p < minimo) return null
  if (puntos[1] && puntos[1].p >= puntos[0].p) return null
  return puntos[0].clave
}

export function frasesDe(textos) {
  return textos.map(norm).filter(Boolean).map((f) => ({
    f, palabras: f.split(' ').filter(util),
  }))
}

/**
 * @returns {'dinero'|'tecnico'|'navegacion'|null}
 */
export function nivelDeSoporte(texto, { yaRegistrado = false } = {}) {
  if (!yaRegistrado) return null
  const t = String(texto || '')
  if (DINERO.test(t)) return 'dinero'
  if (TECNICO.test(t)) return 'tecnico'
  return elegirGuia(t, { paraRegistrado: true }) ? 'navegacion' : null
  /* Con las guías apagadas esto devuelve null y la pregunta de navegación
     sigue el camino de siempre: escalamiento a soporte. */
}

/** ¿Ya se le mandó una guía en esta conversación? Una por conversación. */
export function yaSeMandoGuia(historial = []) {
  return (historial || []).some((m) => m?.rol === 'bot' && /Paso \d+ de \d+|\/guias\//.test(m.texto || ''))
}

/** El texto que acompaña a las imágenes. Corto: las capturas hablan solas. */
export function textoDeGuia(slug, telefonoSoporte) {
  const g = GUIAS[slug]
  const t = g?.titulo ? g.titulo.replace(/^Cómo /, '') : 'los pasos'
  return `Le mando las capturas de ${t.charAt(0).toLowerCase()}${t.slice(1)}, paso a paso.\n\nSi algo no le sale, escriba al ${telefonoSoporte} y lo acompañan en vivo.`
}
