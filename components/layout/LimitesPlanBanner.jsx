'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export default function LimitesPlanBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [uso, setUso] = useState(null)

  const rol = session?.user?.rol
  const orgId = session?.user?.organizationId

  useEffect(() => {
    if (!orgId || rol !== 'owner') return
    let cancelado = false
    fetch('/api/plan/uso')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelado && d) setUso(d) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [orgId, rol, pathname])

  if (!uso?.excedeAlgo) return null

  const detalles = []
  if (uso.clientes.usado > uso.clientes.limite)
    detalles.push(`${uso.clientes.usado}/${uso.clientes.limite} clientes`)
  if (uso.rutas.usado > uso.rutas.limite)
    detalles.push(`${uso.rutas.usado}/${uso.rutas.limite} rutas`)
  if (uso.usuarios.usado > uso.usuarios.limite)
    detalles.push(`${uso.usuarios.usado}/${uso.usuarios.limite} usuarios`)

  return (
    <div
      className="border-b"
      style={{
        background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-card))',
        borderColor: 'color-mix(in srgb, var(--color-warning) 25%, var(--color-border))',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-warning) 18%, transparent)' }}
        >
          <svg className="w-4 h-4" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--color-warning)' }}>
            Excedes los limites de tu plan
          </p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {detalles.join(', ')}. Algunas funciones estan restringidas.
          </p>
        </div>
        <Link
          href="/configuracion/plan"
          className="shrink-0 h-8 px-3 rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1 transition-all"
          style={{
            background: 'var(--color-warning)',
            color: '#000',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--color-warning) 30%, transparent)',
          }}
        >
          Mejorar plan
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
