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
 * pero dejan de pedir atención.
 *
 * En el Inicio, además, «Ocultar todos los tutoriales» (Carlos, 20 oct 2026):
 * «con una confirmación que le diga que van a desaparecer todos los tutoriales
 * por el momento, y darle la ruta de donde los puede volver a aprender». Son
 * tres pasos en la MISMA hoja —la lista, la confirmación, el «listo» con la
 * ruta—: una segunda hoja encima es otra entrada de historia y otro velo. */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import HojaInferior, { useEscritorio } from '@/components/cf/HojaInferior'
import { reloj } from '@/lib/tutoriales/profe'
import { IconoPlay } from './PiezasProfe'

/* El ojo tachado (heroicons, contorno). */
function IconoOcultar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
      <path d="M3.98 8.22A10.48 10.48 0 0 0 1.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24-4.24-4.24" />
    </svg>
  )
}

const botonAccion = (dorado) => ({
  flex: dorado ? 1.4 : 1, height: 48, borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit', fontSize: 15,
  fontWeight: dorado ? 700 : 600,
  ...(dorado
    ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: 0 }
    : { background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)' }),
})

export default function HojaAyudaProfe({ ayuda, vistos, onAbrir, onBiblioteca, onCerrar, onOcultarTodo }) {
  const { general, funciones, todos } = ayuda
  const vistosAqui = todos.filter((v) => vistos.has(v.id)).length
  const rotulo = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }
  const [paso, setPaso] = useState('lista')            // 'lista' | 'confirmar' | 'listo'
  // Por dónde se vuelven a prender: en el teléfono, la pestaña Más; sentado, la
  // barra lateral (Más herramientas). Allí está la biblioteca con sus interruptores.
  const escritorio = useEscritorio()
  const ruta = escritorio ? 'Más herramientas › Tutoriales' : 'Más › Tutoriales'
  const parrafo = { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)', flex: 'none' }

  // ⚠ UNA sola hoja que cambia de contenido: con dos `return` distintos la hoja
  // se desmontaba y volvía a subir, como si se abriera otra.
  const confirmar = paso === 'confirmar'
  const listo = paso === 'listo'
  const titulo = confirmar ? '¿Ocultar todos los tutoriales?' : listo ? 'Listo, quedaron ocultos' : 'Ayuda de esta pantalla'
  const accion = confirmar ? (
    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
      <button type="button" style={botonAccion(true)}
        onClick={() => { onOcultarTodo?.(); setPaso('listo') }}>Sí, ocultarlos</button>
      <button type="button" style={botonAccion(false)} onClick={() => setPaso('lista')}>Cancelar</button>
    </div>
  ) : listo ? (
    <button type="button" style={{ ...botonAccion(true), flex: 1 }} onClick={onCerrar}>Entendido</button>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Todos los videos de la app</span>
      <button type="button" onClick={onBiblioteca} style={{
        height: 44, padding: '0 16px', borderRadius: 'var(--cf-r-control)', cursor: 'pointer', font: 'inherit',
        fontSize: 14, fontWeight: 600, background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)',
      }}>Biblioteca</button>
    </div>
  )
  const cuerpoOcultar = (
    <>
      {confirmar ? (
        <p style={parrafo}>
          Por ahora dejan de salir en todas las pantallas los botones de video y los avisos de la
          primera vez. No se borra nada: los videos siguen guardados.
        </p>
      ) : (
        <p style={parrafo}>Ya no te van a salir los botones de video ni los avisos.</p>
      )}
      <div style={{
        flex: 'none', display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px',
        borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      }}>
        <span style={rotulo}>Para volver a verlos</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{ruta}</span>
        <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
          Ahí están todos los videos, y prendiendo «Botones de video» vuelven a cada pantalla.
        </span>
      </div>
    </>
  )

  // Encima del menú del + (z 90), como el reproductor.
  return createPortal(
    <div style={{ position: 'relative', zIndex: 95 }}>
    <HojaInferior
      abierta
      onCerrar={onCerrar}
      titulo={titulo}
      subtitulo={paso === 'lista' ? `${todos.length} videos · viste ${vistosAqui}` : undefined}
      accion={accion}
    >
      {paso !== 'lista' ? cuerpoOcultar : (<>
      {general && (
        <button type="button" onClick={() => onAbrir(general.id)} style={{
          display: 'flex', alignItems: 'stretch', gap: 0, padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          flex: 'none',
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
          <span style={{ ...rotulo, marginTop: general ? 6 : 0, flex: 'none' }}>Lo que puedes hacer aquí</span>
          {/* ⚠ `flex: none`. El cuerpo de la hoja es una columna flex que se
              desliza: sin esto la lista se ENCOGÍA para caber, su `overflow:
              hidden` cortaba los últimos videos y no quedaba nada que deslizar
              («el último sale medio cortado y no da scroll», 19 oct 2026). */}
          <div style={{ borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)', background: 'var(--cf-card)', overflow: 'hidden', flex: 'none' }}>
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

      {onOcultarTodo && (
        <button type="button" onClick={() => setPaso('confirmar')} style={{
          flex: 'none', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 44, padding: '0 12px', marginTop: 4, border: 0, background: 'none', cursor: 'pointer',
          font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)',
        }}>
          <IconoOcultar />
          Ocultar todos los tutoriales
        </button>
      )}
      </>)}
    </HojaInferior>
    </div>,
    document.body,
  )
}
