'use client'
// components/acciones/QueNecesitas.jsx — la caja de «¿qué necesitas hacer aquí?»
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// Es la entrada para quien NO sabe que existe un buscador. El mismo motor que
// el Ctrl+K, pero a la vista dentro de la pantalla, que es donde está la
// persona cuando se atasca.
//
// ⚠ NO ES UN CHAT. Reconoce y lleva: escribes «quiero renovar este préstamo» y
// se abre la hoja de renovar. No redacta respuestas ni dice cifras — en una app
// de dinero una cifra redactada que se equivoca es peor que no contestar.
//
// El plegado importa: la ficha del préstamo ya está llena, así que en reposo es
// una línea. Solo crece cuando se escribe.

import { useMemo, useState } from 'react'
import { buscarAcciones } from '@/lib/acciones/registro'
import { buscarGuias } from '@/lib/tutoriales/guias'
import ModalGuia from '@/components/tutoriales/ModalGuia'
import { useAcciones, ejecutarAccion } from './AccionesProvider'

/* La misma fila para la acción y para la guía: lo que las separa es el signo
   de interrogación, no la forma de la caja. */
const FILA = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 10, width: '100%', textAlign: 'left', font: 'inherit',
  padding: '10px 10px', border: 0, borderRadius: 12,
  background: 'var(--cf-surface)', cursor: 'pointer',
}

/* El titulo y la pista de una fila, escritos UNA vez. Repetirlos era ademas
   duplicar el `14.5`, que es un tamaño fuera de la escala y esta contado. */
const TITULO = { display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)' }
const PISTA = { display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 1 }

const LUPA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
)

export default function QueNecesitas({
  titulo = '¿Qué necesitas hacer aquí?',
  ejemplos = ['renovar', 'cancelar', 'cambiar el plazo'],
}) {
  const acciones = useAcciones()
  const [texto, setTexto] = useState('')
  /* ⚠ EN REPOSO ES UNA LÍNEA, Y ANTES NO LO ERA.
     El comentario de arriba decía «en reposo es una línea» y eran dos: la de
     ejemplos solo se escondía al escribir. Medido en la lista de clientes:
     83px por delante del título, y el texto partido en dos renglones a 412px.
     Ahora los ejemplos salen al TOCAR el campo, que es cuando hacen falta. */
  const [enfocado, setEnfocado] = useState(false)
  /* La guía abierta. Se pinta encima de la pantalla en la que estás: eso es
     todo el pedido — «que no me mande a ningún lado, sino que allí mismo me
     salga un modal». */
  const [guia, setGuia] = useState(null)
  const encontradas = useMemo(() => buscarAcciones(acciones, texto, 5), [acciones, texto])
  /* ⚠ LAS GUÍAS FALTABAN ENTERAS, y era la mitad del trabajo de esta caja.
     El dueño: «si alguien quiere saber cómo renovar con un tutorial, no va a
     poder porque no sale. Sale la opción rápida de que lo lleva a renovar el
     préstamo, pero no le explica cómo». Las 34 guías existían y solo las
     conocía el buscador general.

     Van DETRÁS de las acciones y son dos como mucho: primero hacer, después
     aprender a hacerlo. Una guía por delante convierte un toque en una lectura. */
  const guias = useMemo(() => buscarGuias(texto, 2, acciones), [texto, acciones])
  const buscando = texto.trim().length >= 2

  // Sin nada registrado no se pinta: una caja que nunca encuentra nada es peor
  // que no tenerla.
  if (!acciones.length) return null

  const vacio = buscando && encontradas.length === 0 && guias.length === 0

  return (
    <>
    {/* 46 de alto y radio de control (14): la misma medida que el buscador de
        clientes y que el conmutador de vista. Antes era una tarjeta de 18 con
        padding propio, y en una fila con ellos desentonaba. */}
    <div
      style={{
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-control)',
      }}
    >
      <label style={{
        display: 'flex', alignItems: 'center', gap: 9,
        height: 46, padding: '0 14px',
      }}>
        <span style={{ color: 'var(--cf-ink-3)', display: 'flex' }}>{LUPA}</span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setEnfocado(true)}
          /* Con retraso: sin él, el `blur` de tocar un resultado lo esconde
             antes de que el clic llegue a dispararse. */
          onBlur={() => setTimeout(() => setEnfocado(false), 150)}
          placeholder={titulo}
          /* ⚠ `type="text"`, no `search`: el navegador le pone su propia X y su
             propio alto, y deja de parecerse al resto de campos de la app. */
          type="text"
          inputMode="text"
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
            font: 'inherit', fontSize: 15, color: 'var(--cf-ink)',
          }}
        />
      </label>

      {buscando && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {encontradas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setTexto(''); ejecutarAccion(a) }}
              style={FILA}
            >
              <span style={{ minWidth: 0 }}>
                <span style={TITULO}>{a.label}</span>
                {a.pista && (
                  <span style={PISTA}>{a.pista}</span>
                )}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
                stroke="var(--cf-ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}

          {/* ── Y CÓMO SE HACE ──
              El signo de interrogación distingue de un vistazo la explicación
              de la acción: son dos cosas distintas y la de arriba se pulsa mil
              veces más. No abre otra pantalla — abre la guía encima de ésta. */}
          {guias.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { setTexto(''); setGuia(g) }}
              style={FILA}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span aria-hidden style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, minWidth: 26, borderRadius: 999, flex: 'none',
                  background: 'var(--cf-fill)', color: 'var(--cf-ink-3)',
                  fontSize: 13, fontWeight: 800,
                }}>?</span>
                <span style={{ minWidth: 0 }}>
                  <span style={TITULO}>{g.title}</span>
                  <span style={PISTA}>Cómo se hace, con capturas</span>
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
                stroke="var(--cf-ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}

          {/* ⚠ NUNCA EL VACÍO. Quedarse en blanco es lo que hoy manda a la gente
              a escribir por WhatsApp, que es justo lo que esto viene a evitar. */}
          {vacio && (
            <p style={{ fontSize: 13, color: 'var(--cf-ink-3)', margin: '4px 2px 2px', lineHeight: 1.5 }}>
              No encontré eso aquí. Prueba con otra palabra, o mira las{' '}
              <a href="/tutoriales" style={{ color: 'var(--cf-gold-dark)', fontWeight: 600 }}>guías</a>.
            </p>
          )}
        </div>
      )}

      {enfocado && !buscando && ejemplos.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--cf-ink-4)', margin: 0, padding: '0 14px 10px 39px' }}>
          Escribe lo que quieres hacer: {ejemplos.join(', ')}…
        </p>
      )}
    </div>

    <ModalGuia guia={guia} onClose={() => setGuia(null)} />
    </>
  )
}
