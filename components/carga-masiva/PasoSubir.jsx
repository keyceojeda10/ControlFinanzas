'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'

export default function PasoSubir({ onDatos }) {
  const [modo, setModo] = useState('archivo')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const fileRef = useRef(null)

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setCargando(true)

    try {
      const XLSX = (await import('xlsx')).default
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (rows.length === 0) {
        setError('El archivo esta vacio o no tiene datos')
        return
      }
      if (rows.length > 500) {
        setError('Maximo 500 filas. Tu archivo tiene ' + rows.length)
        return
      }

      const headers = Object.keys(rows[0])
      if (headers.length === 0) {
        setError('No se encontraron columnas en el archivo')
        return
      }

      onDatos({ headers, filas: rows })
    } catch {
      setError('Error al leer el archivo. Asegurate de que sea un .xlsx, .xls o .csv válido.')
    } finally {
      setCargando(false)
    }
  }

  const handlePegar = () => {
    setError('')
    if (!texto.trim()) {
      setError('Pega los datos primero')
      return
    }
    const lineas = texto.trim().split('\n').filter(l => l.trim())
    if (lineas.length < 2) {
      setError('Necesitas al menos una fila de encabezado y una de datos')
      return
    }

    const sep = lineas[0].includes('\t') ? '\t' : lineas[0].includes(';') ? ';' : ','
    const headers = lineas[0].split(sep).map(h => h.trim()).filter(Boolean)
    if (headers.length === 0) {
      setError('No se encontraron columnas en la primera fila')
      return
    }

    const filas = lineas.slice(1).map(linea => {
      const valores = linea.split(sep)
      const obj = {}
      headers.forEach((h, i) => { obj[h] = valores[i]?.trim() ?? '' })
      return obj
    }).filter(obj => {
      return Object.values(obj).some(v => String(v).trim())
    })

    if (filas.length === 0) {
      setError('No se encontraron filas con datos')
      return
    }
    if (filas.length > 500) {
      setError('Maximo 500 filas. Tienes ' + filas.length)
      return
    }

    onDatos({ headers, filas })
  }

  return (
    <div className="space-y-4">
      {/* Explicacion */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.12)] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Sube cualquier Excel o CSV</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
              No necesitas una plantilla especial. Sube el archivo que ya tengas con tus clientes y el sistema detecta automaticamente las columnas.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModo('archivo')}
          className={[
            'py-2.5 rounded-[12px] border text-sm font-medium transition-all',
            modo === 'archivo'
              ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]',
          ].join(' ')}
        >
          Subir archivo
        </button>
        <button
          type="button"
          onClick={() => setModo('pegar')}
          className={[
            'py-2.5 rounded-[12px] border text-sm font-medium transition-all',
            modo === 'pegar'
              ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]',
          ].join(' ')}
        >
          Pegar datos
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      {modo === 'archivo' ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[var(--color-border)] hover:border-[#f5c518] rounded-[16px] p-8 text-center cursor-pointer transition-colors"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleArchivo}
            className="hidden"
          />
          <svg className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {cargando ? (
            <p className="text-sm text-[var(--color-accent)] font-medium">Leyendo archivo...</p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-primary)] font-medium">Toca para seleccionar archivo</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Excel (.xlsx, .xls) o CSV</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">
            Pega datos directamente desde Excel o Google Sheets.
            La primera fila debe ser el encabezado con los nombres de las columnas.
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Nombre\tCedula\tTelefono\tMonto\tInteres\tPlazo\nJuan Perez\t1234567890\t3001234567\t500000\t20\t30'}
            rows={8}
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-xs text-[var(--color-text-primary)] font-mono placeholder-[#444444] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all resize-none"
          />
          <Button onClick={handlePegar} className="w-full">
            Procesar datos
          </Button>
        </div>
      )}

      {/* Link plantilla opcional */}
      <div className="text-center">
        <a
          href="/api/carga-masiva/plantilla"
          download
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar plantilla de ejemplo (opcional)
        </a>
      </div>
    </div>
  )
}
