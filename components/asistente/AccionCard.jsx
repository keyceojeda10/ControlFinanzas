'use client'
// components/asistente/AccionCard.jsx — Tarjeta de confirmación de acciones de Lucas

import { useState } from 'react'

const COLOR_MAP = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger:  'var(--color-danger)',
  info:    'var(--color-info)',
}

const TOOL_LABELS = {
  create_client:           'Crear cliente',
  create_loan:             'Crear préstamo',
  create_route:            'Crear ruta',
  assign_clients_to_route: 'Asignar clientes',
  adjust_capital:          'Ajustar capital',
  edit_loan:               'Editar préstamo',
  escalate_support:        'Contactar soporte',
}

export default function AccionCard({ tool, input, displayData, onConfirm, onCancel }) {
  const [status, setStatus] = useState('pending') // pending | loading | done | error | cancelled
  const [resultMsg, setResultMsg] = useState('')
  const [escalationData, setEscalationData] = useState(null)

  // Escalate support renders directly without confirmation
  if (displayData?.tipo === 'escalation') {
    return (
      <div className="rounded-[14px] overflow-hidden my-1"
        style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Opciones de soporte
          </p>
        </div>
        <div className="px-3 pb-3 space-y-2">
          <EscalationButtons escalationData={displayData} />
        </div>
      </div>
    )
  }

  const accentColor = COLOR_MAP[displayData?.color] || 'var(--color-info)'
  const titulo = displayData?.titulo || TOOL_LABELS[tool] || tool
  const fields = displayData?.fields || []

  const handleConfirm = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/asistente/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, input }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResultMsg(data.error || 'Error al ejecutar la acción')
        return
      }
      if (data.type === 'escalation') {
        setEscalationData(data)
        setStatus('done')
        setResultMsg('')
        return
      }
      setStatus('done')
      setResultMsg(data.message || 'Acción ejecutada exitosamente.')
      onConfirm?.(data)
    } catch {
      setStatus('error')
      setResultMsg('Error de conexión. Intenta de nuevo.')
    }
  }

  const handleCancel = () => {
    setStatus('cancelled')
    onCancel?.()
  }

  if (status === 'cancelled') return null

  return (
    <div className="rounded-[14px] overflow-hidden my-1"
      style={{
        background: 'var(--color-bg-hover)',
        border: `1px solid color-mix(in srgb, ${accentColor} 25%, var(--color-border))`,
      }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accentColor }} />
        <p className="text-xs font-semibold" style={{ color: accentColor }}>{titulo}</p>
      </div>

      {/* Fields */}
      {status !== 'done' && status !== 'error' && fields.length > 0 && (
        <div className="px-4 py-3 space-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className="flex justify-between items-start gap-3">
              <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{f.label}</span>
              <span className="text-xs font-medium text-right" style={{ color: 'var(--color-text-primary)' }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result - done */}
      {status === 'done' && !escalationData && (
        <div className="px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--color-success)' }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--color-success)' }}>{resultMsg}</p>
        </div>
      )}

      {/* Escalation result */}
      {status === 'done' && escalationData && (
        <div className="px-3 py-3 space-y-2">
          <EscalationButtons escalationData={escalationData} />
        </div>
      )}

      {/* Result - error */}
      {status === 'error' && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--color-danger)' }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{resultMsg}</p>
          </div>
          <button onClick={() => setStatus('pending')} className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Actions - only in pending/loading */}
      {(status === 'pending' || status === 'loading') && (
        <div className="flex gap-2 px-3 pb-3">
          <button
            onClick={handleCancel}
            disabled={status === 'loading'}
            className="flex-1 h-9 rounded-[10px] text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={status === 'loading'}
            className="flex-1 h-9 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: accentColor, color: '#0a0a0a' }}
          >
            {status === 'loading' ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ejecutando...
              </>
            ) : 'Confirmar'}
          </button>
        </div>
      )}
    </div>
  )
}

function EscalationButtons({ escalationData }) {
  return (
    <>
      {escalationData.whatsappUrl && (
        <a
          href={escalationData.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
          style={{ background: '#22c55e18', border: '1px solid #22c55e40', color: '#22c55e' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Escribir por WhatsApp
        </a>
      )}
      {escalationData.soporteUrl && (
        <a
          href={escalationData.soporteUrl}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Crear ticket de soporte
        </a>
      )}
      {escalationData.planesUrl && (
        <a
          href={escalationData.planesUrl}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          Ver planes y renovar
        </a>
      )}
    </>
  )
}
