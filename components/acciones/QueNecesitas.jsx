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
import { useAcciones } from './AccionesProvider'

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
  const encontradas = useMemo(() => buscarAcciones(acciones, texto, 5), [acciones, texto])
  const buscando = texto.trim().length >= 2

  // Sin nada registrado no se pinta: una caja que nunca encuentra nada es peor
  // que no tenerla.
  if (!acciones.length) return null

  /* ⚠ EJECUTAR NO ES SUFICIENTE: HAY QUE LLEVAR.
   *
   * Reportado con captura y flecha: se escribe «Gest», sale «Ver y gestionar
   * los pagos», se pulsa y NO PASA NADA. Y sí pasaba — abría el acordeón del
   * historial, que vive 1.500px más abajo. El estado cambiaba, la pantalla no
   * se movía, y desde arriba eso se lee como un botón roto.
   *
   * Un modal se ve solo. Lo que se abre DENTRO de la página hay que ir a
   * enseñarlo: la acción declara `llevarA` con el id de su destino. */
  const ejecutarYLlevar = (a) => {
    a.ejecutar?.()
    if (!a.llevarA) return
    // Con retraso: React todavía no ha pintado lo que se acaba de abrir.
    setTimeout(() => {
      document.getElementById(a.llevarA)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  return (
    /* 46 de alto y radio de control (14): la misma medida que el buscador de
       clientes y que el conmutador de vista. Antes era una tarjeta de 18 con
       padding propio, y en una fila con ellos desentonaba. */
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
              onClick={() => { setTexto(''); ejecutarYLlevar(a) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, width: '100%', textAlign: 'left', font: 'inherit',
                padding: '10px 10px', border: 0, borderRadius: 12,
                background: 'var(--cf-surface)', cursor: 'pointer',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)' }}>
                  {a.label}
                </span>
                {a.pista && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 1 }}>
                    {a.pista}
                  </span>
                )}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
                stroke="var(--cf-ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}

          {/* ⚠ NUNCA EL VACÍO. Quedarse en blanco es lo que hoy manda a la gente
              a escribir por WhatsApp, que es justo lo que esto viene a evitar. */}
          {encontradas.length === 0 && (
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
  )
}
