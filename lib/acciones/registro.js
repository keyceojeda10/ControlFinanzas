// lib/acciones/registro.js — «¿qué necesitas hacer aquí?»
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «La gente entra a un préstamo y no sabe cómo cancelarlo, renovarlo o
// gestionarlo, entonces escriben por WhatsApp para que se les envíe esa
// información.»
//
// Y tenía razón medida: en la ficha del préstamo hay unas veinte acciones
// repartidas en TRES niveles de escondite. «Renovar» y «Cancelar» están en el
// tercero, dentro de la hoja «Gestión», detrás de un chip que dice «Gestión ·
// Renovar, plazo, ajustes». Quien no lo toque, no lo encuentra.
//
// ── LO QUE HACE Y LO QUE NO ───────────────────────────────────────────────
//
// RECONOCE Y LLEVA. No contesta cifras. Decisión del dueño y es la correcta:
// en una app de dinero, una respuesta redactada que se equivoca en un peso es
// peor que no contestar. Aquí no hay modelo, no hay latencia y no hay barrera
// de plan — importa, porque **402 de los 438 negocios están en Inicial o
// Básico** y no tienen acceso al asistente.
//
// ⚠ AQUÍ NO HAY REACT, Y ES A PROPÓSITO. El proveedor y los hooks viven en
// `components/acciones/AccionesProvider.jsx`. Las pruebas de este proyecto
// corren en `environment: 'node'` y leen los módulos como texto, así que un
// `.js` con JSX dentro ni siquiera se transforma: el emparejador, que es lo que
// hay que poder probar frase a frase, se queda limpio.

import { filtrarComandos, normalizar } from '@/lib/searchCommands'

/* ⚠ LAS PALABRAS DE RELLENO SON LA PIEZA QUE FALTABA.
 *
 * `filtrarComandos` ya puntúa bien, pero con varias palabras exige que TODAS
 * acierten en algún campo. Así, «quiero renovar este préstamo» daba CERO:
 * «quiero» y «este» no aparecen en ninguna etiqueta. Y esa es exactamente la
 * forma en que la gente escribe cuando pregunta por WhatsApp.
 *
 * Quitándolas queda «renovar prestamo», que sí acierta. No hace falta un
 * modelo para esto. */
const PALABRAS_VACIAS = new Set([
  'a', 'al', 'ante', 'aqui', 'como', 'con', 'cual', 'de', 'del', 'donde', 'e',
  'el', 'ella', 'ello', 'en', 'es', 'esa', 'ese', 'esta', 'este', 'esto', 'hacer',
  'hago', 'la', 'las', 'le', 'lo', 'los', 'me', 'mi', 'necesito', 'o', 'para',
  'pero', 'poder', 'por', 'porfa', 'porfavor', 'puedo', 'que', 'quiero', 'se',
  'ser', 'si', 'su', 'sus', 'te', 'tengo', 'un', 'una', 'uno', 'y', 'yo',
])

/**
 * Deja la frase en lo que de verdad busca: «¿cómo hago para cancelar este
 * préstamo?» → «cancelar prestamo».
 *
 * ⚠ Si al quitar el relleno no queda NADA —«¿cómo hago?»— se devuelve el texto
 * normalizado tal cual. Vaciarlo convertiría una pregunta en una búsqueda
 * vacía, que no encuentra nada y parece que el buscador está roto.
 */
export function limpiarFrase(texto = '') {
  const limpio = normalizar(texto).replace(/[¿?¡!.,;:]/g, ' ')
  const palabras = limpio.split(/\s+/).filter(Boolean)
  const utiles = palabras.filter((p) => !PALABRAS_VACIAS.has(p))
  return (utiles.length ? utiles : palabras).join(' ')
}

/**
 * Busca entre las acciones registradas. Reutiliza la puntuación de
 * `filtrarComandos` en vez de escribir otro buscador: dos emparejadores es
 * como se acaba con dos comportamientos distintos para lo mismo.
 */
export function buscarAcciones(acciones = [], texto = '', limite = 6) {
  const q = limpiarFrase(texto)
  if (!q) return []
  const disponibles = acciones.filter((a) => a.disponible !== false)
  // `filtrarComandos` habla de `label`/`sub`/`keywords`; se traduce y se
  // devuelve la acción original, con su `ejecutar`.
  const comoComandos = disponibles.map((a) => ({
    label: a.label,
    sub: a.pista || '',
    keywords: a.sinonimos || [],
    _accion: a,
  }))

  const fuertes = filtrarComandos(comoComandos, q, limite).map((c) => c._accion)
  if (fuertes.length >= limite) return fuertes

  /* ⚠ SEGUNDA PASADA: ACIERTO PARCIAL.
   *
   * `filtrarComandos` con varias palabras exige que acierten TODAS. Quitando el
   * relleno se salvan casi todas las frases, pero no las que llevan una palabra
   * de más que sí significa algo: «quiero prestarle más a este cliente» queda en
   * «prestarle mas cliente», y «cliente» no aparece en la acción de renovar.
   * Meter «cliente» en las palabras vacías sería peor — en otras pantallas es
   * justo lo que se busca.
   *
   * Aquí se puntúa por la PROPORCIÓN de palabras que aciertan, y se exige
   * mayoría (más de la mitad) para no devolver cualquier cosa que comparta una
   * palabra suelta. Va detrás de las fuertes, nunca por delante. */
  const terminos = q.split(/\s+/).filter(Boolean)
  if (terminos.length < 2) return fuertes

  /* ⚠ EL VERBO NO VIENE EN INFINITIVO ────────────────────────────────────
   * Nadie escribe «agregar cliente»: escribe «cómo AGREGO un cliente». Y
   * `includes` no une «agrego» con «agregar», así que la frase más natural que
   * hay para crear un cliente no encontraba nada. Pasa igual con elimino /
   * eliminar, reagendo / reagendar, suspendo / suspender.
   *
   * Se acepta la coincidencia cuando comparten los primeros 5 caracteres. Cinco
   * y no menos: con 4, «cobr» junta cobrar con cobrador, y con 3 junta casi
   * todo. La raíz de un verbo español conjugado sobrevive a esos 5. */
  const RAIZ = 5
  const acierta = (h, t) => {
    if (h.includes(t)) return true
    if (t.length < RAIZ) return false
    const raiz = t.slice(0, RAIZ)
    return h.split(/\s+/).some((pal) => pal.length >= RAIZ && pal.startsWith(raiz))
  }

  const yaEsta = new Set(fuertes.map((a) => a.id))
  const parciales = []
  for (const cmd of comoComandos) {
    if (yaEsta.has(cmd._accion.id)) continue
    const heno = [normalizar(cmd.label), normalizar(cmd.sub),
      ...cmd.keywords.map(normalizar)]
    const aciertos = terminos.filter((t) => heno.some((h) => acierta(h, t))).length
    if (aciertos / terminos.length > 0.5) parciales.push({ a: cmd._accion, aciertos })
  }
  parciales.sort((x, y) => y.aciertos - x.aciertos)
  return [...fuertes, ...parciales.map((p) => p.a)].slice(0, limite)
}
