'use client'
// components/auth/AuthButton.jsx — Boton submit premium con shimmer + arrow

export default function AuthButton({ loading, children, loadingLabel = 'Procesando...', ...props }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group relative w-full h-11 mt-1 rounded-[12px] overflow-hidden font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 75%, #f59e0b))',
        color: '#0a0a0a',
        boxShadow: '0 4px 14px rgba(245,197,24,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
      {...props}
    >
      {/* Shimmer overlay (solo cuando no esta loading) */}
      {!loading && (
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          }}
        />
      )}
      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {loadingLabel}
          </>
        ) : (
          <>
            {children}
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </span>
    </button>
  )
}
