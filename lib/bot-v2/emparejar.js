// lib/bot-v2/emparejar.js — CASAR LO QUE ESCRIBE LA GENTE CON UN CATÁLOGO.
//
// Nació dentro del selector de guías visuales. Cuando esas guías se retiraron
// —sus capturas envejecieron y los vídeos las sustituyen— el motor se quedó,
// porque es lo que hace que «Como se crea una ruta a ver» encuentre el
// tutorial de rutas.
//
// Tres cosas que costaron tres pasadas de medición contra mensajes reales:
//
//   1. Comparar por PALABRA COMPLETA, no por subcadena: «registro» cabe dentro
//      de «registrando» y con eso el catálogo entero se vuelve elástico.
//   2. Llevar los VERBOS a una forma sola: las claves están en infinitivo
//      («crear ruta») y la gente escribe conjugado («cómo se crea una ruta»),
//      que era literalmente la pregunta más frecuente y no casaba con nada.
//   3. Si dos entradas empatan, no se devuelve ninguna. Mejor nada que lo
//      equivocado.

/* Solo verbos que aparecen en los catálogos. «paso mis clientes» sí; «lo que
   pasa es que» no, que es la muletilla más común de Colombia y arrastraba
   preguntas enteras al sitio equivocado. */
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

export const norm = (t) => canon(String(t || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'un', 'una', 'los', 'las', 'del', 'al', 'por', 'para', 'con', 'que', 'como', 'mi', 'su', 'lo', 'se', 'en', 'y', 'o', 'a'])
/* Cortas pero con significado: sin esto, «descargar app» solo aportaba una
   palabra útil y no llegaba al mínimo. */
const CORTAS_UTILES = new Set(['app', 'pdf', 'iva', 'sms', 'mes', 'dia', 'pin'])
const util = (w) => (w.length > 3 || CORTAS_UTILES.has(w)) && !PALABRAS_VACIAS.has(w)

export const tienePalabra = (t, w) => new RegExp(`(?:^|\\s)${w}(?:s|es)?(?:$|\\s)`).test(t)

/** ¿Está preguntando cómo se hace algo? Nombrar una función no basta. */
export const PIDE_COMO = /\bcomo\b|\bc[oó]mo\b|\bdonde\b|\bd[oó]nde\b|\bse puede\b|\bpuedo\b|\bse hace\b|\bhago\b|\bhacer\b|\bme ayuda\b|\bme explica\b|\bme ense[ñn]a\b|\bpasos\b|\bmanera de\b|\bforma de\b|\bqu[eé] hago\b|\bque hago\b|\bno (?:se|s[eé]) (?:como|c[oó]mo)\b|\bensename\b|\bense[ñn]eme\b/i

export function frasesDe(textos) {
  return textos.map(norm).filter(Boolean).map((f) => ({ f, palabras: f.split(' ').filter(util) }))
}

/**
 * La entrada del catálogo que mejor casa, o null si ninguna destaca.
 * Puntúa la frase entera del catálogo dentro del texto por encima de sus
 * palabras sueltas, y devuelve null ante un empate.
 */
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
