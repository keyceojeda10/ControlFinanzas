'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { parsearTexto } from '@/lib/carga-masiva'

export default function PasoSubir({ onDatos }) {
  const [modo, setModo] = useState('archivo') // 'archivo' | 'pegar'
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
        setError('El archivo está vacío o no tiene datos')
        return
      }
      if (rows.length > 500) {
        setError('Máximo 500 filas. Tu archivo tiene ' + rows.length)
        return
      }

      // Normalizar headers (el xlsx los lee como están)
      const filas = rows.map(row => {
        const obj = {}
        for (const [key, val] of Object.entries(row)) {
          const k = key.trim().toLowerCase()
            .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
            .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
            .replace(/\s+/g, '')
            .replace('montoprestado', 'montoPrestado')
            .replace('tasainteres', 'tasaInteres')
            .replace('diasplazo', 'diasPlazo')
            .replace('fechainicio', 'fechaInicio')
            .replace('abonadohasta', 'abonadoHasta')
          obj[k] = val
        }
        return obj
      }).filter(obj => obj.nombre || obj.cedula)

      if (filas.length === 0) {
        setError('No se encontraron filas válidas')
        return
      }

      onDatos(filas)
    } catch {
      setError('Error al leer el archivo. Asegúrate de que sea un .xlsx o .xls válido.')
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
    const filas = parsearTexto(texto)
    if (filas.length === 0) {
      setError('No se encontraron datos válidos. La primera fila debe ser el encabezado.')
      return
    }
    if (filas.length > 500) {
      setError('Máximo 500 filas. Tienes ' + filas.length)
      return
    }
    onDatos(filas)
  }

  return (
    <div className="space-y-4">
      {/* Descargar plantilla */}
      <div className="bg-[#161b27] border border-[#2a2a2a] rounded-[14px] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.12)] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Plantilla Excel</p>
            <p className="text-[10px] text-[#888888] mt-0.5 leading-snug">
              Descarga la plantilla, llena los datos de tus clientes y prestamos, y subela aqui.
              Incluye instrucciones y ejemplos.
            </p>
            <a
              href="/api/carga-masiva/plantilla"
              download
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-[#f5c518] hover:text-[#f0b800] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar plantilla
            </a>
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
              ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[#f5c518]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#3a3a3a]',
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
              ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[#f5c518]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#3a3a3a]',
          ].join(' ')}
        >
          Pegar datos
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      {modo === 'archivo' ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#2a2a2a] hover:border-[#f5c518] rounded-[16px] p-8 text-center cursor-pointer transition-colors"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleArchivo}
            className="hidden"
          />
          <svg className="w-10 h-10 text-[#555555] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {cargando ? (
            <p className="text-sm text-[#f5c518] font-medium">Leyendo archivo...</p>
          ) : (
            <>
              <p className="text-sm text-white font-medium">Toca para seleccionar archivo</p>
              <p className="text-[10px] text-[#888888] mt-1">Excel (.xlsx, .xls) o CSV</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-[#888888] leading-snug">
            Pega datos directamente desde Excel o Google Sheets.
            La primera fila debe ser el encabezado con los nombres de las columnas.
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'nombre\tcedula\ttelefono\ttipo\tmontoPrestado\ttasaInteres\tdiasplazo\tfrecuencia\tfechaInicio\tabonadoHasta\nJuan Perez\t1234567890\t3001234567\tprestamo\t500000\t20\t30\tdiario\t01/04/2026\t'}
            rows={8}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-xs text-white font-mono placeholder-[#444444] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all resize-none"
          />
          <Button onClick={handlePegar} className="w-full">
            Procesar datos
          </Button>
        </div>
      )}
    </div>
  )
}
