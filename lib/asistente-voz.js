/* CÓMO HABLA LUCAS. Puro, sin base de datos, para poder probarlo.
 *
 * SIN EMOJIS: la app no lleva ninguno —es regla de diseño, van SVG— y Lucas
 * saludaba con una mano amarilla en medio de una pantalla que no tiene ni uno.
 * Se le dice en el prompt Y se limpia a la salida: a un modelo se le pide, no
 * se le garantiza.
 *
 * «NO SUMES NI RESTES TÚ»: un modelo con «recaudado» y «gastos» delante hace la
 * resta que este sistema tiene prohibida. Las cifras ya vienen hechas. */
export const REGLAS_DE_VOZ = `- No uses emojis ni emoticonos. Nunca. La app no lleva ninguno.
- Puedes poner en **negrita** la cifra que importa. No uses títulos con # ni tablas: el chat no los pinta y salen como símbolos sueltos. Listas cortas con guion.
- Las cifras de arriba YA están calculadas con las reglas del sistema. Dilas tal cual; no sumes, restes ni estimes por tu cuenta. Si una cifra no está, di que no la tienes y en qué pantalla se ve.
- Usa las mismas palabras que la app: Inicio, Clientes, Rutas, Caja, Capital, Gastos, Reportes, Historial, Notificaciones.`

// Pictogramas, el selector de variante que los colorea y el pegamento (ZWJ) de
// los compuestos. NO toca letras, cifras, «$», «−» ni las flechas de texto.
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍]/gu

export function sinEmojis(texto) {
  if (typeof texto !== 'string' || !texto) return texto ?? ''
  return texto
    .replace(EMOJI, '')
    .replace(/(\S)[ \t]{2,}/g, '$1 ')     // el hueco que deja en medio de la frase
    .replace(/^ (?=\S)/gm, '')            // «👉 Dale» → « Dale»; una sangría de lista tiene dos o más
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]+$/gm, '')
}
