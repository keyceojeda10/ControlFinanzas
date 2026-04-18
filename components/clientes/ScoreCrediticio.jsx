'use client'

import { useState, useEffect } from 'react'
import { Badge }  from '@/components/ui/Badge'
import { Modal }  from '@/components/ui/Modal'

const SCORE_CONFIG = {
  rojo:     { variant: 'red',    label: 'Alto riesgo',    icon: '!' },
  amarillo: { variant: 'yellow', label: 'Riesgo medio',   icon: '~' },
  verde:    { variant: 'green',  label: 'Sin riesgo',     icon: '' },
  gris:     { variant: 'gray',   label: 'Sin historial',  icon: '?' },
}

export default function ScoreCrediticio({ cedula, plan }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [modal, setModal]     = useState(false)

  const habilitado = ['standard', 'professional'].includes(plan)

  useEffect(() => {
    if (!habilitado || !cedula || cedula.length < 6) {
      setData(null)
      return
    }

    setLoading(true)
    fetch(`/api/clientes/score?cedula=${encodeURIComponent(cedula)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setData(null); return }
        setData(d)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [cedula, habilitado])

  if (!habilitado || loading || !data) return null

  const config = SCORE_CONFIG[data.score] || SCORE_CONFIG.gris

  return (
    <>
      <button onClick={() => setModal(true)} className="cursor-pointer">
        <Badge variant={config.variant}>
          {config.icon && <span className="font-bold">{config.icon}</span>}
          {config.label}
        </Badge>
      </button>

      <Modal open={modal} onClose={() => setModal(false)} title="Historial Crediticio" size="sm">
        {!data.encontrado ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No se encontraron registros de esta cédula en otras entidades de la plataforma.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Créditos activos" value={data.datos.creditosActivos} color="#f5c518" />
              <StatCard label="Completados" value={data.datos.creditosCompletados} color="#22c55e" />
              <StatCard label="En mora" value={data.datos.creditosEnMora} color="#ef4444" />
              <StatCard label="Cancelados" value={data.datos.creditosCancelados} color="#888888" />
            </div>

            <div className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
              <p>Datos basados en {data.datos.totalOrganizaciones} entidad{data.datos.totalOrganizaciones !== 1 ? 'es' : ''} de la plataforma.</p>
              <p className="mt-1">Esta información es un indicador agregado y anónimo. No se revelan datos específicos de terceros.</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 text-center">
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
    </div>
  )
}
