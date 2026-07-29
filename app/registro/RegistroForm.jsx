'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { signIn }              from 'next-auth/react'
import Link                    from 'next/link'
import { EspinaProgreso }      from '@/components/armazon/CabeceraMovil'
import AuthInput               from '@/components/auth/AuthInput'
import AuthButton              from '@/components/auth/AuthButton'
import { getCountryConfig, validatePhone } from '@/lib/i18n'
import { getCountryList } from '@/lib/countries'
import { normalizarEmail } from '@/lib/normalizar-email'

const PAISES = getCountryList()
const FLAGS = {
  co: '\u{1F1E8}\u{1F1F4}', mx: '\u{1F1F2}\u{1F1FD}', pe: '\u{1F1F5}\u{1F1EA}',
  ec: '\u{1F1EA}\u{1F1E8}', do: '\u{1F1E9}\u{1F1F4}', hn: '\u{1F1ED}\u{1F1F3}',
  gt: '\u{1F1EC}\u{1F1F9}', sv: '\u{1F1F8}\u{1F1FB}', ni: '\u{1F1F3}\u{1F1EE}',
  pa: '\u{1F1F5}\u{1F1E6}', ve: '\u{1F1FB}\u{1F1EA}', us: '\u{1F1FA}\u{1F1F8}',
  cr: '\u{1F1E8}\u{1F1F7}',
}

const TOTAL_STEPS = 5

const LIGHT = {
  bg: '#f4f4f1', bgCard: '#ffffff', bgCardHover: 'rgba(20,20,28,0.03)',
  border: 'rgba(20,20,28,0.08)', borderLight: 'rgba(20,20,28,0.06)',
  text: '#15161a', textSecondary: '#676b73', textMuted: '#9a9da5',
  gradient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(231,164,0,0.10) 0%, transparent 70%)',
  optionBg: '#ffffff',
}
const DARK = {
  bg: '#0c0d11', bgCard: '#16171c', bgCardHover: '#1e2027',
  border: 'rgba(255,255,255,0.08)', borderLight: 'rgba(255,255,255,0.06)',
  text: '#f3f3f6', textSecondary: '#9ea1ab', textMuted: '#666973',
  gradient: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,184,36,0.07) 0%, transparent 70%)',
  optionBg: '#16171c',
}

function useTheme() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const resolve = () => {
      const dt = document.documentElement.getAttribute('data-theme')
      if (dt) return dt === 'light'
      return window.matchMedia('(prefers-color-scheme: light)').matches
    }
    setLight(resolve())
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => setLight(resolve())
    mq.addEventListener('change', handler)
    const obs = new MutationObserver(handler)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { mq.removeEventListener('change', handler); obs.disconnect() }
  }, [])
  return light ? LIGHT : DARK
}

// El wizard son CUATRO pasos: nombre, negocio, WhatsApp, correo y clave.
// El quinto (verificar) ya no es registro: es confirmar.
const PASOS = 4

function BackButton({ onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors mb-6"
      style={{ color: theme.textMuted }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Atrás
    </button>
  )
}

function ContinueButton({ onClick, disabled, children = 'Continuar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full h-12 rounded-[12px] overflow-hidden font-bold text-[15px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 85%, #000))',
        color: '#3a2900',
        boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent)',
      }}
    >
      <span className="relative flex items-center justify-center gap-2">
        {children}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </span>
    </button>
  )
}

