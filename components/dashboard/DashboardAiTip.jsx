'use client'
// components/dashboard/DashboardAiTip.jsx — Tip sutil de IA basado en data del dashboard

import { useState, useEffect } from 'react'

function generarTip(data) {
  if (!data) return null

  const { cobros, prestamos, clientes, mora } = data

  // Tip de mora alta
  if (mora?.porcentajeMora > 15) {
    return `Tu mora esta en ${mora.porcentajeMora.toFixed(1)}% — revisa los clientes con mas días de atraso para priorizar cobro.`
  }

  // Tip de recaudo vs meta
  if (cobros?.hoy > 0 && prestamos?.cuotaDiariaTotal > 0) {
    const pct = Math.round((cobros.hoy / prestamos.cuotaDiariaTotal) * 100)
    if (pct >= 100) {
      return `Excelente día: ya alcanzaste el ${pct}% de tu meta diaria. ${cobros.cantidadHoy} pagos registrados.`
    }
    if (pct < 50 && new Date().getHours() > 14) {
      return `Llevas ${pct}% de tu meta diaria — quedan ${prestamos.cuotaDiariaTotal - cobros.hoy > 0 ? `$${Math.round(prestamos.cuotaDiariaTotal - cobros.hoy).toLocaleString('es-CO')}` : ''} por cobrar hoy.`
    }
  }

  // Tip de comparacion con ayer
  if (cobros?.ayer > 0 && cobros?.hoy > cobros.ayer * 1.2) {
    return `Llevas un ${Math.round(((cobros.hoy - cobros.ayer) / cobros.ayer) * 100)}% mas recaudado que ayer a esta hora.`
  }

  // Tip de clientes nuevos
  if (clientes?.nuevosEsteMes > 0) {
    return `${clientes.nuevosEsteMes} clientes nuevos este mes. Manten el ritmo para crecer tu cartera.`
  }

  return null
}

export default function DashboardAiTip({ data }) {
  const [tip, setTip] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const generated = generarTip(data)
    if (generated) setTip(generated)
  }, [data])

  if (!tip || dismissed) return null

  return (
    <div
      className="rounded-[12px] px-4 py-3 flex items-start gap-3"
      style={{
        background: 'rgba(245,197,24,0.04)',
        borderLeft: '2px solid var(--color-accent)',
      }}
    >
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-accent)' }}>
        <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
      </svg>
      <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {tip}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Cerrar tip"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
