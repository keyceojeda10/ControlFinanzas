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
              <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            {exitoso ? 'Importacion exitosa' : 'Importacion parcial'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)]">Clientes creados</p>
            <p className="text-xl font-bold text-[var(--color-success)]">{resultado.clientesCreados}</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)]">Prestamos creados</p>
            <p className="text-xl font-bold text-[var(--color-accent)]">{resultado.prestamosCreados}</p>
          </div>
          {resultado.pagosRegistrados > 0 && (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">Abonos registrados</p>
              <p className="text-xl font-bold text-[var(--color-info)]">{resultado.pagosRegistrados}</p>
            </div>
          )}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)]">Monto desembolsado</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] font-mono-display">{formatCOP(resultado.montoDesembolsado)}</p>
          </div>
        </div>

        {resultado.fallidos > 0 && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] p-4">
            <p className="text-sm font-semibold text-[var(--color-danger)] mb-2">
              {resultado.fallidos} cliente(s) no se pudieron importar
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {resultado.errores.map((e, i) => (
                <div key={i} className="text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-primary)]">{e.nombre}</span> ({e.cedula}): {e.error}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onReiniciar}
            className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            Importar mas
          </button>
          <Link
            href="/clientes"
            className="flex-1 h-11 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] text-sm font-semibold transition-colors flex items-center justify-center"
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
      <div className="bg-[#161b27] border border-[var(--color-border)] rounded-[14px] p-5 text-center">
        <svg className="w-12 h-12 text-[var(--color-accent)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">Confirmar importacion</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Se importaran <span className="text-[var(--color-accent)] font-semibold">{filas.length}</span> filas.
          Esta accion no se puede deshacer.
        </p>
      </div>

      {crearRuta && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5">
          <p className="text-[10px] text-[var(--color-text-muted)]">Se creara la ruta</p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{crearRuta}</p>
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onVolver}
          disabled={importando}
          className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
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
