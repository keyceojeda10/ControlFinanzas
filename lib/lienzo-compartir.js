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
  canvas.toBlob((blob) => {
    if (!blob) return
    const file = new File([blob], archivo, { type: 'image/png' })
    if (!compartirArchivo(file, { titulo, texto })) descargarDatos(canvas.toDataURL('image/png'), archivo)
  }, 'image/png')
  return true
}

/**
 * Manda un archivo YA PREPARADO por la hoja del teléfono.
 *
 * ⚠ ES SÍNCRONA A PROPÓSITO. `navigator.share` exige el gesto del usuario, y
 *   preparar el PNG dentro del toque —el `toBlob` de arriba— rompe la cadena
 *   del gesto en iOS, que lo rechaza sin decir nada. Quien pueda tener el
 *   archivo listo de antes (la vista previa del recibo lo tiene) debe llamar
 *   aquí y no a `compartirLienzo`.
 *
 * @returns true si se lanzó la hoja; false si este navegador no puede.
 */
export function compartirArchivo(file, { titulo, texto } = {}) {
  if (!file) return false
  let puede = false
  try {
    puede = Boolean(navigator.canShare && navigator.canShare({ files: [file] }))
  } catch {
    puede = false
  }
  if (!puede) return false
  navigator.share({ files: [file], title: titulo, text: texto }).catch(() => { /* canceló */ })
  return true
}

/** Descarga un `data:` o un `blob:` con el nombre dado. El respaldo de siempre:
    sin hoja de compartir —escritorio, navegadores viejos— un botón que no hace
    nada visible se lee como averiado. */
export function descargarDatos(url, nombre) {
  if (!url) return false
  const link = document.createElement('a')
  link.download = nombre || 'imagen.png'
  link.href = url
  link.click()
  return true
}

/** ¿Es un iPhone o un iPad? (El iPad nuevo se presenta como Mac con pantalla táctil.) */
export function esIOS(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false
  return /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1)
}

/**
 * GUARDAR UNA IMAGEN EN EL TELÉFONO (inducción del 18 nov 2026).
 *
 * «Desde el botón guardar no pudo guardar el recibo: hacía como que sí, pero
 * nunca guardó nada» — y él le enseñó la galería. En el iPhone una descarga
 * (`<a download>`) no llega a Fotos: Safari la deja en la app Archivos, o abre
 * una vista previa. Lo que sí llega a Fotos es la hoja de compartir del propio
 * teléfono, con su «Guardar imagen», que es justo lo que les funcionó.
 *
 * Así que en iOS «Guardar» abre esa hoja con el archivo solo (sin texto: con
 * texto, algunas opciones lo toman como un mensaje y «Guardar imagen» baja de
 * sitio). En lo demás —Android, el computador— descarga como siempre, que ahí
 * sí va a la galería o a Descargas.
 *
 * ⚠ Síncrona, por lo mismo que `compartirArchivo`: el archivo tiene que venir
 *   preparado de antes del toque.
 *
 * @returns true si se lanzó algo.
 */
export function guardarImagen({ file, url, nombre } = {}, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (esIOS(nav) && file) {
    let puede = false
    try { puede = Boolean(nav.canShare && nav.canShare({ files: [file] })) } catch { puede = false }
    if (puede) {
      nav.share({ files: [file] }).catch(() => { /* canceló */ })
      return true
    }
  }
  return descargarDatos(url, nombre)
}
