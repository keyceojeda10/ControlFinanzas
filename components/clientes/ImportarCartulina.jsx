'use client'
// components/clientes/ImportarCartulina.jsx
// Botón + flujo para leer cartulinas fisicas con Gemini Vision y pre-llenar el wizard.

import { useState, useRef } from 'react'

export default function ImportarCartulina({ onDatosExtraidos }) {
  const [estado, setEstado] = useState('idle') // idle | cargando | exito | error
  const [mensajeError, setMensajeError] = useState('')
  const [advertencias, setAdvertencias] = useState([])
  const [previews, setPreviews] = useState([])
  const inputRef = useRef(null)

  const handleClick = () => inputRef.current?.click()

  const handleArchivos = async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (!archivos.length) return

    // Previews locales
    const urls = archivos.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    setEstado('cargando')
    setMensajeError('')
    setAdvertencias([])

    const fd = new FormData()
    archivos.forEach(f => fd.append('fotos', f))

    try {
      const res = await fetch('/api/herramientas/leer-cartulina', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setEstado('error')
        setMensajeError(json.error ?? 'No pudimos leer la cartulina')
        return
      }

      if (json.advertencias?.length) setAdvertencias(json.advertencias)
      setEstado('exito')
      onDatosExtraidos(json.datos)
    } catch {
      setEstado('error')
      setMensajeError('Error de conexión. Intenta de nuevo.')
    } finally {
      // Reset input para permitir subir la misma foto de nuevo
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const reintentar = () => {
    setEstado('idle')
    setMensajeError('')
    setPreviews([])
    setAdvertencias([])
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleArchivos}
      />

      {/* Estado idle — botón principal */}
      {estado === 'idle' && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2.5 h-11 rounded-[12px] border-2 border-dashed border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.04)] transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Importar desde foto
        </button>
      )}

      {/* Estado cargando */}
      {estado === 'cargando' && (
        <div className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          {/* Previews */}
          {previews.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {previews.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Cartulina ${i + 1}`}
                  className="h-20 w-auto rounded-[8px] object-cover shrink-0 border border-[var(--color-border)] opacity-60"
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <svg className="animate-spin w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Leyendo foto...</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">La IA está extrayendo los datos</p>
            </div>
          </div>
        </div>
      )}

      {/* Estado éxito */}
      {estado === 'exito' && (
        <div className="w-full rounded-[12px] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_6%,transparent)] p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-success)]">Datos extraídos — revisa y confirma</p>
              {advertencias.map((a, i) => (
                <p key={i} className="text-[11px] text-[var(--color-warning)] mt-0.5">{a}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={reintentar}
              className="text-[11px] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text-primary)] shrink-0 transition-colors"
            >
              Subir otra
            </button>
          </div>
        </div>
      )}

      {/* Estado error */}
      {estado === 'error' && (
        <div className="w-full rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)] p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-[var(--color-danger)] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-danger)]">{mensajeError}</p>
            </div>
            <button
              type="button"
              onClick={reintentar}
              className="text-[11px] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text-primary)] shrink-0 transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      {estado === 'idle' && (
        <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-1.5">
          Cartulina, cuaderno, libreta... hasta 5 fotos por cliente
        </p>
      )}
    </div>
  )
}
