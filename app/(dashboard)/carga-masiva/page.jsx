'use client'
// app/(dashboard)/carga-masiva/page.jsx - Importación masiva de clientes y préstamos

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import PasoSubir from '@/components/carga-masiva/PasoSubir'
import PasoRevisar from '@/components/carga-masiva/PasoRevisar'
import PasoConfirmar from '@/components/carga-masiva/PasoConfirmar'

const PASOS = [
  { num: 1, label: 'Subir datos' },
  { num: 2, label: 'Revisar' },
  { num: 3, label: 'Importar' },
]

export default function CargaMasivaPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()

  const [paso, setPaso] = useState(1)
  const [validando, setValidando] = useState(false)
  const [error, setError] = useState('')

  // Datos entre pasos
  const [filasValidadas, setFilasValidadas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [rutas, setRutas] = useState([])
  const [datosImportar, setDatosImportar] = useState(null)

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/dashboard')
  }, [authLoading, esOwner, router])

  // Paso 1 → 2: enviar datos crudos a la API de validación
  const handleDatos = async (filasCrudas) => {
    setValidando(true)
    setError('')
    try {
      const res = await fetch('/api/carga-masiva/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: filasCrudas }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al validar')
        return
      }
      setFilasValidadas(data.filas)
      setResumen(data.resumen)
      setRutas(data.rutas)
      setPaso(2)
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setValidando(false)
    }
  }

  // Paso 2 → 3: confirmar las filas válidas
  const handleConfirmar = (datos) => {
    setDatosImportar(datos)
    setPaso(3)
  }

  // Reiniciar
  const handleReiniciar = () => {
    setPaso(1)
    setFilasValidadas([])
    setResumen(null)
    setRutas([])
    setDatosImportar(null)
    setError('')
  }

  if (authLoading) return null
  if (!esOwner) return null

  return (
    <div className="max-w-xl mx-auto pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => paso === 1 ? router.back() : setPaso(p => p - 1)}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {paso === 1 ? 'Volver' : 'Paso anterior'}
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Importar clientes</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Carga clientes y prestamos de forma masiva
        </p>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2 mb-6">
        {PASOS.map((p, i) => (
          <div key={p.num} className="flex items-center gap-2 flex-1">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
              paso >= p.num
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]'
                : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]',
            ].join(' ')}>
              {paso > p.num ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : p.num}
            </div>
            <span className={[
              'text-xs font-medium hidden sm:block',
              paso >= p.num ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]',
            ].join(' ')}>
              {p.label}
            </span>
            {i < PASOS.length - 1 && (
              <div className={[
                'flex-1 h-[2px] rounded-full',
                paso > p.num ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)]',
              ].join(' ')} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {validando && (
        <div className="flex items-center justify-center gap-2 py-12">
          <svg className="animate-spin w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[var(--color-text-muted)]">Validando datos...</span>
        </div>
      )}

      {!validando && paso === 1 && (
        <PasoSubir onDatos={handleDatos} />
      )}

      {!validando && paso === 2 && resumen && (
        <PasoRevisar
          filas={filasValidadas}
          resumen={resumen}
          rutas={rutas}
          onConfirmar={handleConfirmar}
          onVolver={() => setPaso(1)}
        />
      )}

      {!validando && paso === 3 && datosImportar && (
        <PasoConfirmar
          datosImportar={datosImportar}
          onVolver={() => setPaso(2)}
          onReiniciar={handleReiniciar}
        />
      )}
    </div>
  )
}
