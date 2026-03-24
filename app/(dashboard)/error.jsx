'use client'

export default function DashboardError({ error, reset }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white mb-2">Error en la página</h2>
        <p className="text-sm text-[#888] mb-5">
          No pudimos cargar esta sección. Intenta de nuevo.
        </p>

        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-[#f5c518] text-black text-sm font-semibold rounded-xl hover:bg-[#f5c518]/90 transition-colors"
        >
          Reintentar
        </button>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className="mt-5 text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
            <summary className="text-xs text-[#666] cursor-pointer">Detalles</summary>
            <pre className="mt-2 text-xs text-[#ef4444] whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
