'use client'

import { useEffect, useState } from 'react'

export default function DashboardError({ error, reset }) {
  const [isOffline, setIsOffline] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    const offline = !navigator.onLine
    setIsOffline(offline)

    // If offline, auto-reload ONCE so the SW serves cached HTML
    // and the page can load data from IndexedDB
    if (offline) {
      const key = 'cf-offline-reload-' + window.location.pathname
      const already = sessionStorage.getItem(key)
      if (!already) {
        sessionStorage.setItem(key, '1')
        setReloading(true)
        // Small delay so user sees the message
        setTimeout(() => window.location.reload(), 300)
      }
    }
  }, [])

  // Clear the reload flag when back online
  useEffect(() => {
    const handleOnline = () => {
      // Clear all offline reload flags
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i)
        if (k?.startsWith('cf-offline-reload-')) sessionStorage.removeItem(k)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  if (reloading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Cargando datos offline...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)' }}>
          <svg className="w-7 h-7 text-[var(--color-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          {isOffline ? 'Sin conexión' : 'Error en la página'}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          {isOffline
            ? 'No se pudo cargar esta sección offline. Intenta recargar.'
            : 'No pudimos cargar esta sección. Intenta de nuevo.'}
        </p>

        <div className="flex flex-col gap-2 items-center">
          <button
            onClick={() => isOffline ? window.location.reload() : reset()}
            className="px-5 py-2.5 bg-[var(--color-accent)] text-[#3a2900] text-sm font-semibold rounded-[12px] hover:opacity-90 transition-colors"
          >
            Reintentar
          </button>
          {isOffline && (
            <p className="text-xs text-[var(--color-accent)] mt-2">
              Usa el botón "Preparar offline" en el Dashboard antes de salir a cobrar
            </p>
          )}
        </div>

        {error?.message && (
          <details className="mt-5 text-left bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3">
            <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer">Detalles técnicos</summary>
            <pre className="mt-2 text-xs text-[var(--color-danger)] whitespace-pre-wrap break-words">{error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ''}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