export default function RegistroForm({ refCode, planParam, countryParam }) {
  const router = useRouter()
  const t = useTheme()

  const planSilencioso = planParam || 'starter'
  const countryInicial = PAISES.some(p => p.code === countryParam) ? countryParam : 'co'

  // Arranca en el primer paso REAL. La portada de bienvenida se quito: nadie se
  // registra para leer una portada, y era un clic entero antes de escribir nada.
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState(countryInicial)
  const countryCfg = getCountryConfig(country)

  const [form, setForm] = useState({
    nombre: '',
    nombreOrganizacion: '',
    telefono: '',
    email: '',
    password: '',
    terminosAceptados: false,
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [referrer, setReferrer] = useState(null)

  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading]       = useState(false)
  const [otpError, setOtpError]           = useState('')
  const [otpReenviado, setOtpReenviado]   = useState(false)
  const [otpReenviando, setOtpReenviando] = useState(false)
  const [verificarPor, setVerificarPor]   = useState('whatsapp')

  useEffect(() => {
    if (!refCode) return
    fetch(`/api/auth/validar-referido?code=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((data) => { if (data.valid) setReferrer({ nombreOrg: data.nombreOrg }) })
      .catch(() => {})
  }, [refCode])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [step])

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError('') }

  const goNext = () => setStep(s => s + 1)
  const goBack = () => { setStep(s => s - 1); setError('') }

  const handleStep1 = () => {
    if (!form.nombre.trim()) { setError('Ingresa tu nombre'); return }
    goNext()
  }

  const handleStep2 = () => {
    if (!form.nombreOrganizacion.trim()) { setError('Ingresa el nombre de tu negocio'); return }
    goNext()
  }

  const handleStep3 = () => {
    const limpio = form.telefono.replace(/\D/g, '')
    if (!limpio) { setError('Ingresa tu número de WhatsApp'); return }
    if (!validatePhone(limpio, country)) {
      setError(`Número inválido. Ej: ${countryCfg.phonePlaceholder}`); return
    }
    goNext()
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.email.trim()) { setError('Ingresa tu correo electrónico'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (!form.terminosAceptados) { setError('Debes aceptar los términos y condiciones'); return }

    const telefonoLimpio = form.telefono.replace(/\D/g, '')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre: form.nombre,
          email: form.email,
          telefono: telefonoLimpio,
          password: form.password,
          terminosAceptados: form.terminosAceptados,
          ...(refCode ? { ref: refCode } : {}),
          plan: planSilencioso,
          country,
          canal: 'whatsapp',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar'); return }

      if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'Lead')
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18050279366/LY3nCKOGrcgcEMbPhZ9D',
          value: 39000.0, currency: 'COP',
        })
      }
      setStep(5)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarOtp = async (codigoFinal) => {
    const codigo = codigoFinal || otpDigits.join('')
    if (codigo.length !== 6) { setOtpError('Ingresa el código de 6 dígitos'); return }
    setOtpLoading(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizarEmail(form.email), codigo }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error || 'Código inválido'); setOtpLoading(false); return }

      const login = await signIn('credentials', {
        email: normalizarEmail(form.email),
        password: form.password,
        redirect: false,
      })
      if (login?.ok) { router.push('/dashboard'); return }
      router.push('/login')
    } catch {
      setOtpError('Error de conexión')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleSaltarVerificacion = async () => {
    setOtpLoading(true)
    const login = await signIn('credentials', {
      email: normalizarEmail(form.email),
      password: form.password,
      redirect: false,
    })
    if (login?.ok) { router.push('/dashboard'); return }
    router.push('/login')
  }

  const handleReenviarOtp = async () => {
    if (otpReenviando || otpReenviado) return
    setOtpReenviando(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizarEmail(form.email), canal: verificarPor }),
      })
      setOtpReenviado(true)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpError('')
      setTimeout(() => setOtpReenviado(false), 30000)
    } finally {
      setOtpReenviando(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus()
    if (value && index === 5) {
      const codigo = newDigits.join('')
      if (codigo.length === 6) handleVerificarOtp(codigo)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0)
      document.getElementById(`otp-${index - 1}`)?.focus()
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || ''
    setOtpDigits(newDigits)
    if (pasted.length === 6) handleVerificarOtp(pasted)
  }

  const selectedFlag = FLAGS[country] || '\u{1F310}'
  const accentColor = verificarPor === 'whatsapp' ? '#25d366' : 'var(--color-accent)'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.bg }}>
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: t.gradient }} />

      <div className="relative flex-1 flex flex-col items-center px-5 py-8 lg:py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="mb-6">
            <Link href="/login" className="inline-flex items-center gap-2.5">
              <img src="/logo-icon.svg" alt="" width={36} height={36} />
              <span className="flex flex-col leading-[1.1]" style={{ fontFamily: 'var(--font-space-grotesk)', color: t.text }}>
                <span className="text-[15px] font-bold tracking-[-0.01em]">Control</span>
                <span className="text-[13px] font-medium tracking-[0.02em]" style={{ color: t.textSecondary }}>Finanzas</span>
              </span>
            </Link>
          </div>

          {/* La MISMA espina del onboarding: el usuario nuevo ve UNA sola barra
              desde que se registra hasta que carga su cartera, no una por
              tramo. El paso 5 ya no es registro, es confirmar. */}
          {step <= PASOS && (
            <div className="mb-6">
              <EspinaProgreso paso={step} total={PASOS} />
              <p className="text-[11px] mt-2" style={{ color: t.textMuted }}>
                Paso {step} de {PASOS}
              </p>
            </div>
          )}

          {/* Referido badge */}
          {referrer && step < 5 && (
            <div className="flex items-center gap-2 rounded-[10px] px-3 py-2 mb-5"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[12px]" style={{ color: 'var(--color-accent)' }}>
                Referido por <strong>{referrer.nombreOrg}</strong>
              </span>
            </div>
          )}

          {/* Error global */}
          {error && step > 0 && step < 5 && (
            <div className="flex items-center gap-2.5 text-[13px] rounded-[10px] px-4 py-3 mb-5"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Step 0: Bienvenida ── */}
          {/* ── Step 1: Nombre ── */}
          {step === 1 && (
            <div>
              {/* Sin "Atras": el primer paso no tiene a donde volver desde que
                  se quito la portada. Un control que no hace nada enseña a
                  desconfiar de los que si hacen. */}

              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-2"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                ¿Cómo te llamas?
              </h1>
              <p className="text-[15px] mb-8" style={{ color: t.textSecondary }}>
                Así te saludamos dentro de la app.
              </p>

              <AuthInput
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="Ej: Carlos García"
                autoComplete="given-name"
                icon={
                  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                }
              />

              <div className="mt-6">
                <ContinueButton onClick={handleStep1} disabled={!form.nombre.trim()} />
              </div>
            </div>
          )}

          {/* ── Step 2: Negocio ── */}
          {step === 2 && (
            <div>
              <BackButton onClick={goBack} theme={t} />

              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-2"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                ¿Cómo se llama tu negocio?
              </h1>
              <p className="text-[15px] mb-8" style={{ color: t.textSecondary }}>
                El nombre que ven tus clientes y cobradores.
              </p>

              <AuthInput
                value={form.nombreOrganizacion}
                onChange={set('nombreOrganizacion')}
                placeholder="Ej: Préstamos García"
                icon={
                  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                }
              />

              <div className="mt-6">
                <ContinueButton onClick={handleStep2} disabled={!form.nombreOrganizacion.trim()} />
              </div>
            </div>
          )}

          {/* ── Step 3: WhatsApp ── */}
          {step === 3 && (
            <div>
              <BackButton onClick={goBack} theme={t} />

              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-2"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                Tu número de WhatsApp
              </h1>
              <p className="text-[15px] mb-8" style={{ color: t.textSecondary }}>
                Para verificar tu cuenta y enviar recordatorios de cobro a tus clientes.
              </p>

              {/* Country selector */}
              <div className="relative mb-3 rounded-[12px] cursor-pointer"
                style={{ background: t.bgCardHover, border: `1.5px solid ${t.border}` }}>
                <div className="flex items-center gap-3 px-4 py-3 pointer-events-none">
                  <span className="text-[20px] leading-none shrink-0">{selectedFlag}</span>
                  <span className="flex-1 text-[14px] font-medium" style={{ color: t.text }}>
                    {PAISES.find(p => p.code === country)?.name || 'Colombia'}
                  </span>
                  <svg className="w-4 h-4 shrink-0" style={{ color: t.textMuted }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  {PAISES.map(p => (
                    <option key={p.code} value={p.code} style={{ background: t.optionBg, color: t.text }}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <AuthInput
                type="tel"
                inputMode="numeric"
                value={form.telefono}
                onChange={(e) => { setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, countryCfg.phoneDigits) }); setError('') }}
                placeholder={countryCfg.phonePlaceholder}
                autoComplete="tel"
                maxLength={countryCfg.phoneDigits}
                icon={
                  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                }
              />
              <p className="text-[11px] mt-1.5 px-0.5" style={{ color: t.textMuted }}>
                Sin el código de país. Solo el número.
              </p>

              <div className="mt-6">
                <ContinueButton onClick={handleStep3} disabled={!form.telefono.trim()} />
              </div>
            </div>
          )}

          {/* ── Step 4: Email + Password ── */}
          {step === 4 && (
            <div>
              <BackButton onClick={goBack} theme={t} />

              <h1 className="text-[26px] lg:text-[30px] leading-[1.15] font-semibold mb-2"
                style={{ color: t.text, fontFamily: 'var(--font-space-grotesk)' }}>
                Crea tu cuenta
              </h1>
              <p className="text-[15px] mb-8" style={{ color: t.textSecondary }}>
                Tu correo será tu usuario para iniciar sesión.
              </p>

              <div className="space-y-3">
                <AuthInput
                  label="Correo electrónico"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="usuario@ejemplo.com"
                  autoComplete="email"
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  }
                />

                <AuthInput
                  label="Contraseña"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  showPasswordToggle
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  }
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={form.terminosAceptados}
                  onChange={(e) => setForm({ ...form, terminosAceptados: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-[var(--color-accent)]"
                />
                <span className="text-[12px] leading-relaxed" style={{ color: t.textSecondary }}>
                  Acepto los{' '}
                  <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer"
                    className="hover:underline" style={{ color: 'var(--color-accent)' }}>
                    Términos de uso
                  </a>{' '}y la{' '}
                  <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer"
                    className="hover:underline" style={{ color: 'var(--color-accent)' }}>
                    Política de privacidad
                  </a>
                </span>
              </label>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !form.email.trim() || !form.password || !form.terminosAceptados}
                  className="group relative w-full h-12 rounded-[12px] overflow-hidden font-bold text-[15px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 85%, #000))',
                    color: '#3a2900',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent)',
                  }}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        Crear cuenta gratis
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Verificacion OTP ── */}
          {step === 5 && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center mb-5"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'rgba(245,197,24,0.1)',
                  border: `2px solid ${verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.4)' : 'rgba(245,197,24,0.3)'}`,
                }}>
                {verificarPor === 'whatsapp' ? (
                  <svg style={{ width: 34, height: 34, color: '#25d366' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                ) : (
                  <svg style={{ width: 34, height: 34, color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              <h2 className="text-[24px] font-bold mb-2" style={{ color: t.text }}>
                {verificarPor === 'whatsapp' ? 'Revisa tu WhatsApp' : 'Verifica tu correo'}
              </h2>
              <p className="text-[14px] mb-1" style={{ color: t.textSecondary }}>
                Enviamos un código de 6 dígitos a
              </p>
              <p className="text-[16px] font-bold mb-5" style={{ color: accentColor }}>
                {verificarPor === 'whatsapp'
                  ? `+${form.telefono.replace(/\D/g, '')}`
                  : normalizarEmail(form.email)}
              </p>

              {/* Toggle canal */}
              <button
                type="button"
                onClick={async () => {
                  const nuevo = verificarPor === 'whatsapp' ? 'email' : 'whatsapp'
                  setVerificarPor(nuevo)
                  setOtpDigits(['', '', '', '', '', ''])
                  setOtpError('')
                  setOtpReenviado(false)
                  try {
                    await fetch('/api/auth/reenviar-verificacion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: normalizarEmail(form.email), canal: nuevo }),
                    })
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-[8px] mb-6 transition-all"
                style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textSecondary }}
              >
                {verificarPor === 'whatsapp' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Verificar por correo
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Verificar por WhatsApp
                  </>
                )}
              </button>

              {otpError && (
                <div className="flex items-center justify-center gap-2 text-[13px] rounded-[10px] px-4 py-2.5 mb-4"
                  style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>
                  {otpError}
                </div>
              )}

              <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    disabled={otpLoading}
                    className="w-11 text-center text-[22px] font-bold rounded-[12px] outline-none transition-all"
                    style={{
                      height: 52,
                      background: t.bgCardHover,
                      border: `1.5px solid ${digit ? accentColor + '99' : t.border}`,
                      color: t.text,
                      caretColor: accentColor,
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerificarOtp()}
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full h-12 rounded-[12px] text-[15px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
                style={{ background: accentColor, color: '#3a2900' }}
              >
                {otpLoading ? 'Verificando...' : 'Verificar'}
              </button>

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleReenviarOtp}
                  disabled={otpReenviando || otpReenviado}
                  className="text-[13px] font-semibold transition-colors disabled:opacity-50"
                  style={{ color: otpReenviado ? 'var(--color-success)' : accentColor }}
                >
                  {otpReenviado ? 'Código reenviado' : otpReenviando ? 'Reenviando...' : 'Reenviar código'}
                </button>
                <button
                  onClick={handleSaltarVerificacion}
                  disabled={otpLoading}
                  className="text-[12px] transition-colors"
                  style={{ color: t.textMuted }}
                >
                  Saltar por ahora
                </button>
              </div>

              <p className="text-[12px] mt-5 leading-relaxed" style={{ color: t.textMuted }}>
                {verificarPor === 'whatsapp'
                  ? 'El mensaje llega en segundos. Si no llega, usa el botón de verificar por correo.'
                  : 'Revisa tu bandeja y la carpeta de spam. El código expira en 30 minutos.'}
              </p>
            </div>
          )}

          {/* Vivia en la portada. Sin portada va en el PRIMER paso, que es
              donde alguien se da cuenta de que se equivoco de pantalla. */}
          {step === 1 && (
            <p className="text-[14px] mt-8 text-center" style={{ color: t.textMuted }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--color-accent)' }}>
                Inicia sesión
              </Link>
            </p>
          )}

          {(step === 1 || step === 4) && <div className="flex items-center justify-center gap-2.5 mt-6 text-[12px] flex-wrap" style={{ color: t.textMuted }}>
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Conexión cifrada SSL
            </span>
            <span>·</span>
            <span>Tus datos están seguros</span>
            <span>·</span>
            <span>Soporte en español</span>
          </div>}
        </div>
      </div>
    </div>
  )
}
