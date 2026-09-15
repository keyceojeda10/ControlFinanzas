'use client'

// components/recibos/HojaReciboPrevio.jsx
//
// ══ EL RECIBO SE VE ANTES DE MANDARSE, Y SE AJUSTA AQUÍ MISMO ══════════════
//
// «no muestra una vista previa de la imagen antes de compartir como en nequi o
//  así» — el dueño, 14 sep 2026.
//
// Hasta ahora «Compartir recibo» disparaba la hoja del teléfono con el PNG ya
// adjunto y el cobrador no veía el papel hasta que estaba en el chat del
// cliente. Si salía un dato mal ya no había vuelta atrás: el mensaje estaba
// mandado. El patrón es el de la app del banco: se ve, y desde ahí se manda.
//
// ── Y EL AJUSTE VIVE DONDE SE VE ──────────────────────────────────────────
//
// «no hay una opción intuitiva que deje personalizar ese recibo en foto; el
//  lugar correcto para hacer ese ajuste sería acá» — el dueño, 15 sep 2026,
//  señalando esta misma hoja.
//
// El checklist de campos ya gobernaba las dos superficies —la imagen y el
// térmico— pero vivía en Configuración y en la ficha del préstamo, o sea lejos
// de donde se descubre el problema. Quien acaba de ver el recibo y quiere
// quitarle una línea tiene que salir, buscar una pantalla de ajustes y volver.
// Ahora se toca «Qué sale en el recibo», se apaga la línea, y el papel de
// arriba cambia en el acto.
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
import { ChecklistCamposRecibo, getDefaultCampos } from '@/components/recibos/CamposReciboEditor'

/* El nombre del archivo es lo que ve el cliente en el chat y lo que queda en la
   galería del cobrador. «Recibo-Juan-Perez.png» dice de quién es sin abrirlo. */
function nombreDelArchivo(cliente) {
  const quien = String(cliente?.nombre || 'pago').trim().replace(/\s+/g, '-')
  return `Recibo-${quien}.png`
}

const ICONO_AJUSTES = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)

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
  const [ajustando, setAjustando] = useState(false)
  const [aviso, setAviso] = useState('')
  const archivoRef = useRef(null)

  /* Los campos que se están viendo AHORA. Nacen de los del negocio o del
     cliente —lo que llegue por prop— y se editan aquí mismo. */
  const [campos, setCampos] = useState(null)
  const enUso = campos ?? (Array.isArray(camposRecibo) && camposRecibo.length > 0 ? camposRecibo : getDefaultCampos())

  /* ⚠ LOS DATOS SE LEEN DEL REF, NO DE LAS DEPENDENCIAS. Quien monta esta hoja
     le pasa objetos recién creados en cada render —`{...datosDelComprobante()}`
     en la ruta, el préstamo entero en la ficha—, así que un efecto que
     dependiera de ellos redibujaría el PNG sin parar mientras la hoja está
     abierta. El recibo se dibuja al abrirla y cuando cambian los CAMPOS, que es
     lo único que el usuario puede tocar desde dentro. */
  const datosRef = useRef(null)
  useEffect(() => {
    datosRef.current = { dibujar, cliente, prestamo, pago, orgNombre, campos: enUso }
  })

  /* La firma de los campos: dos listas con los mismos campos en el mismo orden
     no tienen por qué ser el mismo objeto, y comparar por referencia redibujaría
     de más. */
  const firma = JSON.stringify(enUso.map((c) => [c.tipo, c.campo ?? c.nombre, c.nombre]))

  useEffect(() => {
    if (!abierta) return
    const d = datosRef.current
    let vivo = true
    setError(false)
    setImagen(null)
    archivoRef.current = null

    let lienzo
    try {
      lienzo = d.dibujar(d.cliente, d.prestamo, d.pago, d.orgNombre, d.campos)
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
  }, [abierta, firma])

  // Al cerrar, la hoja vuelve a empezar por el recibo, no por los ajustes.
  useEffect(() => { if (!abierta) { setAjustando(false); setAviso('') } }, [abierta])

  /* ── QUE EL AJUSTE SE QUEDE HECHO ─────────────────────────────────────────
   *
   * «poder hacer que el ajuste se guarde para no tener que hacerlo en cada
   *  recibo». Se guarda como la plantilla del negocio, que es la que usan
   *  todos sus recibos a partir de ese momento.
   *
   * ⚠ SOLO EL ADMINISTRADOR PUEDE. El endpoint contesta 403 a un cobrador, y
   *   está bien: la plantilla es del negocio, no de quien va en la calle. En
   *   ese caso el cambio se queda para ESTE recibo y se dice, en vez de fallar
   *   en silencio y que crea que se guardó.
   */
  const guardar = async (next) => {
    setCampos(next)
    setAviso('')
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposRecibo: next }),
      })
      if (res.status === 403) { setAviso('Este cambio vale solo para este recibo: guardarlo para todos lo hace el administrador.'); return }
      if (!res.ok) { setAviso('No se pudo guardar para los próximos recibos, pero este ya cambió.'); return }
      setAviso('Guardado: tus próximos recibos salen así.')
    } catch {
      setAviso('Sin conexión: el cambio vale para este recibo.')
    }
  }

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
      titulo={ajustando ? 'Qué sale en el recibo' : 'Así queda el recibo'}
      subtitulo={ajustando ? 'Apaga lo que no quieras que vea el cliente.' : 'Míralo antes de mandarlo.'}
      onVolver={ajustando ? () => setAjustando(false) : undefined}
      accion={
        ajustando ? (
          <BotonPrimario style={{ flex: 1 }} onClick={() => setAjustando(false)}>
            Ver cómo queda
          </BotonPrimario>
        ) : (
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
        )
      }
    >
      {ajustando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ChecklistCamposRecibo campos={enUso} onChange={guardar} />
          {aviso && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>{aviso}</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              /* El hueco mide lo MISMO que el recibo (9:16), así que la hoja no
                 da un salto cuando entra la imagen. */
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

          {/* La entrada al ajuste, DEBAJO del recibo: primero se ve el papel, y
              solo si algo no gusta se toca esto. Arriba competiría con él. */}
          <button
            type="button"
            onClick={() => setAjustando(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', height: 44, cursor: 'pointer',
              borderRadius: 'var(--cf-r-control)',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)',
            }}
          >
            {ICONO_AJUSTES}
            Qué sale en el recibo
          </button>
          {aviso && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-3)', textAlign: 'center' }}>{aviso}</p>
          )}
        </div>
      )}
    </HojaInferior>
  )
}
