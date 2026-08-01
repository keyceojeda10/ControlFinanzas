'use client'

import { useState, useEffect } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { aplicarMapeo, parsearNumero } from '@/lib/carga-masiva'
import PasoSubir from '@/components/carga-masiva/PasoSubir'
import PasoMapear from '@/components/carga-masiva/PasoMapear'
import PasoRevisar from '@/components/carga-masiva/PasoRevisar'
import PasoConfirmar from '@/components/carga-masiva/PasoConfirmar'

const PASOS = [
  { num: 1, label: 'Subir' },
  { num: 2, label: 'Columnas' },
  { num: 3, label: 'Revisar' },
  { num: 4, label: 'Importar' },
]

export default function CargaMasivaPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()

  const [paso, setPaso] = useState(1)
  const [validando, setValidando] = useState(false)
  const [error, setError] = useState('')

  // ── ESTO VA ANTES QUE `useCabecera`, NO DESPUES ──
  // La pantalla no abria: «Cannot access 'handleVolver' before initialization».
  // El hook estaba en la PRIMERA linea del componente pasandole esta funcion,
  // que se declaraba noventa lineas mas abajo con `const`. Un `const` no se
  // puede leer antes de su linea, asi que la pantalla entera caia a la frontera
  // de error — importar el Excel era imposible.
  //
  // Es la misma forma que el «Cannot access 'O'» de produccion: una referencia
  // que sube mas arriba que su declaracion. Y no la caza ninguna prueba.
  const handleVolver = () => {
    if (paso === 1) {
      router.back()
    } else {
      setError('')
      setPaso((p) => p - 1)
    }
  }

  useCabecera({
    titulo: 'Importar clientes',
    subtitulo: 'Sube tu Excel o CSV y el sistema detecta las columnas',
    onVolver: handleVolver,
  })

  const [headersCrudos, setHeadersCrudos] = useState([])
  const [filasCrudas, setFilasCrudas] = useState([])

  const [filasValidadas, setFilasValidadas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [rutas, setRutas] = useState([])

  const [datosImportar, setDatosImportar] = useState(null)

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/dashboard')
  }, [authLoading, esOwner, router])

  const handleDatosCrudos = ({ headers, filas }) => {
    setHeadersCrudos(headers)
    setFilasCrudas(filas)
    setError('')
    setPaso(2)
  }

  const handleMapeoConfirmado = async (mapeo, multiplicador = 1) => {
    setValidando(true)
    setError('')
    try {
      const filasNormalizadas = aplicarMapeo(filasCrudas, mapeo)

      if (multiplicador > 1) {
        for (const fila of filasNormalizadas) {
          if (fila.montoPrestado) fila.montoPrestado = parsearNumero(fila.montoPrestado) * multiplicador
          if (fila.saldoActual) fila.saldoActual = parsearNumero(fila.saldoActual) * multiplicador
          if (fila.abonadoHasta) fila.abonadoHasta = parsearNumero(fila.abonadoHasta) * multiplicador
        }
      }

      if (filasNormalizadas.length === 0) {
        setError('No se encontraron filas con datos de nombre o cédula después de aplicar el mapeo')
        setValidando(false)
        return
      }

      const res = await fetch('/api/carga-masiva/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: filasNormalizadas }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al validar')
        setValidando(false)
        return
      }
      setFilasValidadas(data.filas)
      setResumen(data.resumen)
      setRutas(data.rutas)
      setPaso(3)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setValidando(false)
    }
  }

  const handleConfirmar = (datos) => {
    setDatosImportar(datos)
    setPaso(4)
  }

  const handleReiniciar = () => {
    setPaso(1)
    setHeadersCrudos([])
    setFilasCrudas([])
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
      {/* SIN FLECHA PROPIA Y SIN TITULO PROPIO. Los dos los pone el armazon.
          La flecha ademas hacia dos cosas —«Volver» o «Paso anterior»— y ahora
          eso viaja como `onVolver`, asi que sigue retrocediendo por pasos pero
          con un solo control en la pantalla. */}
      <div className="mb-6">
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-1.5 mb-6">
        {PASOS.map((p, i) => (
          <div key={p.num} className="flex items-center gap-1.5 flex-1">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
              paso >= p.num
                ? 'bg-[var(--cf-gold)] text-[var(--cf-ink)]'
                : 'bg-[var(--cf-fill)] text-[var(--cf-ink-3)]',
            ].join(' ')}>
              {paso > p.num ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : p.num}
            </div>
            <span className={[
              'text-[10px] font-medium hidden sm:block',
              paso >= p.num ? 'text-[var(--cf-ink)]' : 'text-[var(--cf-ink-3)]',
            ].join(' ')}>
              {p.label}
            </span>
            {i < PASOS.length - 1 && (
              <div className={[
                'flex-1 h-[2px] rounded-full',
                paso > p.num ? 'bg-[var(--cf-gold)]' : 'bg-[var(--cf-fill)]',
              ].join(' ')} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {validando && (
        <div className="flex items-center justify-center gap-2 py-12">
          <svg className="animate-spin w-5 h-5 text-[var(--cf-gold)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-[var(--cf-ink-3)]">Validando datos...</span>
        </div>
      )}

      {!validando && paso === 1 && (
        <PasoSubir onDatos={handleDatosCrudos} />
      )}

      {!validando && paso === 2 && headersCrudos.length > 0 && (
        <PasoMapear
          headers={headersCrudos}
          filas={filasCrudas}
          onConfirmar={handleMapeoConfirmado}
          onVolver={handleVolver}
        />
      )}

      {!validando && paso === 3 && resumen && (
        <PasoRevisar
          filas={filasValidadas}
          resumen={resumen}
          rutas={rutas}
          onConfirmar={handleConfirmar}
          onVolver={handleVolver}
        />
      )}

      {!validando && paso === 4 && datosImportar && (
        <PasoConfirmar
          datosImportar={datosImportar}
          onVolver={handleVolver}
          onReiniciar={handleReiniciar}
        />
      )}
    </div>
  )
}
