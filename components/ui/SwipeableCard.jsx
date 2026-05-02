'use client'
// components/ui/SwipeableCard.jsx
//
// Wrapper que detecta swipe horizontal en touch devices y revela acciones a la
// derecha de la card. Estilo iOS Mail / Gmail.
//
// Uso:
//   <SwipeableCard
//     actions={[
//       { icon: <IconWA/>, label: 'WhatsApp', color: '#25D366', onClick: () => ... },
//       { icon: <IconPagar/>, label: 'Pagar',  color: '#22c55e', onClick: () => ... },
//     ]}
//   >
//     <ClienteCard ... />
//   </SwipeableCard>

import { useRef, useState, useEffect } from 'react'

const ACTION_W = 72  // ancho de cada accion en px
const SWIPE_THRESHOLD = 30  // pixeles minimos para considerar swipe valido

export default function SwipeableCard({ actions = [], children, disabled = false }) {
  const containerRef = useRef(null)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [translateX, setTranslateX] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  const totalActionsW = actions.length * ACTION_W
  const maxOpen = -totalActionsW

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return
    const onDocPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setTranslateX(0)
        setIsOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', onDocPointerDown), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', onDocPointerDown)
    }
  }, [isOpen])

  if (disabled || actions.length === 0) {
    return <div ref={containerRef}>{children}</div>
  }

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return
    startXRef.current = e.touches[0].clientX - translateX
    currentXRef.current = translateX
    setIsDragging(true)
  }

  const onTouchMove = (e) => {
    if (!isDragging) return
    const delta = e.touches[0].clientX - startXRef.current
    // Solo permitir swipe a la izquierda (negativo). Limitar al maximo.
    const next = Math.max(maxOpen, Math.min(0, delta))
    currentXRef.current = next
    setTranslateX(next)
  }

  const onTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    // Snap: si paso el umbral, abrir completo. Si no, cerrar.
    const opened = currentXRef.current < -SWIPE_THRESHOLD
    setTranslateX(opened ? maxOpen : 0)
    setIsOpen(opened)
  }

  const closeAndRun = (fn) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setTranslateX(0)
    setIsOpen(false)
    fn?.(e)
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-[16px]">
      {/* Acciones detras (solo visibles cuando hay swipe) */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: `${totalActionsW}px` }}
        aria-hidden={!isOpen}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={closeAndRun(a.onClick)}
            className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            style={{
              width: `${ACTION_W}px`,
              background: a.color,
              color: a.textColor || '#fff',
            }}
            aria-label={a.label}
          >
            <span className="w-5 h-5">{a.icon}</span>
            <span className="text-[10px] font-semibold tracking-wide">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido principal — se desliza encima de las acciones */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
