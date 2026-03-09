'use client'

import { useState, useEffect, Suspense } from 'react'
import Image                             from 'next/image'
import { useRouter, useSearchParams }    from 'next/navigation'
import Link                              from 'next/link'

// ─── Inner component uses useSearchParams ────────────────────────
function RegistroForm() {
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const refCode        = searchParams.get('ref')

  const [form, setForm] = useState({
    nombreOrganizacion: '',
    nombre:             '',
    email:              '',
    password:           '',
    confirmar:          '',
    terminosAceptados:  false,
  })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [referrer, setReferrer] = useState(null) // { nombreOrg: string } | null

  // Validate referral code on mount if present
  useEffect(() => {
    if (!refCode) return
    fetch(`/api/auth/validar-referido?code=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setReferrer({ nombreOrg: data.nombreOrg })
      })
      .catch(() => {})
  }, [refCode])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.email.trim() || !form.password) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (!form.terminosAceptados) {
      setError('Debes aceptar los términos y condiciones para continuar')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre:             form.nombre,
          email:              form.email,
          password:           form.password,
          terminosAceptados:  form.terminosAceptados,
          ...(refCode ? { ref: refCode } : {}),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al registrar')
        return
      }

      // Pixel Lead antes de redirigir
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead')
      }

      // Redirigir a verificar email — no hacer signIn hasta que esté verificado
      router.push('/verificar-email')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a0a0a] px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo-icon.svg" alt="Control Finanzas" width={56} height={56} className="mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold text-white tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-[#888888] mt-1">14 días gratis para probar la plataforma</p>
        </div>

        {/* Referral badge */}
        {referrer && (
          <div className="mb-4 flex items-center gap-2.5 bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-sm rounded-[10px] px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>
              Referido por <strong className="text-white">{referrer.nombreOrg}</strong>
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[24px] p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Nombre del negocio</label>
            <input
              type="text"
              value={form.nombreOrganizacion}
              onChange={set('nombreOrganizacion')}
              placeholder="Ej: Préstamos García"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Tu nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Ej: Carlos García"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Confirmar contraseña</label>
            <input
              type="password"
              value={form.confirmar}
              onChange={set('confirmar')}
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.terminosAceptados}
              onChange={(e) => setForm({ ...form, terminosAceptados: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded border-[#2a2a2a] bg-[#111111] text-[#f5c518] focus:ring-[#f5c518] focus:ring-offset-0 cursor-pointer accent-[#f5c518]"
            />
            <span className="text-xs text-[#888888] leading-relaxed">
              Al crear tu cuenta, aceptas nuestros{' '}
              <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer" className="text-[#f5c518] hover:underline">
                Términos de uso
              </a>{' '}
              y nuestra{' '}
              <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer" className="text-[#f5c518] hover:underline">
                Política de privacidad
              </a>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] disabled:opacity-60 text-[#0a0a0a] font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_0_20px_rgba(245,197,24,0.3)]"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creando cuenta...
              </>
            ) : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#888888]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#f5c518] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Page wrapper with Suspense (required for useSearchParams) ───
export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  )
}
