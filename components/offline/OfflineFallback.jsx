'use client'

import { useRouter } from 'next/navigation'

// Pantalla amigable para funciones que NO estan disponibles offline.
// Muestra mensaje claro + boton para volver.
export default function OfflineFallback({
  titulo = 'Esta funcion no esta disponible sin conexion',
  descripcion = 'Vuelve a intentarlo cuando recuperes la red. Puedes seguir usando las partes principales de la app mientras tanto.',
  volverHref = '/dashboard',
  volverLabel = 'Volver al Dashboard',
}) {
  const router = useRouter()
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="mx-auto w-20 h-20 rounded-full bg-[var(--color-warning-dim)] border border-[var(--color-warning)] flex items-center justify-center">
          <svg className="w-10 h-10 text-[var(--color-warning)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{titulo}</h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{descripcion}</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => router.push(volverHref)}
            className="w-full h-11 rounded-xl bg-[var(--color-accent)] text-black text-sm font-bold"
          >
            {volverLabel}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full h-10 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            Regresar
          </button>
        </div>
      </div>
    </div>
  )
}
