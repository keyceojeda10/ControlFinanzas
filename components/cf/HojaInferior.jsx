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

import { useEffect, useState } from 'react'

export default function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  subtitulo,
  children,
  accion,                  // la barra de acción inferior
  // `undefined` = que lo decida sola por el ancho. Se puede forzar pasando
  // true/false. Antes el valor por defecto era `false`, así que cualquier hoja
  // que no lo pasara —todas— salía en PC como una franja pegada al borde
  // inferior de una pantalla de 1440: el patrón es de teléfono y en escritorio
  // no se lee como un modal, se lee como algo roto.
  escritorio: escritorioProp,
  alturaMaxima = '88vh',
}) {
  // La detección va en un EFECTO, no en el primer render: leer matchMedia al
  // pintar hace que el servidor diga una cosa y el cliente otra, y React tira
  // el árbol entero. Ya me pasó tres veces en este rediseño.
  const [anchaPantalla, setAnchaPantalla] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const leer = () => setAnchaPantalla(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])
  const escritorio = escritorioProp ?? anchaPantalla

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

  // ── EL BOTÓN «ATRÁS» DEL TELÉFONO CIERRA LA HOJA ───────────────────────
  //
  // Reportado por un cobrador: «registro a un cliente y se me queda ahí, no me
  // da arriba la flechita para salir atrás; si le doy con el celular se vuelve a
  // salir afuera». Y es exacto: aquí solo se escuchaba `Escape` —una tecla, o
  // sea SOLO en escritorio— así que en Android el «atrás» no encontraba nada que
  // cerrar y se llevaba por delante la aplicación entera. En medio de una ruta,
  // cobrando.
  //
  // Cómo funciona: al abrir se mete una entrada de historia; el «atrás» la
  // consume y `popstate` cierra la hoja en vez de salir de la página. Al cerrar
  // por la X o por el fondo, esa entrada se retira para no dejar historia basura
  // que obligue a pulsar «atrás» dos veces.
  useEffect(() => {
    if (!abierta || typeof window === 'undefined') return
    let cerradaPorAtras = false
    window.history.pushState({ cfHoja: true }, '')
    const alVolver = () => { cerradaPorAtras = true; onCerrar?.() }
    window.addEventListener('popstate', alVolver)
    return () => {
      window.removeEventListener('popstate', alVolver)
      // Si se cerró con la X, la entrada sigue puesta: se quita a mano. Si se
      // cerró CON el atrás, ya la consumió el navegador y volver a llamar a
      // `back()` sacaría al usuario de la pantalla — que es el fallo original.
      if (!cerradaPorAtras && window.history.state?.cfHoja) window.history.back()
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

      {/* AIRE DEBAJO DE LA CABECERA. Iba a `padding-top: 0`, asi que en
          escritorio el primer rotulo del contenido nacia pegado al filete que
          separa el titulo — «Más filtros» y debajo, sin respirar, «CADA CUÁNTO
          COBRA». Abajo si tenia, y por eso se leia torcido: el bloque parecia
          empujado hacia arriba.

          En movil no hay filete y la cabecera ya deja 14px, asi que basta un
          poco menos. */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: escritorio ? '18px 22px 18px' : '4px 22px 18px',
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
