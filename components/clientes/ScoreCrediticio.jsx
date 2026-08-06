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

  /* ⚠ «SIN HISTORIAL» NO SE ENSEÑA.
     El score avisa de un cliente que quedó mal en OTRA organización; `gris`
     significa que no hay nada que avisar. Enseñarlo dejaba una pastilla suelta
     con un «?» colgando bajo el bloque de Lucas —se ve en la captura del
     dueño— que no responde ninguna pregunta: quien la lee se queda igual.

     Los tres estados que SÍ dicen algo —rojo, amarillo, verde— siguen saliendo.
     Es el mismo criterio con el que se quitó el chip de mora repetido. */
  if (!habilitado || loading || !data || data.score === 'gris') return null

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
          <p className="text-sm text-[var(--cf-ink-3)]">
            No se encontraron registros de esta cédula en otras entidades de la plataforma.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Créditos activos" value={data.datos.creditosActivos} color="var(--cf-gold)" />
              <StatCard label="Completados" value={data.datos.creditosCompletados} color="var(--cf-green-dark)" />
              <StatCard label="En mora" value={data.datos.creditosEnMora} color="var(--cf-red-dark)" />
              <StatCard label="Cancelados" value={data.datos.creditosCancelados} color="var(--cf-ink-3)" />
            </div>

            <div className="text-xs text-[var(--cf-ink-3)] border-t border-[var(--cf-border)] pt-3">
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
    <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-xl p-3 text-center">
      <p className="text-2xl font-bold font-mono-display" style={{ color }}>{value}</p>
      <p className="text-xs text-[var(--cf-ink-3)] mt-1">{label}</p>
    </div>
  )
}
