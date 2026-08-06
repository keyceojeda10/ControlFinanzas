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
import { dibujarRecibo } from '@/components/ui/BotonCompartirRecibo'

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

/**
 * Guarda el recibo como imagen. En el móvil abre la hoja de compartir con el
 * PNG ya adjunto (WhatsApp sale ahí, sin pasar por descargas); en escritorio lo
 * descarga.
 */
export function guardarReciboImagen({ cliente, prestamo, pago, orgNombre = '', camposRecibo }) {
  let canvas
  try {
    canvas = dibujarRecibo(cliente, prestamo, pago, orgNombre, camposRecibo)
  } catch {
    return false
  }
  const nombre = `Recibo-${(cliente?.nombre || 'pago').replace(/\s+/g, '-')}.png`
  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], nombre, { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Comprobante de pago',
          text: `Comprobante de pago${orgNombre ? ` - ${orgNombre}` : ''}`,
        })
      } catch { /* el usuario canceló */ }
      return
    }
    const link = document.createElement('a')
    link.download = nombre
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, 'image/png')
  return true
}
