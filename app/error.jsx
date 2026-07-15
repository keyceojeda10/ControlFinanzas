'use client'

export default function GlobalError({ error, reset }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)' }}>
          <svg className="w-8 h-8 text-[var(--color-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)] mb-2">Algo salió mal</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Ocurrió un error inesperado. Intenta de nuevo o contacta soporte si el problema persiste.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-[var(--color-accent)] text-[#3a2900] text-sm font-semibold rounded-[12px] hover:opacity-90 transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-[12px] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Ir al inicio
          </a>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className="mt-6 text-left bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-4">
            <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer">Detalles del error</summary>
            <pre className="mt-2 text-xs text-[var(--color-danger)] whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
