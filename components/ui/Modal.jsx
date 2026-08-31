'use client'
// components/ui/Modal.jsx

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ open, onClose, onVolver, title, subtitle, children, size = 'md', footer, padding = true }) {
  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      // Focus trap simple: Tab cicla dentro del modal
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Mover foco al modal al abrir, devolverlo al cerrar
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement
    // Enfocar el primer elemento interactivo del modal
    setTimeout(() => {
      const first = dialogRef.current?.querySelector(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
      )
      first?.focus()
    }, 0)
    return () => {
      try { previousFocusRef.current?.focus?.() } catch {}
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || !mounted) return null

  const sizes = {
    sm:   'max-w-sm',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  const modalContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.() }}
    >
      {/* ══ ⚠ EL CLIC AFUERA NO CERRABA NINGÚN MODAL DE LA APP ══════════════
          El manejador de arriba compara `e.target === overlayRef.current`, y
          ese contenedor NUNCA es lo que se toca: este div de fondo lo cubre
          entero y es quien recibe el clic. Medido en la pantalla, no leído —
          `elementFromPoint` en el hueco de arriba devuelve `DIV.absolute.inset-0`
          y el modal seguía abierto en móvil Y en escritorio.

          Por eso el dueño lo reportó como «a veces ni siquiera dando un clic
          afuera se puede cerrar»: no era a veces, eran los 47.

          El manejador de arriba se queda por si algún día el fondo deja de
          cubrirlo todo; el que trabaja es este. */}
      <div
        className="absolute inset-0 cf-modal-overlay backdrop-blur-md animate-overlay-in"
        onClick={() => onClose?.()}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'cf-modal-title' : undefined}
        className={[
          'relative w-full cf-modal-dialog',
          /* El token, no un 20 a mano: `--cf-r-sheet` es 22px y es lo que ya
             usa `HojaInferior`, que es la que sigue el handoff. */
          'rounded-t-[var(--cf-r-sheet)] sm:rounded-[var(--cf-r-sheet)]',
          /* ⚠ `dvh`, NO `vh`. En Safari de iPhone `100vh` es la altura del
             viewport SIN la barra del navegador, así que `90vh` es MÁS ALTO que
             lo que se ve. Y como el modal se ancla abajo (`items-end`), lo que
             se sale es lo de ARRIBA: la cabecera con la X.

             Resultado: un modal del que no se puede salir. Reportado con
             captura en el de «Generar comprobante», donde se veía la lista de
             campos y el pie, pero ni el título ni la X.

             Esto vale para TODOS los modales de la app, que pasan por aquí. El
             `vh` se deja delante como respaldo para quien no entienda `dvh`. */
          'flex flex-col',
          'animate-slide-up sm:animate-modal-in',
          sizes[size] ?? sizes.md,
        ].join(' ')}
        /* ⚠ EL TOPE DE ALTURA VA EN UN TOKEN, NO EN DOS CLASES DE TAILWIND.
           Aquí había una clase en «vh» y otra en «dvh», puestas en ese orden
           creyendo que la segunda pisa a la primera. No: en CSS manda el orden
           de la HOJA, y Tailwind emitía la de «dvh» ANTES. Con la misma
           especificidad gana la última, así que mandaba justo la que se quería
           evitar, y en Safari de iPhone la cabecera se salía por arriba.
           El token lleva el `@supports` que decide bien; ver los tokens. */
        style={{ maxHeight: 'var(--cf-alto-modal)' }}
      >
        {/* ══ ⚠ LA X NO FLOTA ═══════════════════════════════════════════════
            Aquí había un CÍRCULO `absolute top-3 right-3`, y el hueco que le
            hacía sitio —un `float-right`— vivía DENTRO del área que scrollea.
            En cuanto se deslizaba, hueco y botón se separaban y el contenido
            pasaba por debajo de la X. Reportado con captura de «Renovar»: la
            X encima de la tarjeta del capital adeudado.

            Y el círculo iba contra una regla que ya estaba escrita:
            «un botón nunca es circular; el 999px está reservado a cinco cosas
            y ninguna es un botón de acción» (11-ESCALAS-Y-CONSISTENCIA).

            Ahora, sin título, se pinta una cabecera CORTA en flujo con el
            mismo botón cuadrado de la cabecera con título. En flujo el
            contenido no puede pasarle por debajo, y no hay hueco que cuadrar
            con nada. Le toca a los dos modales que traen su propio encabezado
            dentro: la FIRMA y RENOVAR. */}
        {!title && (
          <div className="shrink-0 flex justify-end px-2 pt-2">
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-11 h-11 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]/65 transition-colors"
              style={{ color: 'var(--cf-ink-2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {title && (
          <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--cf-border)' }}>
            {/* El subtítulo no es adorno: en «Renovar» dice de QUIÉN es el
                préstamo que se cierra. Antes vivía dentro del cuerpo porque la
                cabecera no sabía pintarlo. */}
            {/* ⚠ LA FLECHA DE VOLVER, CUANDO SE LLEGÓ DESDE UN MENÚ.
             «Ninguna de esas opciones de gestión permite volver hacia atrás, al
              menú general de la gestión. Solo permite salirse, y al salirse
              vuelve a la pantalla general del préstamo.»   — el dueño, 31 ago

             Van las DOS salidas y significan cosas distintas: la flecha vuelve
             al menú de donde salió, la X cierra y deja la pantalla. Sin la
             flecha, corregir dos cosas seguidas obliga a rehacer el camino
             entero cada vez. */}
            {onVolver && (
              <button
                onClick={onVolver}
                aria-label="Volver"
                className="w-9 h-11 -ml-2 flex items-center justify-center rounded-lg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]/65 transition-colors"
                style={{ color: 'var(--cf-ink-2)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <h2 id="cf-modal-title" className="text-base font-semibold tracking-[0.01em]" style={{ color: 'var(--cf-ink)' }}>{title}</h2>
              {subtitle && (
                <span className="text-[13px] leading-snug" style={{ color: 'var(--cf-ink-3)' }}>{subtitle}</span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-11 h-11 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]/65 focus-visible:ring-offset-2 transition-colors"
              style={{ color: 'var(--cf-ink-2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* `padding={false}` para el contenido que trae el suyo: la hoja de
            firma tiene su propio `14px 20px 16px` y con el `p-5` de aquí
            quedaba doble margen y el lienzo estrecho. */}
        <div className={padding ? 'flex-1 overflow-y-auto p-5' : 'flex-1 overflow-y-auto'}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 py-4 flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--cf-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
