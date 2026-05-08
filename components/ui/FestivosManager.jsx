'use client'
// components/ui/FestivosManager.jsx — Gestión de festivos (fechas sin cobro específicas)

import { useState } from 'react'

function hoyColombia() {
  const hoyCol = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return hoyCol.toISOString().split('T')[0]
}

function festivoFechaStr(festivo) {
  return new Date(festivo.fecha).toISOString().split('T')[0]
}

function formatFecha(fecha) {
  // fecha puede ser Date o string ISO
  const d = new Date(fecha)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function FestivosManager({ festivos = [], onAdd, onDelete, loading }) {
  const hoyStr = hoyColombia()
  const festivoHoy = festivos.find(f => festivoFechaStr(f) === hoyStr)

  const [showForm, setShowForm] = useState(false)
  const [fecha, setFecha] = useState('')
  const [nombre, setNombre] = useState('')
  const [formError, setFormError] = useState('')

  const handleAgregarHoy = () => {
    if (onAdd) onAdd(hoyStr, 'Festivo')
  }

  const handleEliminarHoy = () => {
    if (festivoHoy && onDelete) onDelete(festivoHoy.id)
  }

  const handleAgregar = () => {
    setFormError('')
    if (!fecha) { setFormError('Selecciona una fecha.'); return }
    const yaExiste = festivos.some(f => festivoFechaStr(f) === fecha)
    if (yaExiste) { setFormError('Ya existe un festivo en esa fecha.'); return }
    if (onAdd) {
      onAdd(fecha, nombre.trim() || 'Festivo')
      setFecha('')
      setNombre('')
      setShowForm(false)
    }
  }

  // Agrupar por año si hay más de 5
  const sorted = [...festivos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  const agrupar = sorted.length > 5
  const porAnio = agrupar
    ? sorted.reduce((acc, f) => {
        const anio = new Date(f.fecha).getUTCFullYear()
        if (!acc[anio]) acc[anio] = []
        acc[anio].push(f)
        return acc
      }, {})
    : null

  return (
    <div className="space-y-4">
      {/* --- Hoy --- */}
      {festivoHoy ? (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium text-[#22c55e]">Hoy marcado como festivo</span>
            {festivoHoy.nombre && (
              <span className="text-xs text-[#a0a0a0]">— {festivoHoy.nombre}</span>
            )}
          </div>
          <button
            onClick={handleEliminarHoy}
            disabled={loading}
            aria-label="Quitar festivo de hoy"
            className="p-1.5 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={handleAgregarHoy}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#2a2a2a] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#f5c518]/40 text-sm text-[#a0a0a0] hover:text-white transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/40"
        >
          <svg className="w-4 h-4 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Marcar hoy como festivo</span>
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-[#333] border-t-[#f5c518] rounded-full animate-spin" />
          )}
        </button>
      )}

      {/* --- Agregar otra fecha --- */}
      <div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs text-[#a0a0a0] hover:text-white transition-colors focus:outline-none focus:underline"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar otra fecha
          </button>
        ) : (
          <div className="space-y-2 p-3 rounded-xl border border-[#2a2a2a] bg-[#111]">
            <p className="text-xs font-medium text-[#a0a0a0] mb-2">Agregar festivo</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={fecha}
                onChange={e => { setFecha(e.target.value); setFormError('') }}
                aria-label="Fecha del festivo"
                className="flex-1 h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white focus:outline-none focus:border-[#f5c518] transition-colors [color-scheme:dark]"
              />
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre (opcional)"
                aria-label="Nombre del festivo"
                className="flex-1 h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#f5c518] transition-colors"
              />
            </div>
            {formError && (
              <p className="text-xs text-[#ef4444]">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAgregar}
                disabled={loading || !fecha}
                className="px-4 py-1.5 rounded-lg bg-[#f5c518] text-black text-xs font-semibold hover:bg-[#f0b800] transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#f5c518]/40"
              >
                {loading ? 'Agregando...' : 'Agregar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFecha(''); setNombre(''); setFormError('') }}
                className="px-4 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#a0a0a0] hover:text-white transition-colors focus:outline-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Lista de festivos --- */}
      {sorted.length === 0 ? (
        <p className="text-xs text-[#666] py-2">No hay festivos configurados.</p>
      ) : agrupar && porAnio ? (
        <div className="space-y-4">
          {Object.entries(porAnio).map(([anio, items]) => (
            <div key={anio}>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1.5">{anio}</p>
              <FestivosList items={items} hoyStr={hoyStr} loading={loading} onDelete={onDelete} />
            </div>
          ))}
        </div>
      ) : (
        <FestivosList items={sorted} hoyStr={hoyStr} loading={loading} onDelete={onDelete} />
      )}
    </div>
  )
}

function FestivosList({ items, hoyStr, loading, onDelete }) {
  return (
    <div className="divide-y divide-[#2a2a2a] rounded-xl border border-[#2a2a2a] overflow-hidden">
      {items.map((f) => {
        const fStr = festivoFechaStr(f)
        const esHoy = fStr === hoyStr
        return (
          <div
            key={f.id}
            className={`flex items-center justify-between px-3 py-2.5 ${esHoy ? 'bg-[#22c55e]/5' : 'bg-[#111]'}`}
          >
            <div className="min-w-0">
              <span className="text-xs text-white font-medium">{formatFecha(f.fecha)}</span>
              {f.nombre && (
                <span className="text-xs text-[#666] ml-2">{f.nombre}</span>
              )}
              {esHoy && (
                <span className="ml-2 text-[10px] font-semibold text-[#22c55e] uppercase tracking-wide">Hoy</span>
              )}
            </div>
            <button
              onClick={() => onDelete && onDelete(f.id)}
              disabled={loading}
              aria-label={`Eliminar festivo ${formatFecha(f.fecha)}`}
              className="ml-2 p-1.5 rounded-lg text-[#666] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors disabled:opacity-40 shrink-0 focus:outline-none focus:ring-1 focus:ring-[#ef4444]/40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
