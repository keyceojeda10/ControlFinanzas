'use client'

// components/cf/HojaInferior.jsx — El patrón de modal en móvil.
// docs/design_handoff/03-COMPONENTES.md § 10 y § 11.
//
// SIEMPRE desde abajo, nunca centrado. La página de atrás queda visible con su
// velo: el contexto ya está dado, así que la cabecera de la hoja NO repite el
// dato que ya está detrás — lo completa.
//
// En escritorio el mismo contenido se presenta como modal centrado de 520px.
// Es la única diferencia entre las dos presentaciones.

import { useEffect } from 'react'

export default function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  subtitulo,
  children,
  accion,                  // la barra de acción inferior
  escritorio = false,      // presentar como modal centrado
  alturaMaxima = '88vh',
}) {
  // Escape cierra, y el fondo no scrollea mientras la hoja está abierta.
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar?.() }
    document.addEventListener('keydown', alTeclear)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = previo
    }
  }, [abierta, onCerrar])

  if (!abierta) return null

  const contenido = (
    <>
      {/* Asa: solo en móvil. En un modal centrado no significa nada. */}
      {!escritorio && (
        <span aria-hidden style={{
          width: 38, height: 4, borderRadius: 999,
          background: 'rgba(20,20,28,.16)',
          alignSelf: 'center', margin: '10px 0 15px', flex: 'none',
        }} />
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, flex: 'none',
        padding: escritorio ? '18px 22px' : '0 22px 14px',
        background: escritorio ? 'var(--cf-card)' : 'transparent',
        borderBottom: escritorio ? '1px solid var(--cf-border)' : 'none',
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.25,
            color: 'var(--cf-ink)',
          }}>{titulo}</span>
          {subtitulo && (
            <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-3)', marginTop: 3, lineHeight: 1.4 }}>
              {subtitulo}
            </span>
          )}
        </span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', flex: 'none', marginTop: -2 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '0 22px 18px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>{children}</div>

      {accion && (
        <div style={{
          background: 'var(--cf-card)',
          borderTop: '1px solid rgba(20,20,28,.09)',
          padding: escritorio ? '14px 22px' : '14px 22px 24px',
          display: 'flex', gap: 10, flex: 'none',
        }}>{accion}</div>
      )}
    </>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onCerrar} style={{
        position: 'absolute', inset: 0,
        background: escritorio ? 'var(--cf-scrim-modal)' : 'var(--cf-scrim)',
      }} />

      <div role="dialog" aria-modal="true" style={escritorio ? {
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: alturaMaxima,
        background: 'var(--cf-surface)',
        borderRadius: 'var(--cf-r-sheet)',
        boxShadow: 'var(--cf-sh-modal)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      } : {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        maxHeight: alturaMaxima,
        background: 'var(--cf-surface)',
        borderRadius: 'var(--cf-r-sheet) var(--cf-r-sheet) 0 0',
        boxShadow: 'var(--cf-sh-sheet)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>{contenido}</div>
    </div>
  )
}
