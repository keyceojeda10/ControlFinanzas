'use client'

/* La ayuda de la pantalla (Adenda 6, E): se abre al tocar la pastilla «▶ 5».
 *
 *   Arriba, «Empieza aquí»: el video de la pantalla, con su portada. Da el
 *   contexto de todos los demás.
 *   Debajo, «Lo que puedes hacer aquí»: un video por función, en el orden del
 *   catálogo (el de la pantalla). La lista es un mapa de la pantalla.
 *   Al pie, la salida a la biblioteca con todos los videos de la app.
 *
 * Los vistos llevan check verde y el texto apagado: se pueden volver a ver,
 * pero dejan de pedir atención. */

import { createPortal } from 'react-dom'
import HojaInferior from '@/components/cf/HojaInferior'
import { reloj } from '@/lib/tutoriales/profe'
import { IconoPlay } from './PiezasProfe'

export default function HojaAyudaProfe({ ayuda, vistos, onAbrir, onBiblioteca, onCerrar }) {
  const { general, funciones, todos } = ayuda
  const vistosAqui = todos.filter((v) => vistos.has(v.id)).length
  const rotulo = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }

  // Encima del menú del + (z 90), como el reproductor.
  return createPortal(
    <div style={{ position: 'relative', zIndex: 95 }}>
    <HojaInferior
      abierta
      onCerrar={onCerrar}
      titulo="Ayuda de esta pantalla"
      subtitulo={`${todos.length} videos · viste ${vistosAqui}`}
      accion={
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Todos los videos de la app</span>
          <button type="button" onClick={onBiblioteca} style={{
            height: 44, padding: '0 16px', borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
            fontSize: 14, fontWeight: 600, background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)',
          }}>Biblioteca</button>
        </div>
      }
    >
      {general && (
        <button type="button" onClick={() => onAbrir(general.id)} style={{
          display: 'flex', alignItems: 'stretch', gap: 0, padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <span aria-hidden style={{ position: 'relative', width: 96, minHeight: 104, flex: 'none', background: '#22232A' }}>
            {general.poster && <img src={general.poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />}
            <span style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: 999,
              background: 'var(--cf-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--cf-gold-ink)"><path d="M7 4.5v15l13-7.5z" /></svg>
            </span>
            <span className="cf-fig" style={{
              position: 'absolute', right: 6, bottom: 6, padding: '1px 6px', borderRadius: 6,
              background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700,
            }}>{reloj(general.duracion)}</span>
          </span>
          <span style={{ flex: 1, minWidth: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
            <span style={{ ...rotulo, color: 'var(--cf-gold-dark)' }}>{vistos.has(general.id) ? 'Ya lo viste' : 'Empieza aquí'}</span>
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: 'var(--cf-ink)' }}>{general.pregunta || general.titulo}</span>
          </span>
        </button>
      )}

      {funciones.length > 0 && (
        <>
          <span style={{ ...rotulo, marginTop: general ? 6 : 0 }}>Lo que puedes hacer aquí</span>
          <div style={{ borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)', overflow: 'hidden' }}>
            {funciones.map((v, i) => {
              const visto = vistos.has(v.id)
              return (
                <button key={v.id} type="button" onClick={() => onAbrir(v.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '8px 14px',
                  border: 0, borderTop: i ? '1px solid var(--cf-border)' : 0, background: 'none',
                  textAlign: 'left', cursor: 'pointer', font: 'inherit',
                }}>
                  <IconoPlay tam={30} radio={8} visto={visto} verde />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: visto ? 'var(--cf-ink-3)' : 'var(--cf-ink)' }}>
                    {v.pregunta || v.titulo}
                  </span>
                  <span className="cf-fig" style={{ fontSize: 13, color: 'var(--cf-ink-3)', fontVariantNumeric: 'tabular-nums' }}>{reloj(v.duracion)}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </HojaInferior>
    </div>,
    document.body,
  )
}
