// lib/bot-v2/soporte.js — LO QUE EL BOT NO CONTESTA NUNCA.
//
// ══ EL HUECO ════════════════════════════════════════════════════════════════
//
// Medido en producción el 2 sep 2026: 204 preguntas de gente YA REGISTRADA, en
// cuatro grupos casi iguales. El más grande (27 %) es «cómo hago tal cosa».
//
// Eso se contesta con el VÍDEO del tema (`videos.js`). Aquí queda lo que NO se
// contesta solo, que son las otras dos clases de pregunta:
//
//   DINERO   «no me cuadra la caja», «por qué me da este saldo» → una persona.
//            Es la regla de oro del sistema: si el bot se inventa esto, el
//            prestamista descuadra su plata de verdad y se la lleva a la calle.
//   TÉCNICO  «no me abre», «me da error» → una persona. Un «reinicie e intente»
//            del bot pierde al cliente.
//
// ⚠ HUBO UN TERCER NIVEL, «navegación», que mandaba una de las 35 guías de
//   capturas. Se retiró el 8 sep 2026: las capturas eran del 15 de agosto y la
//   interfaz había cambiado —la guía decía «toca Nuevo cliente» y ese botón ya
//   no existe—. Decisión del dueño: «las capturas no son necesarias si ya
//   tenemos los vídeos… redundarían y serían mucho más difíciles de mantener».
//   Un vídeo se regraba entero cuando cambia la pantalla; 119 capturas
//   anotadas, no.

/* Preguntas de plata: van antes que nada. Que exista un vídeo de cuadrar la
   caja no autoriza a decidir por qué HOY no le cuadra a este señor. */
const DINERO = /\bno me cuadra\b|\bno cuadra\b|\bdescuadr|\bpor que me (?:da|sale|aparece|figura|cobra)\b|\bpor que (?:me )?(?:esta|est[aá]) (?:mal|malo)\b|\bmal (?:el|la) (?:saldo|cuenta|total|cifra|mora|interes)\b|\bsaldo (?:en )?negativo\b|\bme (?:falta|sobra) (?:plata|dinero)\b|\bno me (?:suma|resta|calcula)\b|\bcalcul[oó] mal\b|\bestá mal (?:el|la)\b|\besta mal (?:el|la)\b|\bdiferencia en (?:la caja|el cuadre)\b/i

const TECNICO = /\bno (?:me )?(?:abre|carga|funciona|sirve|deja entrar|deja ingresar)\b|\bme (?:da|sale|aparece) (?:un )?error\b|\bse (?:me )?(?:cierra|traba|congela|cae|apaga)\b|\bno puedo (?:entrar|ingresar|abrir)\b|\bpantalla (?:en )?blanc|\bse me borr|\bperd[ií] (?:los|mis) datos\b/i

/**
 * @returns {'dinero'|'tecnico'|null}  null = sigue el camino normal.
 */
export function nivelDeSoporte(texto, { yaRegistrado = false } = {}) {
  if (!yaRegistrado) return null
  const t = String(texto || '')
  if (DINERO.test(t)) return 'dinero'
  if (TECNICO.test(t)) return 'tecnico'
  return null
}
