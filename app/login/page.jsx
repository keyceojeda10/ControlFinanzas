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
      style={{ background: '#0c0d11' }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: '#8a8e98' }}>
            EN VIVO · {today}
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: '#a3a8b2' }}>
            Plataforma operando con normalidad
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2fbe6a' }} />
          <span className="text-[12px] font-semibold" style={{ color: '#2fbe6a' }}>Sistemas activos</span>
        </div>
      </div>

      {/* Floating cards */}
      <div className="relative flex-1 my-10 min-h-[420px]">
        {/* Card 1: Recaudo */}
        <div
          className="absolute rounded-[20px] p-5"
          style={{
            top: '4%', left: '4%', width: '280px',
            background: '#16171c', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 1px 2px rgba(20,20,30,.04), 0 10px 30px rgba(20,20,30,.12)',
            transform: 'rotate(-2deg)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: '#8a8e98' }}>RECAUDO DE HOY</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(47,190,106,0.12)', color: '#2fbe6a' }}>+12%</span>
          </div>
          <p className="font-mono-display text-[28px] font-bold" style={{ color: '#f3f3f6' }}>
            <span className="text-[12px]" style={{ color: '#8a8e98' }}>$</span>38<span style={{ color: '#8a8e98' }}>.420.000</span>
          </p>
          <div className="flex items-end gap-[3px] mt-3 h-[28px]">
            {[8,12,10,14,11,16,13,18,15,20,17,22,19,24,28,26].map((h,i) => (
              <div key={i} className="flex-1 rounded-[1px]" style={{ height: `${h * 1.1}px`, background: i === 14 ? '#f5b824' : '#1e2027' }} />
            ))}
          </div>
        </div>

        {/* Card 2: Pago */}
        <div
          className="absolute rounded-[20px] p-5"
          style={{
            top: '46%', right: '2%', width: '300px',
            background: '#16171c', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 1px 2px rgba(20,20,30,.04), 0 10px 30px rgba(20,20,30,.12)',
            transform: 'rotate(1.5deg)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#5b8df5,#9385f5)', color: '#fff' }}>MR</div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold" style={{ color: '#f3f3f6' }}>Marisol Ramirez</p>
              <p className="text-[11px] font-medium" style={{ color: '#8a8e98' }}>Cuota 7/24 · PR-1209</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(245,184,36,0.12)', color: '#f5b824' }}>Pagado</span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: '#8a8e98' }}>MONTO</p>
              <p className="font-mono-display text-[14px] mt-0.5" style={{ color: '#f3f3f6' }}>$ 850.000</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: '#8a8e98' }}>VIA</p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: '#f3f3f6' }}>Nequi</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: '#8a8e98' }}>HORA</p>
              <p className="font-mono-display text-[13px] mt-0.5" style={{ color: '#f3f3f6' }}>14:32</p>
            </div>
          </div>
        </div>

        {/* Card 3: Ruta */}
        <div
          className="absolute rounded-[20px] p-5"
          style={{
            bottom: '2%', left: '10%', width: '260px',
            background: '#16171c', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 1px 2px rgba(20,20,30,.04), 0 10px 30px rgba(20,20,30,.12)',
            transform: 'rotate(-1deg)',
          }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-2.5" style={{ color: '#8a8e98' }}>RUTA HOY · DIEGO ORTIZ</p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center font-mono-display text-[13px] font-bold shrink-0" style={{ background: 'rgba(245,184,36,0.1)', color: '#f5b824' }}>8</div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#f3f3f6' }}>8 visitas programadas</p>
              <p className="text-[11px]" style={{ color: '#8a8e98' }}>Cra 43 → Belen → Estadio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div>
        <blockquote
          className="text-[22px] xl:text-[26px] leading-snug"
          style={{ color: '#a3a8b2', fontFamily: 'var(--font-space-grotesk)' }}
        >
          &ldquo;Pasamos de Excel a Control Finanzas y nuestra mora bajo del 14% al 5.2% en cuatro meses.&rdquo;
        </blockquote>
        <p className="text-[12.5px] mt-4 font-medium" style={{ color: '#8a8e98' }}>
          Ricardo Tovar · Prestamos del Valle · 800+ clientes activos
        </p>
      </div>
    </div>
  )
}

// Codigos internos de NextAuth. Cuando `authorize` devuelve null (correo que no
// existe, clave que no coincide) llega 'CredentialsSignin'; el resto son fallos
// de configuracion o de flujos OAuth que no usamos. Para todos ellos el mensaje
// correcto al usuario es el generico.
const CODIGOS_NEXTAUTH = new Set([
  'CredentialsSignin', 'Signin', 'Callback', 'Default', 'Configuration',
  'AccessDenied', 'Verification', 'SessionRequired', 'EmailSignin',
  'OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'OAuthAccountNotLinked',
  'EmailCreateAccount',
])

// Antes esto era una lista blanca de dos palabras ('desactivada', 'suspendida'),
// asi que cualquier mensaje nuevo de lib/auth.js nacia roto: se mostraba como
// "Correo o contraseña incorrectos". Eso se tragaba dos avisos que el usuario
// necesita para saber que hacer:
//
//   · "Demasiados intentos de inicio de sesion. Intenta en 15 minutos."
//   · "Tu cuenta de cobrador excede el limite del plan actual."
//
// En ambos casos la clave estaba BIEN, y decirle lo contrario lo empuja a
// resetear una contrasena correcta o a seguir intentando y extender el bloqueo.
//
// Ahora la regla es al reves: los codigos internos caen al generico y todo lo
// demas -- que solo puede venir de un `throw` nuestro, escrito en espanol para
// el usuario -- se muestra tal cual. Un mensaje nuevo en lib/auth.js ya no
// necesita tocar esta pantalla.
function esCodigoInterno(msg) {
  if (!msg) return true
  if (CODIGOS_NEXTAUTH.has(msg)) return true
  // Red de seguridad: los codigos son un solo token sin espacios; nuestros
  // mensajes son frases. Evita filtrar un codigo nuevo de NextAuth a la pantalla.
  return !msg.includes(' ')
}

