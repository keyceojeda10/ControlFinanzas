import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-7xl font-bold text-[#f5c518] mb-2">404</div>
        <h1 className="text-xl font-bold text-white mb-2">Página no encontrada</h1>
        <p className="text-sm text-[#888] mb-6">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f5c518] text-black text-sm font-semibold rounded-xl hover:bg-[#f5c518]/90 transition-colors"
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
