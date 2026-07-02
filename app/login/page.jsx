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
      className="cf-showcase hidden lg:flex flex-col justify-between relative overflow-hidden p-10 xl:p-14"
      style={{ background: '#0d0d0d' }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-mono" style={{ color: '#999' }}>
            EN VIVO · {today}
          </p>
          <p className="text-[12px] mt-1" style={{ color: '#888' }}>
            Plataforma operando con normalidad
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-[12px]" style={{ color: '#22c55e' }}>Sistemas activos</span>
        </div>
      </div>

      {/* Floating cards */}
      <div className="relative flex-1 my-10 min-h-[420px]">
        {/* Card 1: Recaudo */}
        <div
          className="absolute rounded-[12px] p-5"
          style={{
            top: '4%', left: '4%', width: '280px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            transform: 'rotate(-2deg)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] tracking-wider" style={{ color: '#888' }}>RECAUDO DE HOY</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>+12%</span>
          </div>
          <p className="font-mono text-[28px] font-bold" style={{ color: '#f0f0f5' }}>
            <span className="text-[12px]" style={{ color: '#888' }}>$</span>38<span style={{ color: '#888' }}>.420.000</span>
          </p>
          <div className="flex items-end gap-[3px] mt-3 h-[28px]">
            {[8,12,10,14,11,16,13,18,15,20,17,22,19,24,28,26].map((h,i) => (
              <div key={i} className="flex-1 rounded-[1px]" style={{ height: `${h * 1.1}px`, background: i === 14 ? '#f5c518' : '#2a2a2a' }} />
            ))}
          </div>
        </div>

        {/* Card 2: Pago */}
        <div
          className="absolute rounded-[12px] p-5"
          style={{
            top: '46%', right: '2%', width: '300px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            transform: 'rotate(1.5deg)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', color: '#fff' }}>MR</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium" style={{ color: '#f0f0f5' }}>Marisol Ramírez</p>
              <p className="text-[11px]" style={{ color: '#888' }}>Cuota 7/24 · PR-1209</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518' }}>Pagado</span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#888' }}>MONTO</p>
              <p className="text-[14px] font-mono mt-0.5" style={{ color: '#f0f0f5' }}>$ 850.000</p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#888' }}>VIA</p>
              <p className="text-[13px] mt-0.5" style={{ color: '#f0f0f5' }}>Nequi</p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: '#888' }}>HORA</p>
              <p className="text-[13px] font-mono mt-0.5" style={{ color: '#f0f0f5' }}>14:32</p>
            </div>
          </div>
        </div>

        {/* Card 3: Ruta */}
        <div
          className="absolute rounded-[12px] p-5"
          style={{
            bottom: '2%', left: '10%', width: '260px',
            background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            transform: 'rotate(-1deg)',
          }}
        >
          <p className="text-[11px] tracking-wider mb-2.5" style={{ color: '#888' }}>RUTA HOY · DIEGO ORTIZ</p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[13px] font-bold shrink-0" style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518' }}>8</div>
            <div>
              <p className="text-[13px]" style={{ color: '#f0f0f5' }}>8 visitas programadas</p>
              <p className="text-[11px]" style={{ color: '#888' }}>Cra 43 → Belén → Estadio</p>
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
        <p className="text-[12px] mt-4" style={{ color: '#888' }}>
          — Ricardo Tovar · Préstamos del Valle · 800+ clientes activos
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
          setError('Correo o contraseña incorrectos')
        }
        return
      }

      const sessionRes = await fetch('/api/auth/session')
      const session    = await sessionRes.json()

      if (session?.user?.rol === 'superadmin') {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2" style={{ background: 'var(--color-bg-base)' }}>
      {/* ── Left panel: Form ── */}
      <div className="flex flex-col justify-center items-center px-6 py-10 lg:px-12 xl:px-20 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <img src="/logo-icon.svg" alt="Control Finanzas" width={38} height={38} />
              <span className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Control Finanzas</span>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-[32px] lg:text-[38px] leading-[1.1] font-normal mb-2"
            style={{ color: 'var(--color-text-primary)', fontFamily: "var(--font-serif-display), Georgia, serif" }}
          >
            Bienvenido<br />de <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>vuelta</em>.
          </h1>
          <p className="text-[14px] mb-8" style={{ color: 'var(--color-text-muted)' }}>
            La plataforma de cartera más usada por prestamistas en Colombia.
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
              label="Correo o número de WhatsApp"
              type="text"
              inputMode="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com o 3001234567"
              iconPath="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />

            <AuthInput
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              showPasswordToggle
              iconPath="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs hover:underline transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Olvidaste tu contraseña?
              </Link>
            </div>

            <AuthButton loading={loading} loadingLabel="Ingresando...">
              Iniciar sesión
            </AuthButton>
          </form>

          {/* Sign up link */}
          <p className="text-[13px] mt-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Apenas empiezas?{' '}
            <Link href="/registro" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
              Crea tu cuenta
            </Link>
          </p>

          {/* Compliance footer */}
          <div className="flex items-center justify-center gap-4 mt-10 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
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
