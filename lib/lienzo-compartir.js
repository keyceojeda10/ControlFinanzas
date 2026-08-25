// lib/lienzo-compartir.js
//
// ══ UN LIENZO, A WHATSAPP ══════════════════════════════════════════════════
//
// Convertir un `<canvas>` en un PNG y entregarlo por la hoja de compartir del
// teléfono, con descarga de respaldo donde no la hay.
//
// Estaba escrito dentro de `guardarReciboImagen` y ahora lo pide también la
// imagen de la simulación. Vive aquí para que sea UNA: si mañana hay que
// cambiar el tipo de archivo o cómo se nombra, se cambia en un sitio.

/**
 * @param canvas  el lienzo ya dibujado
 * @param nombre  nombre del archivo, con extensión
 * @param titulo  título de la hoja de compartir
 * @param texto   la línea que acompaña a la imagen en el chat
 * @returns true si se lanzó el intento; false si el lienzo no sirve
 */
export function compartirLienzo(canvas, { nombre, titulo, texto } = {}) {
  if (!canvas || typeof canvas.toBlob !== 'function') return false
  const archivo = nombre || 'imagen.png'
  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], archivo, { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: titulo, text: texto })
      } catch { /* el usuario canceló */ }
      return
    }
    /* Sin hoja de compartir —escritorio, navegadores viejos— se descarga. Un
       botón que no hace nada visible se lee como averiado. */
    const link = document.createElement('a')
    link.download = archivo
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, 'image/png')
  return true
}
