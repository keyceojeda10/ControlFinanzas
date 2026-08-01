'use client'

import RevisionCarga from '@/components/pantallas/RevisionCarga'

export default function VistaRevision({ vista }) {
  return (
    <div style={{ background: 'var(--cf-surface)', minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 390, margin: '0 auto' }}>
        <RevisionCarga
          titulo={vista.titulo}
          detalle={vista.detalle}
          filas={vista.filas}
          total={vista.total}
          cartera={vista.cartera}
          deColumna={vista.deColumna}
          escala={vista.escala}
        />
      </div>
    </div>
  )
}
