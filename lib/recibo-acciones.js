// lib/recibo-acciones.js — imprimir y guardar el recibo, en un solo sitio.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El comprobante se alcanza por TRES caminos —el cobro desde la ruta, la ficha
// del préstamo y el cobro por QR— y hasta ahora cada uno resolvía «imprimir» y
// «guardar imagen» por su cuenta:
//
//   · la ficha y el QR lo hacían con `<BotonImprimirRecibo>` y
//     `<BotonCompartirRecibo>`, dos componentes-botón que traen su propio
//     aspecto pegado a la acción;
//   · la ruta **no lo hacía**: montaba el `Recibo` sin `onGuardarImagen` ni
//     `onImprimir`, así que sus dos botones secundarios no hacían NADA. Ese
//     fallo llevaba ahí desde que se montó la pantalla y no lo había visto
//     nadie —los botones se pintan igual, con o sin la función detrás—.
//
// La acción vive aquí y el aspecto en quien la llama. Es la misma salida que ya
// se usó con `lib/recibo-derivados.js`, y por la misma razón: el recibo de
// WhatsApp se arregló y la IMAGEN se quedó con el fallo, porque las funciones
// eran privadas de un fichero. Cuando algo se ve por varios caminos, la lógica
// va donde todos la alcancen.
import { generarHTMLRecibo } from '@/components/ui/BotonImprimirRecibo'

/** Abre la ventana de impresión con el recibo del pago. */
export function imprimirRecibo({ cliente, prestamo, pago, orgNombre = '', camposRecibo }) {
  const html = generarHTMLRecibo(cliente, prestamo, pago, orgNombre, camposRecibo)
  const win = window.open('', '_blank')
  if (!win) return false   // bloqueado por el navegador

  win.document.open()
  win.document.write(html)
  win.document.close()

  /* Imprimir UNA vez. El `setTimeout` corre en la ventana padre, así que el
     `print()` del hijo no lo bloquea: cuando `onload` disparaba —lo normal en
     escritorio— el cobrador cerraba el diálogo y le salía un SEGUNDO. El
     pestillo deja el respaldo para cuando `onload` no llega. */
  let yaImprimio = false
  const unaVez = () => {
    if (yaImprimio) return
    yaImprimio = true
    win.focus()
    win.print()
  }
  win.onload = unaVez
  setTimeout(unaVez, 500)
  return true
}

/* ⚠ AQUÍ VIVÍA `guardarReciboImagen`, y se fue el 14 sep 2026.
 *
 * Mandaba el PNG a la hoja del teléfono en el mismo toque, así que el cobrador
 * no veía el papel hasta que ya estaba en el chat del cliente. Ahora los tres
 * caminos abren `components/recibos/HojaReciboPrevio.jsx` —se ve el recibo y
 * desde ahí se manda o se guarda— y el trabajo de entregar el archivo vive en
 * `lib/lienzo-compartir.js`, que es donde ya estaba la mitad.
 *
 * No se deja una envoltura por compatibilidad: una función exportada que nadie
 * llama es la siguiente que alguien cablea por error.
 */
