'use client'

// components/pantallas/config/PlanYPagos.jsx — sección «Plan y pagos».
//
// En la lámina es una sola fila: el plan y su precio a la izquierda, los
// clientes usados con su barra en el medio, y «Ver planes» a la derecha.
//
// «Plan y pagos», no «Suscripción»: suscripción es lo que la app le cobra a él;
// plan y pagos es lo que él viene a mirar.
//
// NI UN NÚMERO ESCRITO AQUÍ. El nombre, el precio y el tope llegan derivados de
// PLANES_CONFIG — es la misma regla que ya evitó que se colaran los topes viejos
// del handoff (20/40/100 cuando el sistema permite 100/450/1.000).

const ROTULO = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--cf-ink-3)',
}

export default function PlanYPagos({ plan, precio, renueva, clientes = 0, limite, onVerPlanes }) {
  const pct = limite > 0 ? Math.min(100, Math.round((clientes / limite) * 100)) : 0
  // Se pone ámbar cuando queda poco. No rojo: llegar al tope no rompe nada
  // —se sigue cobrando— así que pintarlo de alarma sería mentir.
  const apretado = pct >= 80

  return (
    <section style={{
      padding: '20px 22px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: 20, alignItems: 'center',
    }}>
      <div>
        <span style={ROTULO}>Plan {plan ?? '—'}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>
            {precio ?? '—'}
          </span>
          <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
            /mes{renueva ? ` · renueva el ${renueva}` : ''}
          </span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Clientes usados</span>
          <span className="cf-fig" style={{
            fontSize: 14, fontWeight: 700,
            color: apretado ? 'var(--cf-gold-dark)' : 'var(--cf-ink)',
          }}>
            {clientes} de {limite ?? '—'}
          </span>
        </div>
        <div style={{
          height: 7, borderRadius: 999, background: 'var(--cf-fill)',
          marginTop: 8, overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 999,
            background: apretado ? 'var(--cf-gold)' : 'var(--cf-green)',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onVerPlanes} style={{
          height: 'var(--cf-h-btn-2)', padding: '0 20px', cursor: 'pointer',
          borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border-strong)',
          fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
        }}>
          Ver planes
        </button>
      </div>
    </section>
  )
}
