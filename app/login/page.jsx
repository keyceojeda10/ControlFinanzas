'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AuthInput  from '@/components/auth/AuthInput'
import AuthButton from '@/components/auth/AuthButton'

// ── Showcase cards (decorative, hardcoded data) ─────────────────
function ShowcasePanel() {
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()

  return (
    <div
      className="hidden lg:flex flex-col justify-between relative overflow-hidden p-10 xl:p-14"
      style={{ background: '#0d0d0d' }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-mono" style={{ color: '#999' }}>
            EN VIVO · {today}
          </p>
          <p className="text-[12px] mt-1" style={{ color: '#666' }}>
            Plataforma operando con normalidad
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-[12px]" style={{ color: '#22c55e' }}>Sistemas activos</span>
        </div>
      </div>

      {/* Floating cards */}
      <div className="relative flex-1 my-8">
        {/* Card 1: Recaudo */}
        <div
          className="absolute rounded-[14px] p-5"
          style={{
            top: '8%', left: '8%', width: '280px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            transform: 'rotate(-2deg)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] tracking-wider" style={{ color: '#666' }}>RECAUDO DE HOY</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>+12%</span>
          </div>
          <p className="font-mono text-[28px] font-bold" style={{ color: '#f0f0f5' }}>
            <span className="text-[12px]" style={{ color: '#666' }}>$</span>38<span style={{ color: '#666' }}>.420.000</span>
          </p>
          <div className="flex items-end gap-[3px] mt-3 h-[28px]">
            {[8,12,10,14,11,16,13,18,15,20,17,22,19,24,28,26].map((h,i) => (
              <div key={i} className="flex-1 rounded-[1px]" style={{ height: `${h * 1.1}px`, background: i === 14 ? '#f5c518' : '#1f1f1f' }} />
            ))}
          </div>
        </div>

        {/* Card 2: Pago */}
        <div
          className="absolute rounded-[14px] p-5"
          style={{
            top: '38%', right: '5%', width: '300px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            transform: 'rotate(1.5deg)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', color: '#fff' }}>MR</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium" style={{ color: '#f0f0f5' }}>Marisol Ramirez</p>
              <p className="text-[11px]" style={{ color: '#666' }}>Cuota 7/24 · PR-1209</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518' }}>Pagado</span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#666' }}>MONTO</p>
              <p className="text-[14px] font-mono mt-0.5" style={{ color: '#f0f0f5' }}>$ 850.000</p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#666' }}>VIA</p>
              <p className="text-[13px] mt-0.5" style={{ color: '#f0f0f5' }}>Nequi</p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#666' }}>HORA</p>
              <p className="text-[13px] font-mono mt-0.5" style={{ color: '#f0f0f5' }}>14:32</p>
            </div>
          </div>
        </div>

        {/* Card 3: Ruta */}
        <div
          className="absolute rounded-[14px] p-5"
          style={{
            bottom: '8%', left: '15%', width: '260px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            transform: 'rotate(-1deg)',
          }}
        >
          <p className="text-[11px] tracking-wider mb-2.5" style={{ color: '#666' }}>RUTA HOY · DIEGO ORTIZ</p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[13px] font-bold" style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518' }}>8</div>
            <div>
              <p className="text-[13px]" style={{ color: '#f0f0f5' }}>8 visitas programadas</p>
              <p className="text-[11px]" style={{ color: '#666' }}>Cra 43 → Belen → Estadio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div>
        <blockquote
          className="text-[22px] xl:text-[26px] leading-snug italic"
          style={{ color: '#ccc', fontFamily: "var(--font-serif-display), Georgia, serif" }}
        >
          &ldquo;Pasamos de Excel a Control Finanzas y nuestra mora bajo del 14% al 5.2% en cuatro meses.&rdquo;
        </blockquote>
        <p className="text-[12px] mt-4" style={{ color: '#666' }}>
          — Ricardo Tovar · Prestamos del Valle · 800+ clientes activos
        </p>
      </div>
    </div>
  )
}

// ── Main login page ─────────────────────────────────────────────
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
        const msg = result.error
        if (msg === 'VERIFY_EMAIL') {
          router.push(`/verificar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
          return
        }
        if (msg.includes('desactivada') || msg.includes('suspendida')) {
          setError(msg)
        } else {
          setError('Correo o contrasena incorrectos')
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
      setError('Error al iniciar sesion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2" style={{ background: '#060609' }}>
      {/* ── Left panel: Form ── */}
      <div className="flex flex-col justify-center items-center px-6 py-10 lg:px-12 xl:px-20 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f5c518, #f2b211)' }}
              >
                <img src="/logo-icon.svg" alt="" width={24} height={24} />
              </div>
              <span className="text-[15px] font-bold" style={{ color: '#f0f0f5' }}>Control Finanzas</span>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-[32px] lg:text-[38px] leading-[1.1] font-normal mb-2"
            style={{ color: '#f0f0f5', fontFamily: "var(--font-serif-display), Georgia, serif" }}
          >
            Bienvenida<br />de <em style={{ color: '#f5c518', fontStyle: 'italic' }}>vuelta</em>.
          </h1>
          <p className="text-[14px] mb-8" style={{ color: '#666' }}>
            La plataforma de cartera mas usada por prestamistas en Colombia.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-3"
                style={{
                  background: 'rgba(248,113,113,0.10)',
                  border: '1px solid rgba(248,113,113,0.30)',
                  color: '#f87171',
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <AuthInput
              id="email"
              label="Correo electronico"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              }
            />

            <AuthInput
              id="password"
              label="Contrasena"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              showPasswordToggle
              icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
            />

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs hover:underline transition-colors"
                style={{ color: '#666' }}
              >
                Olvidaste tu contrasena?
              </Link>
            </div>

            <AuthButton loading={loading} loadingLabel="Ingresando...">
              Iniciar sesion
            </AuthButton>
          </form>

          {/* OAuth divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-[12px]" style={{ color: '#666' }}>o continua con</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* OAuth buttons (visual only) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-10 rounded-[10px] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              className="h-10 rounded-[10px] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23" fill="currentColor">
                <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z"/>
              </svg>
              Microsoft
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-[13px] mt-8 text-center" style={{ color: '#666' }}>
            Apenas empiezas?{' '}
            <Link href="/registro" className="font-medium hover:underline" style={{ color: '#f5c518' }}>
              Crea tu cuenta
            </Link>
          </p>

          {/* Compliance footer */}
          <div className="flex items-center justify-center gap-4 mt-10 text-[11px]" style={{ color: '#444' }}>
            <span>Cifrado SSL</span>
            <span>·</span>
            <span>Colombia</span>
            <span>·</span>
            <span>v 4.2</span>
          </div>
        </div>
      </div>

      {/* ── Right panel: Showcase (desktop only) ── */}
      <ShowcasePanel />
    </div>
  )
}
