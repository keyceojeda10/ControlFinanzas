'use client'
// components/caja/FiltroPeriodo.jsx
// Filtro de periodo para la caja: chips rápidos (Hoy / 7 días / 30 días / Personalizado)
// + inputs desde/hasta cuando es personalizado. Notifica al padre con { modo, fecha, desde, hasta }.
//   - modo 'hoy'  -> vista de un día (usa `fecha`).
//   - modo '7d' | '30d' | 'rango' -> histórico acumulado (usa `desde`/`hasta`).

const OPCIONES = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d',  label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'rango', label: 'Rango' },
]

// Fecha local Colombia (UTC-5) en formato YYYY-MM-DD.
function hoyLocal() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function restarDias(fechaStr, n) {
  const d = new Date(`${fechaStr}T12:00:00-05:00`)
  d.setDate(d.getDate() - n)
  return new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function FiltroPeriodo({ value, onChange }) {
  // value = { modo, fecha, desde, hasta }
  const modoBase = value?.modo || 'hoy'
  const ayer = restarDias(hoyLocal(), 1)
  const esAyer = modoBase === 'hoy' && value?.fecha === ayer
  const modo = esAyer ? 'ayer' : modoBase

  const seleccionar = (nuevoModo) => {
    const hoy = hoyLocal()
    if (nuevoModo === 'hoy') {
      onChange({ modo: 'hoy', fecha: hoy, desde: null, hasta: null })
    } else if (nuevoModo === 'ayer') {
      onChange({ modo: 'hoy', fecha: restarDias(hoy, 1), desde: null, hasta: null })
    } else if (nuevoModo === '7d') {
      onChange({ modo: '7d', fecha: null, desde: restarDias(hoy, 6), hasta: hoy })
    } else if (nuevoModo === '30d') {
      onChange({ modo: '30d', fecha: null, desde: restarDias(hoy, 29), hasta: hoy })
    } else {
      onChange({ modo: 'rango', fecha: null, desde: value?.desde || restarDias(hoy, 6), hasta: value?.hasta || hoy })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 rounded-[12px] flex-wrap" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {OPCIONES.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => seleccionar(o.key)}
            className="flex-1 min-w-[64px] py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
            style={modo === o.key ? {
              background: 'var(--color-bg-card)',
              color: 'var(--color-accent)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            } : { color: 'var(--color-text-muted)' }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {modo === 'hoy' && (
        <input
          type="date"
          value={value?.fecha || hoyLocal()}
          max={hoyLocal()}
          onChange={(e) => onChange({ modo: 'hoy', fecha: e.target.value, desde: null, hasta: null })}
          className="w-full px-3 py-2 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
        />
      )}

      {modo === 'rango' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value?.desde || ''}
            max={value?.hasta || hoyLocal()}
            onChange={(e) => onChange({ ...value, modo: 'rango', fecha: null, desde: e.target.value })}
            className="flex-1 px-2 py-2 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
          />
          <span className="text-[11px] text-[var(--color-text-muted)]">a</span>
          <input
            type="date"
            value={value?.hasta || ''}
            max={hoyLocal()}
            onChange={(e) => onChange({ ...value, modo: 'rango', fecha: null, hasta: e.target.value })}
            className="flex-1 px-2 py-2 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
          />
        </div>
      )}
    </div>
  )
}
