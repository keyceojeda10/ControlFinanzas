import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-7xl font-bold text-[var(--color-accent)] mb-2">404</div>
        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)] mb-2">Página no encontrada</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-[#3a2900] text-sm font-semibold rounded-[12px] hover:opacity-90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
