'use client'

import { useState, useMemo } from 'react'
import { detectarColumnas, corregirMapeoConDatos, CAMPOS_LABELS, parsearNumero } from '@/lib/carga-masiva'
import { useCountry } from '@/hooks/useCountry'

const CAMPOS_INTERNOS = Object.keys(CAMPOS_LABELS)

export default function PasoMapear({ headers, filas, onConfirmar, onVolver }) {
  const { formatMoney } = useCountry()
  const autoDeteccion = useMemo(() => {
    const det = detectarColumnas(headers)
    return { ...det, mapeo: corregirMapeoConDatos(det.mapeo, filas) }
  }, [headers, filas])

  const [mapeo, setMapeo] = useState(() => ({ ...autoDeteccion.mapeo }))
  const [multiplicador, setMultiplicador] = useState(1)

  const camposAsignados = useMemo(() => {
    const set = new Set()
    for (const campo of Object.values(mapeo)) {
      if (campo) set.add(campo)
    }
    return set
  }, [mapeo])

  const tieneNombre = camposAsignados.has('nombre')
  const tieneCedula = camposAsignados.has('cedula')
  const puedeAvanzar = tieneNombre || tieneCedula

  const previewFilas = filas.slice(0, 4)

  // Detectar si los montos parecen estar en una escala incorrecta
  const analisisMontos = useMemo(() => {
    const montoHeader = Object.entries(mapeo).find(([, c]) => c === 'montoPrestado')?.[0]
    if (!montoHeader) return null

    const valores = filas.map(f => parsearNumero(f[montoHeader])).filter(v => v > 0)
    if (valores.length === 0) return null

    valores.sort((a, b) => a - b)
    const mediana = valores[Math.floor(valores.length / 2)]

    if (mediana >= 20000) return null

    return { mediana, total: valores.length }
  }, [mapeo, filas])

  // Auto-sugerir multiplicador al detectar escala baja
  useMemo(() => {
    if (analisisMontos && multiplicador === 1) {
      setMultiplicador(1000)
    }
  }, [analisisMontos])

  const handleCambiarMapeo = (header, nuevoCampo) => {
    setMapeo(prev => {
      const nuevo = { ...prev }
      if (!nuevoCampo) {
        delete nuevo[header]
        return nuevo
      }
      for (const [h, c] of Object.entries(nuevo)) {
        if (c === nuevoCampo && h !== header) {
          delete nuevo[h]
        }
      }
      nuevo[header] = nuevoCampo
      return nuevo
    })
  }

  const detectadas = Object.keys(mapeo).length
  const total = headers.length

  return (
    <div className="space-y-4">
      {/* Resumen de deteccion */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-4">
        <div className="flex items-start gap-3">
          <div className={[
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
            detectadas >= 2 ? 'bg-[rgba(34,197,94,0.12)]' : 'bg-[rgba(245,158,11,0.12)]',
          ].join(' ')}>
            {detectadas >= 2 ? (
              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {detectadas >= 2
                ? `Detectamos ${detectadas} de ${total} columnas`
                : 'Necesitamos tu ayuda con las columnas'}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
              {detectadas >= 2
                ? 'Revisa que cada columna de tu archivo este asignada al campo correcto. Puedes cambiar cualquiera.'
                : 'No pudimos identificar las columnas automaticamente. Selecciona a que campo corresponde cada una.'}
            </p>
          </div>
        </div>
      </div>

      {/* Mapeo de columnas */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide px-1">
          Columnas de tu archivo
        </p>
        {headers.map((header) => {
          const campoAsignado = mapeo[header] || ''
          const valorEjemplo = previewFilas.find(f => String(f[header] || '').trim())
          const ejemplo = valorEjemplo ? String(valorEjemplo[header]).slice(0, 30) : ''

          return (
            <div key={header}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                    {header}
                  </p>
                  {ejemplo && (
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                      ej: {ejemplo}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <select
                  value={campoAsignado}
                  onChange={(e) => handleCambiarMapeo(header, e.target.value)}
                  className={[
                    'w-[140px] h-8 px-2 rounded-[8px] border text-[12px] font-medium focus:outline-none focus:border-[var(--color-accent)] transition-colors',
                    campoAsignado
                      ? 'bg-[rgba(245,197,24,0.08)] border-[rgba(245,197,24,0.25)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-base)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                  ].join(' ')}
                >
                  <option value="">— Ignorar —</option>
                  {CAMPOS_INTERNOS.map(campo => (
                    <option key={campo} value={campo} disabled={camposAsignados.has(campo) && mapeo[header] !== campo}>
                      {CAMPOS_LABELS[campo]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      {/* Alerta de escala de montos */}
      {analisisMontos && (
        <div className="bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.25)] rounded-[12px] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Los montos parecen estar en miles
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug">
                El capital promedio en tu archivo es {formatMoney(analisisMontos.mediana)}, lo cual es muy bajo para prestamos reales.
                Muchas apps guardan los valores en miles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 1, label: 'Tal cual', desc: formatMoney(analisisMontos.mediana) },
              { val: 1000, label: 'x 1.000', desc: formatMoney(analisisMontos.mediana * 1000) },
              { val: 1000000, label: 'x 1.000.000', desc: formatMoney(analisisMontos.mediana * 1000000) },
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMultiplicador(opt.val)}
                className={[
                  'rounded-[10px] border px-2 py-2.5 text-center transition-all',
                  multiplicador === opt.val
                    ? 'bg-[rgba(245,197,24,0.15)] border-[var(--color-accent)] ring-1 ring-[rgba(245,197,24,0.3)]'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]',
                ].join(' ')}
              >
                <p className={[
                  'text-sm font-bold',
                  multiplicador === opt.val ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]',
                ].join(' ')}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {multiplicador > 1 && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-success)]">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Los montos se multiplicaran por {multiplicador.toLocaleString('es-CO')} al importar
            </div>
          )}

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)]">Multiplicador personalizado:</label>
            <input
              type="number"
              value={multiplicador}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 1
                setMultiplicador(Math.max(1, v))
              }}
              min={1}
              className="w-full mt-1 h-9 px-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text-primary)] font-mono-display focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      )}

      {/* Preview de datos con mapeo aplicado */}
      {puedeAvanzar && previewFilas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide px-1">
            Vista previa ({previewFilas.length} de {filas.length} filas)
          </p>
          <div className="overflow-x-auto rounded-[12px] border border-[var(--color-border)]">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-[var(--color-bg-surface)]">
                  {Object.entries(mapeo).filter(([, c]) => c).map(([, campo]) => (
                    <th key={campo} className="px-2 py-1.5 text-left text-[var(--color-text-muted)] font-semibold whitespace-nowrap">
                      {CAMPOS_LABELS[campo]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewFilas.map((fila, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    {Object.entries(mapeo).filter(([, c]) => c).map(([headerOrig, campo]) => {
                      let val = String(fila[headerOrig] ?? '').slice(0, 25) || '—'
                      const esMonetario = ['montoPrestado', 'saldoActual', 'abonadoHasta'].includes(campo)
                      if (esMonetario && multiplicador > 1 && val !== '—') {
                        const num = parsearNumero(fila[headerOrig])
                        if (num > 0) val = formatMoney(num * multiplicador)
                      }
                      return (
                        <td key={headerOrig} className="px-2 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap max-w-[120px] truncate">
                          {val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerta si falta nombre o cedula */}
      {!puedeAvanzar && (
        <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-[12px] rounded-[12px] px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Asigna al menos la columna de Nombre o Cedula para poder continuar
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onVolver}
          className="flex-1 h-11 rounded-[12px] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          Volver
        </button>
        <button
          onClick={() => onConfirmar(mapeo, multiplicador)}
          disabled={!puedeAvanzar}
          className="flex-1 h-11 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
