'use client'

export default function GlobalError({ error, reset }) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Algo salió mal</h1>
        <p className="text-sm text-[#888] mb-6">
          Ocurrió un error inesperado. Intenta de nuevo o contacta soporte si el problema persiste.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-[#f5c518] text-black text-sm font-semibold rounded-xl hover:bg-[#f5c518]/90 transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm rounded-xl hover:bg-[#222] transition-colors"
          >
            Ir al inicio
          </a>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className="mt-6 text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <summary className="text-xs text-[#666] cursor-pointer">Detalles del error</summary>
            <pre className="mt-2 text-xs text-[#ef4444] whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
