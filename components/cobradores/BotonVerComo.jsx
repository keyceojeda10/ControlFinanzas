'use client'
/* «Ver como Juan»: abre la app como la ve él, en solo lectura. Ver lib/modo-vista.js. */
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { marcarSoloLectura } from '@/lib/modo-vista'
import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'

// El proveedor `pase` lanza este código tal cual cuando el cobrador nunca
// verificó su correo (misma puerta que en el login con clave). El código a
// secas no dice nada en español — aquí sí explica que ese cobrador tampoco
// puede entrar todavía.
const MENSAJE_VERIFY_EMAIL = 'Este cobrador no ha verificado su correo: tampoco él puede entrar hasta hacerlo.'

export default function BotonVerComo({ cobradorId, nombre }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function ver() {
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/ver-como', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobradorId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'No se pudo abrir.'); return }
      // La marca ANTES de entrar: desde ya, este teléfono no sube ni guarda nada.
      marcarSoloLectura(true)
      const r = await signIn('pase', { pase: d.pase, redirect: false })
      if (r?.error) {
        marcarSoloLectura(false)
        setError(r.error === 'VERIFY_EMAIL' ? MENSAJE_VERIFY_EMAIL : r.error)
        return
      }
      await olvidarLecturasDeOtraCuenta()
      window.location.href = '/dashboard'
    } catch {
      marcarSoloLectura(false)
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={ver} disabled={cargando}
        className="flex items-center justify-center gap-2 w-full"
        style={{ height: 'var(--cf-h-btn-2)', borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
        {cargando ? 'Abriendo…' : `Ver como ${nombre}`}
      </button>
      <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
        Ves su caja y su ruta como él las ve. Solo lectura: desde ahí no se registra nada.
      </p>
      {error && <p className="text-[13px]" style={{ color: 'var(--cf-red-darker)' }}>{error}</p>}
    </div>
  )
}
