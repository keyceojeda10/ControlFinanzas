'use client'

import PlanExcedido from '@/components/pantallas/PlanExcedido'

export default function Vista({ casos }) {
  return (
    <div style={{ background: 'var(--cf-fill)', minHeight: '100vh', padding: 26,
      fontFamily: 'var(--font-manrope), system-ui' }}>
      <h1 style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600,
        letterSpacing: '-.025em', color: 'var(--cf-ink)', margin: '0 0 22px' }}>
        03 · Plan excedido
      </h1>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {casos.map((c) => (
          <div key={c.titulo} style={{ width: 390, flex: 'none' }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'var(--cf-ink-3)', margin: '0 0 10px' }}>{c.titulo}</p>
            <div style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)',
              borderRadius: 20, padding: 20 }}>
              <PlanExcedido {...c.vista} clientes={c.clientes} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
