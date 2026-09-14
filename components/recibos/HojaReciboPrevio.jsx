'use client'

// components/recibos/HojaReciboPrevio.jsx
//
// ══ EL RECIBO SE VE ANTES DE MANDARSE ══════════════════════════════════════
//
// «no muestra una vista previa de la imagen antes de compartir como en nequi o
//  así» — el dueño, 14 sep 2026.
//
// Hasta ahora «Compartir recibo» disparaba la hoja del teléfono con el PNG ya
// adjunto y el cobrador no veía el papel hasta que estaba en el chat del
// cliente. Si salía un dato mal —el negocio sin nombre, una cédula de más, el
// campo que alguien quitó del checklist— ya no había vuelta atrás: el mensaje
// estaba mandado.
//
// El patrón es el de la app del banco: se ve el comprobante, y desde ahí se
// manda o se guarda.
//
// ⚠ `navigator.share` EXIGE EL GESTO DEL USUARIO. El PNG se prepara al abrir la
//   hoja y se guarda en un ref, para que el toque en «Compartir» llame a
//   `share` directamente. Si se generara el blob dentro del click, el `await`
//   rompe la cadena del gesto y iOS lo rechaza sin decir nada.
//
// ⚠ LA HOJA SE MONTA SIEMPRE, no dentro de un `&&`: una hoja montada en el
//   mismo cuadro en que se abre pinta su primer fotograma fuera de la pantalla.
//   Ver [[hoja_inferior_primer_cuadro]].
//
// ⚠ EL DIBUJO ENTRA POR `dibujar`, no se importa. `BotonCompartirRecibo` monta
//   esta hoja, así que importar `dibujarRecibo` de allí cerraría un círculo
//   entre los dos módulos. Y de paso la hoja sirve para cualquier lienzo.

import { useEffect, useRef, useState } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { BotonPrimario, BotonSecundario } from '@/components/cf/primitivos'
import { compartirArchivo, descargarDatos } from '@/lib/lienzo-compartir'

/* El nombre del archivo es lo que ve el cliente en el chat y lo que queda en la
   galería del cobrador. «Recibo-Juan-Perez.png» dice de quién es sin abrirlo. */
function nombreDelArchivo(cliente) {
  const quien = String(cliente?.nombre || 'pago').trim().replace(/\s+/g, '-')
  return `Recibo-${quien}.png`
}

export default function HojaReciboPrevio({
  abierta,
  onCerrar,
  /** `(cliente, prestamo, pago, orgNombre, camposRecibo) => HTMLCanvasElement` */
  dibujar,
  cliente,
  prestamo,
  pago,
  orgNombre = '',
  camposRecibo,
}) {
  const [imagen, setImagen] = useState(null)
  const [error, setError] = useState(false)
  const [puedeCompartir, setPuedeCompartir] = useState(false)
  const archivoRef = useRef(null)

  /* ⚠ LOS DATOS SE LEEN DEL REF, NO DE LAS DEPENDENCIAS. Quien monta esta hoja
     le pasa objetos recién creados en cada render —`{...datosDelComprobante()}`
     en la ruta, el préstamo entero en la ficha—, así que un efecto que
     dependiera de ellos redibujaría el PNG sin parar mientras la hoja está
     abierta. El recibo se dibuja UNA VEZ, al abrirla: es una foto de lo que se
     va a mandar, no una ventana que se actualiza sola. */
  const datosRef = useRef(null)
  useEffect(() => {
    datosRef.current = { dibujar, cliente, prestamo, pago, orgNombre, camposRecibo }
  })

  useEffect(() => {
    if (!abierta) return
    const d = datosRef.current
    let vivo = true
    setError(false)
    setImagen(null)
    archivoRef.current = null

    let lienzo
    try {
      lienzo = d.dibujar(d.cliente, d.prestamo, d.pago, d.orgNombre, d.camposRecibo)
    } catch {
      setError(true)
      return
    }

    /* La vista y el archivo salen del MISMO lienzo. Dibujarlo dos veces —una
       para mirar y otra para mandar— es como se acaba mandando algo distinto
       de lo que se vio. */
    setImagen(lienzo.toDataURL('image/png'))
    lienzo.toBlob((blob) => {
      if (!vivo || !blob) return
      const file = new File([blob], nombreDelArchivo(d.cliente), { type: 'image/png' })
      archivoRef.current = file
      try {
        setPuedeCompartir(Boolean(navigator.canShare && navigator.canShare({ files: [file] })))
      } catch {
        setPuedeCompartir(false)
      }
    }, 'image/png')

    return () => { vivo = false }
  }, [abierta])

  const compartir = () => {
    const ok = compartirArchivo(archivoRef.current, {
      titulo: 'Comprobante de pago',
      texto: `Comprobante de pago${orgNombre ? ` - ${orgNombre}` : ''}`,
    })
    if (!ok) descargar()
  }

  const descargar = () => descargarDatos(imagen, nombreDelArchivo(cliente))

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Así queda el recibo"
      subtitulo="Míralo antes de mandarlo."
      accion={
        /* Sin hoja de compartir —escritorio, navegadores viejos— guardar ES la
           acción principal. Un botón dorado que no hace nada se lee como
           averiado. */
        puedeCompartir ? (
          <>
            <BotonPrimario style={{ flex: 2, opacity: imagen ? 1 : 0.5 }} onClick={compartir} disabled={!imagen}>
              Compartir
            </BotonPrimario>
            <BotonSecundario style={{ flex: 1, opacity: imagen ? 1 : 0.5 }} onClick={descargar} disabled={!imagen}>
              Guardar
            </BotonSecundario>
          </>
        ) : (
          <BotonPrimario style={{ flex: 1, opacity: imagen ? 1 : 0.5 }} onClick={descargar} disabled={!imagen}>
            Guardar la imagen
          </BotonPrimario>
        )
      }
    >
      <div
        style={{
          background: 'var(--cf-surface)',
          borderRadius: 16,
          padding: 12,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <p style={{ color: 'var(--cf-ink-3)', fontSize: 14, textAlign: 'center', padding: '24px 8px' }}>
            No se pudo preparar la imagen. Vuelve a intentarlo.
          </p>
        ) : imagen ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imagen}
            alt="Vista previa del recibo"
            style={{
              width: '100%',
              maxWidth: 360,
              height: 'auto',
              display: 'block',
              borderRadius: 12,
              border: '1px solid var(--cf-border)',
            }}
          />
        ) : (
          /* El hueco mide lo MISMO que el recibo (9:16), así que la hoja no da
             un salto cuando entra la imagen. */
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              aspectRatio: '9 / 16',
              borderRadius: 12,
              background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)',
            }}
          />
        )}
      </div>
    </HojaInferior>
  )
}
