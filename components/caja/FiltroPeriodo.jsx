'use client'
// components/caja/FiltroPeriodo.jsx
//
// ⚠️ `hoyLocal()` y `restarDias()` usan UTC-5 FIJO — Colombia. Con 12 países en
// producción, un cobrador en México ve «hoy» corrido una hora en la franja de la
// medianoche. NO se toca aquí: las fechas de este proyecto tienen su propio
// convenio (T05:00Z al guardar, aritmética en UTC) y prod corre en UTC mientras
// dev corre en Bogotá, así que los bugs son invisibles en local. Cambiarlo sin
// medir contra datos reales es exactamente lo que ya salió mal antes.
// Este turno solo cambia la PIEL.
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
      {/* Mismo carril que las pestañas de caja, que van justo debajo: activo en
          PASTILLA BLANCA con sombra, no texto en dorado. Dos controles seguidos
          con la misma forma y distinta gramatica de color se leen como dos cosas
          que no tienen que ver — y son lo mismo: elegir que estas mirando. */}
      <div style={{
        display: 'flex', gap: 5, padding: 4, borderRadius: 14, flexWrap: 'wrap',
        background: 'var(--cf-fill-2)',
      }}>
        {OPCIONES.map((o) => {
          const on = modo === o.key
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => seleccionar(o.key)}
              aria-pressed={on}
              style={{
                flex: 1, minWidth: 64, height: 36, borderRadius: 11, border: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', font: 'inherit',
                fontSize: 13, fontWeight: on ? 700 : 600,
                color: on ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
                background: on ? 'var(--cf-card)' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(20,20,28,.1)' : 'none',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {modo === 'hoy' && (
        <input
          type="date"
          value={value?.fecha || hoyLocal()}
          max={hoyLocal()}
          onChange={(e) => onChange({ modo: 'hoy', fecha: e.target.value, desde: null, hasta: null })}
          style={{
            width: '100%', height: 48, padding: '0 14px', borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 15, color: 'var(--cf-ink)', outline: 'none',
          }}
        />
      )}

      {modo === 'rango' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value?.desde || ''}
            max={value?.hasta || hoyLocal()}
            onChange={(e) => onChange({ ...value, modo: 'rango', fecha: null, desde: e.target.value })}
            style={{
              flex: 1, minWidth: 0, height: 48, padding: '0 12px', borderRadius: 14,
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>a</span>
          <input
            type="date"
            value={value?.hasta || ''}
            max={hoyLocal()}
            onChange={(e) => onChange({ ...value, modo: 'rango', fecha: null, hasta: e.target.value })}
            style={{
              flex: 1, minWidth: 0, height: 48, padding: '0 12px', borderRadius: 14,
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}
