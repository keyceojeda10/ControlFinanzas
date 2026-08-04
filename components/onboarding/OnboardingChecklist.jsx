'use client'

import { useState, useEffect } from 'react'
import ProgressRing from './ProgressRing'
import MissionItem from './MissionItem'
import Confetti from './Confetti'

export default function OnboardingChecklist({ misiones, completadas, total, progreso, onDismiss, onSpotlight, reapertura = null }) {
  const [expanded, setExpanded] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [prevCompleted, setPrevCompleted] = useState(completadas)

  // Show confetti when all missions completed
  useEffect(() => {
    if (completadas === total && completadas > 0 && prevCompleted < total) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    }
    setPrevCompleted(completadas)
  }, [completadas, total, prevCompleted])

  return (
    <>
    <Confetti active={showConfetti} />
    <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] overflow-hidden onboarding-fadein">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[var(--cf-fill)] transition-colors"
      >
        <ProgressRing progreso={progreso} size={52} stroke={3.5} />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-[var(--cf-ink)]">
            {reapertura ? 'Retomemos donde lo dejaste' : 'Configura tu negocio'}
          </p>
          {/* POR QUE HA VUELTO LA GUIA.
              Reaparecer sin explicacion se lee como un fallo del sistema —«esto
              ya lo hice»—. Con el motivo es una mano tendida: se le devuelve a
              cuentas que llevan mas de un mes sin cobrar, o que no han cobrado
              nunca. Medido: 150 de las 165 que la tenian cerrada. */}
          <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
            {reapertura
              ? reapertura.texto
              : completadas === 0
                ? 'Completa estas misiones para dominar el sistema'
                : `${completadas} de ${total} completadas`}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--cf-ink-3)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Missions list */}
      {expanded && (
        <div className="px-2 pb-3 border-t border-[var(--cf-border)]">
          {/* Progress bar */}
          <div className="mx-2 mt-3 mb-2">
            <div className="h-1.5 bg-[var(--cf-fill)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--cf-gold)] to-[var(--cf-gold)] transition-all duration-700 ease-out"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          <div className="space-y-0.5">
            {misiones.map((m) => (
              <MissionItem key={m.id} mision={m} onSpotlight={onSpotlight} />
            ))}
          </div>

          {/* Dismiss */}
          <div className="flex justify-center mt-3 mb-1">
            <button
              onClick={onDismiss}
              className="text-[10px] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink-3)] transition-colors"
            >
              Ya conozco el sistema, ocultar guía
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
