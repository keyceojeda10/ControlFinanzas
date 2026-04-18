'use client'
import { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        // NextAuth pasa el mensaje de throw new Error() en result.error
        const msg = result.error
        if (msg === 'VERIFY_EMAIL') {
          router.push(`/verificar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
          return
        }
        if (msg.includes('desactivada') || msg.includes('suspendida')) {
          setError(msg)
        } else {
          setError('Correo o contraseña incorrectos')
        }
        return
      }

      const sessionRes = await fetch('/api/auth/session')
      const session    = await sessionRes.json()

      if (session?.user?.rol === 'superadmin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--color-bg-base)] px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo-icon.svg" alt="Control Finanzas" width={56} height={56} className="mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Control Finanzas</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Gestiona tu cartera de préstamos</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[24px] p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[10px] px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
              Correo electrónico
            </label>
            <input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
              Contraseña
            </label>
            <input
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
            />
          </div>

          <div className="text-right">
            <a href="/forgot-password" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-[#0a0a0a] font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_0_20px_rgba(245,197,24,0.3)]"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ingresando...
              </>
            ) : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          ¿No tienes cuenta?{' '}
          <a href="/registro" className="text-[var(--color-accent)] hover:underline font-medium">
            Regístrate gratis
          </a>
        </p>
      </div>
    </div>
  )
}
