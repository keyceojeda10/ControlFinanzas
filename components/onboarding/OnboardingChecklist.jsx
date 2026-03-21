'use client'

import { useState } from 'react'
import ProgressRing from './ProgressRing'
import MissionItem from './MissionItem'

export default function OnboardingChecklist({ misiones, completadas, total, progreso, onDismiss, onSpotlight }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] overflow-hidden onboarding-fadein">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[#222222] transition-colors"
      >
        <ProgressRing progreso={progreso} size={52} stroke={3.5} />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-white">Configura tu negocio</p>
          <p className="text-[11px] text-[#888888] mt-0.5">
            {completadas === 0
              ? 'Completa estas misiones para dominar el sistema'
              : `${completadas} de ${total} completadas`}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-[#555555] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Missions list */}
      {expanded && (
        <div className="px-2 pb-3 border-t border-[#2a2a2a]">
          {/* Progress bar */}
          <div className="mx-2 mt-3 mb-2">
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f5c518] to-[#f0b800] transition-all duration-700 ease-out"
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
              className="text-[10px] text-[#555555] hover:text-[#888888] transition-colors"
            >
              Ya conozco el sistema, ocultar guia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