// ── Main login page ─────────────────────────────────────────────
export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [verClave, setVerClave] = useState(false)
  const [recordar, setRecordar] = useState(true)
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
        setError(esCodigoInterno(msg) ? 'Correo o contraseña incorrectos' : msg)
        return
      }

      // Llegar aqui significa que signIn ACERTO: la persona ya esta dentro.
      // Esta consulta solo decide a que panel mandarla, asi que si falla —red
      // lenta, peticion abortada, respuesta a medias— NO es motivo para decirle
      // que no pudo entrar. Se va al panel normal, que es el caso de casi
      // todos, y el propio dashboard resuelve el rol.
      let esSuperadmin = false
      try {
        const sessionRes = await fetch('/api/auth/session')
        const session    = await sessionRes.json()
        esSuperadmin = session?.user?.rol === 'superadmin'
      } catch {
        esSuperadmin = false
      }

      window.location.href = esSuperadmin ? '/admin/inicio' : '/dashboard'
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
              <img src="/logo-icon.svg" alt="Control Finanzas" width={36} height={36} />
              <span className="flex flex-col leading-[1.1]" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--color-text-primary)' }}>
                <span className="text-[15px] font-bold tracking-[-0.01em]">Control</span>
                <span className="text-[13px] font-medium tracking-[0.02em]" style={{ color: 'var(--color-text-secondary)' }}>Finanzas</span>
              </span>
            </div>
          </div>

          {/* El copy del turno 4. "Bienvenido de vuelta" no dice nada del
              producto; esto sí dice a qué vuelves. */}
          <h1
            className="text-[28px] lg:text-[32px] leading-[1.12] font-semibold mb-2"
            style={{ color: 'var(--cf-ink)', fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-.025em' }}
          >
            Entra a tu cartera
          </h1>
          <p className="text-[14px] mb-7" style={{ color: 'var(--cf-ink-2)' }}>
            Tus clientes, tus rutas y tu caja, donde los dejaste.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2.5 text-[13px] rounded-[12px] px-4 py-3"
                style={{
                  background: 'var(--cf-red-bg)',
                  border: '1px solid var(--cf-red-border)',
                  color: 'var(--cf-red-darker)',
                }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v5M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            {/* Campos de 56px, etiqueta ARRIBA y 16px de fuente: por debajo de
                16px iOS hace zoom al enfocar y saca al usuario de la pantalla. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                Correo
              </span>
              <input
                type="text"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                style={{
                  height: 56, padding: '0 16px', borderRadius: 'var(--cf-r-control)',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  outline: 'none', fontSize: 16, color: 'var(--cf-ink)',
                }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              {/* "La olvidé" va en la fila de la etiqueta, no debajo del campo:
                  se busca ANTES de escribir mal la clave, no después. */}
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                  Contraseña
                </span>
                <Link href="/forgot-password" className="text-[12.5px] font-semibold hover:underline"
                  style={{ color: 'var(--cf-gold-dark)' }}>
                  La olvidé
                </Link>
              </span>
              <span className="relative flex items-center">
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: 56, padding: '0 52px 0 16px',
                    borderRadius: 'var(--cf-r-control)',
                    background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                    outline: 'none', fontSize: 16, color: 'var(--cf-ink)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar la contraseña' : 'Ver la contraseña'}
                  className="absolute right-2 inline-flex items-center justify-center"
                  // z-index: sin él el icono queda DEBAJO del fondo del campo en
                  // Safari iOS y no se ve.
                  style={{ width: 40, height: 40, borderRadius: 12, background: 'none', border: 0, zIndex: 2, color: 'var(--cf-ink-3)' }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {verClave
                      ? <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>
                      : <><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2" /><path d="M9.4 5.8A9.5 9.5 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3 3.8M6.3 7.3A17 17 0 002.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.8-.5" /></>}
                  </svg>
                </button>
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--cf-gold)' }}
              />
              <span className="text-[13px]" style={{ color: 'var(--cf-ink-2)' }}>
                Mantener la sesión en este teléfono
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 'var(--cf-h-btn)', borderRadius: 'var(--cf-r-control)',
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                border: 0, cursor: loading ? 'default' : 'pointer',
                fontSize: 15, fontWeight: 700, opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px" style={{ background: 'var(--cf-divider)' }} />
            <span className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>o</span>
            <span className="flex-1 h-px" style={{ background: 'var(--cf-divider)' }} />
          </div>

          <Link
            href="/registro"
            className="flex items-center justify-center"
            style={{
              height: 'var(--cf-h-btn-2)', borderRadius: 'var(--cf-r-control)',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)',
            }}
          >
            Crear cuenta gratis
          </Link>

          {/* La salida al portal del deudor, que hoy NO EXISTE desde el login:
              el cliente final llega aquí buscando su préstamo y se queda sin
              entender qué hacer, porque esta pantalla pide un correo que él
              nunca tuvo. */}
          <p className="text-[13px] mt-6 text-center leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
            ¿Eres cliente y quieres ver tu préstamo?{' '}
            <Link href="/portal" className="font-semibold hover:underline" style={{ color: 'var(--cf-gold-dark)' }}>
              Entra con tu cédula
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
