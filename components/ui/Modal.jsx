'use client'
// components/ui/Modal.jsx

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
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
          'rounded-t-[20px] sm:rounded-[20px]',
          /* ⚠ `dvh`, NO `vh`. En Safari de iPhone `100vh` es la altura del
             viewport SIN la barra del navegador, así que `90vh` es MÁS ALTO que
             lo que se ve. Y como el modal se ancla abajo (`items-end`), lo que
             se sale es lo de ARRIBA: la cabecera con la X.

             Resultado: un modal del que no se puede salir. Reportado con
             captura en el de «Generar comprobante», donde se veía la lista de
             campos y el pie, pero ni el título ni la X.

             Esto vale para TODOS los modales de la app, que pasan por aquí. El
             `vh` se deja delante como respaldo para quien no entienda `dvh`. */
          'max-h-[90vh] max-h-[90dvh] flex flex-col',
          'animate-slide-up sm:animate-modal-in',
          sizes[size] ?? sizes.md,
        ].join(' ')}
      >
        {/* ══ ⚠ SIN TÍTULO NO HABÍA NINGUNA SALIDA ═══════════════════════════
            La X vivía DENTRO de `{title && …}`, así que un modal sin título se
            quedaba sin cabecera y sin forma de cerrarse. Le pasa a los dos que
            traen su propio encabezado dentro —la FIRMA y RENOVAR— y son
            justamente los que atrapan: en el de la firma, si no firmas no
            puedes darle a «Listo», y no hay nada más que tocar.

            Aquí la X flota en la esquina, sobre el contenido, con fondo propio
            para que se lea encima de lo que sea. Y el contenido gana margen a la
            derecha (más abajo) para que no le caiga encima a un nombre largo:
            «Firma aquí, …» ocupa todo el ancho. */}
        {!title && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]/65 transition-colors"
            style={{
              background: 'var(--cf-card)',
              border: '1px solid var(--cf-border)',
              color: 'var(--cf-ink-2)',
              boxShadow: '0 1px 3px rgba(0,0,0,.08)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {title && (
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--cf-border)' }}>
            <h2 id="cf-modal-title" className="text-base font-semibold tracking-[0.01em]" style={{ color: 'var(--cf-ink)' }}>{title}</h2>
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

        {/* ⚠ EL HUECO DE LA X NO SE LE COBRA A TODO EL CONTENIDO.
            Estaba con `pr-16` en el contenedor entero, así que la X reservaba
            una franja de 64px A LO LARGO DE TODO EL MODAL: el formulario se
            corría a la izquierda y quedaba un canal vacío hasta abajo.
            Reportado: «le pone un borde lateral a todo el modal y se ve
            terrible».
            La X solo estorba en su propia altura, así que el sitio se hace con
            un `float` de esa altura y el resto del contenido usa el ancho
            completo. */}
        <div className="flex-1 overflow-y-auto p-5">
          {!title && <div aria-hidden className="float-right h-9 w-12" />}
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
