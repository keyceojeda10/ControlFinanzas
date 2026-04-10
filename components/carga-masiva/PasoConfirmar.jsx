'use client'

import { useState } from 'react'
import { formatCOP } from '@/lib/calculos'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function PasoConfirmar({ datosImportar, onVolver, onReiniciar }) {
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const { filas, rutaId, crearRuta } = datosImportar

  const handleImportar = async () => {
    setImportando(true)
    setError('')
    try {
      const res = await fetch('/api/carga-masiva/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas, rutaId, crearRuta }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al importar')
        return
      }
      setResultado(data.resultado)
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setImportando(false)
    }
  }

  // --- Vista de resultado ---
  if (resultado) {
    const exitoso = resultado.fallidos === 0
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className={[
            'w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4',
            exitoso ? 'bg-[rgba(34,197,94,0.15)]' : 'bg-[rgba(245,158,11,0.15)]',
          ].join(' ')}>
            {exitoso ? (
              <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {exitoso ? 'Importacion exitosa' : 'Importacion parcial'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[#888888]">Clientes creados</p>
            <p className="text-xl font-bold text-[#22c55e]">{resultado.clientesCreados}</p>
          </div>
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[#888888]">Prestamos creados</p>
            <p className="text-xl font-bold text-[#f5c518]">{resultado.prestamosCreados}</p>
          </div>
          {resultado.pagosRegistrados > 0 && (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
              <p className="text-[10px] text-[#888888]">Abonos registrados</p>
              <p className="text-xl font-bold text-[#3b82f6]">{resultado.pagosRegistrados}</p>
            </div>
          )}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[#888888]">Monto desembolsado</p>
            <p className="text-base font-bold text-white font-mono-display">{formatCOP(resultado.montoDesembolsado)}</p>
          </div>
        </div>

        {resultado.fallidos > 0 && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] p-4">
            <p className="text-sm font-semibold text-[#ef4444] mb-2">
              {resultado.fallidos} cliente(s) no se pudieron importar
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {resultado.errores.map((e, i) => (
                <div key={i} className="text-xs text-[#888888]">
                  <span className="text-white">{e.nombre}</span> ({e.cedula}): {e.error}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onReiniciar}
            className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] border border-[#2a2a2a] text-white text-sm font-medium transition-colors hover:bg-[#2a2a2a]"
          >
            Importar mas
          </button>
          <Link
            href="/clientes"
            className="flex-1 h-11 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white text-sm font-semibold transition-colors flex items-center justify-center"
          >
            Ver clientes
          </Link>
        </div>
      </div>
    )
  }

  // --- Vista de confirmación antes de importar ---
  return (
    <div className="space-y-4">
      <div className="bg-[#161b27] border border-[#2a2a2a] rounded-[14px] p-5 text-center">
        <svg className="w-12 h-12 text-[#f5c518] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <h2 className="text-lg font-bold text-white mb-1">Confirmar importacion</h2>
        <p className="text-sm text-[#888888]">
          Se importaran <span className="text-[#f5c518] font-semibold">{filas.length}</span> filas.
          Esta accion no se puede deshacer.
        </p>
      </div>

      {crearRuta && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-3 py-2.5">
          <p className="text-[10px] text-[#888888]">Se creara la ruta</p>
          <p className="text-sm font-semibold text-white">{crearRuta}</p>
        </div>
      )}

      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onVolver}
          disabled={importando}
          className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] border border-[#2a2a2a] text-white text-sm font-medium transition-colors hover:bg-[#2a2a2a] disabled:opacity-50"
        >
          Volver
        </button>
        <Button onClick={handleImportar} loading={importando} className="flex-1">
          {importando ? 'Importando...' : 'Importar todo'}
        </Button>
      </div>
    </div>
  )
}
