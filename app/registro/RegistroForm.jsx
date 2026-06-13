'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { signIn }              from 'next-auth/react'
import Link                    from 'next/link'
import { PLANES_CONFIG }       from '@/lib/planes'
import AuthInput               from '@/components/auth/AuthInput'
import AuthButton              from '@/components/auth/AuthButton'
import { getCountryConfig, validatePhone, formatMoney } from '@/lib/i18n'
import { getCountryList } from '@/lib/countries'
import { getPrecioPlan } from '@/lib/planes'
import { normalizarEmail } from '@/lib/normalizar-email'

const PAISES = getCountryList()

// Banderas emoji por código de país
const FLAGS = {
  co: '🇨🇴', mx: '🇲🇽', pe: '🇵🇪', ec: '🇪🇨', do: '🇩🇴',
  hn: '🇭🇳', gt: '🇬🇹', sv: '🇸🇻', ni: '🇳🇮', pa: '🇵🇦',
  ve: '🇻🇪', us: '🇺🇸', cr: '🇨🇷',
}

// ── Plan definitions ────────────────────────────────────────
const PLANES_SOLO = [
  {
    key: 'starter',
    nombre: PLANES_CONFIG.starter.nombre,
    precio: PLANES_CONFIG.starter.precio,
    descripcion: 'Para carteras pequenas. Ideal si estas empezando.',
    features: [
      `Hasta ${PLANES_CONFIG.starter.maxClientes} clientes`,
      `${PLANES_CONFIG.starter.maxRutas} ruta de cobro`,
      'Registro de pagos y prestamos',
      'WhatsApp recordatorios',
    ],
  },
  {
    key: 'basic',
    nombre: PLANES_CONFIG.basic.nombre,
    precio: PLANES_CONFIG.basic.precio,
    descripcion: 'Para carteras en crecimiento. Mas capacidad.',
    features: [
      `Hasta ${PLANES_CONFIG.basic.maxClientes} clientes`,
      `${PLANES_CONFIG.basic.maxRutas} ruta de cobro`,
      'Registro de pagos y prestamos',
      'WhatsApp recordatorios',
    ],
  },
]

const PLANES_EQUIPO = [
  {
    key: 'growth',
    nombre: PLANES_CONFIG.growth.nombre,
    precio: PLANES_CONFIG.growth.precio,
    descripcion: 'Agrega cobradores y organiza rutas.',
    features: [
      `Hasta ${PLANES_CONFIG.growth.maxClientes.toLocaleString('es-CO')} clientes`,
      `${PLANES_CONFIG.growth.maxRutas} rutas · ${PLANES_CONFIG.growth.maxUsuarios} usuarios`,
      'Asistente IA Lucas (20 consultas/dia)',
      'Reportes basicos',
    ],
  },
  {
    key: 'standard',
    nombre: PLANES_CONFIG.standard.nombre,
    precio: PLANES_CONFIG.standard.precio,
    descripcion: 'Control total de tu equipo y cartera.',
    popular: true,
    features: [
      `Hasta ${PLANES_CONFIG.standard.maxClientes.toLocaleString('es-CO')} clientes`,
      `${PLANES_CONFIG.standard.maxRutas} rutas · ${PLANES_CONFIG.standard.maxUsuarios} usuarios`,
      'Asistente IA Lucas (60 consultas/dia)',
      'Reportes avanzados',
    ],
  },
  {
    key: 'professional',
    nombre: PLANES_CONFIG.professional.nombre,
    precio: PLANES_CONFIG.professional.precio,
    descripcion: 'Maxima capacidad y soporte prioritario.',
    features: [
      `Hasta ${PLANES_CONFIG.professional.maxClientes.toLocaleString('es-CO')} clientes`,
      `${PLANES_CONFIG.professional.maxRutas} rutas · ${PLANES_CONFIG.professional.maxUsuarios} usuarios`,
      'Asistente IA Lucas (200 consultas/dia)',
      'Reportes completos + exportacion',
    ],
  },
]

const ALL_PLANES = [...PLANES_SOLO, ...PLANES_EQUIPO]

// ── Plan card ───────────────────────────────────────────────
function PlanCard({ plan, selected, onSelect, countryCode = 'co' }) {
  const precioLocal = getPrecioPlan(plan.key, countryCode)
  const activo = selected === plan.key
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.key)}
      className="relative rounded-[14px] p-4 text-left transition-all w-full"
      style={{
        background: activo ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.03)',
        border: activo ? '2px solid rgba(245,197,24,0.6)' : '1.5px solid rgba(255,255,255,0.1)',
        boxShadow: activo ? '0 0 0 1px rgba(245,197,24,0.1) inset' : 'none',
      }}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: '#f5c518', color: '#0a0a0a' }}>
          Popular
        </span>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            style={{ border: `2px solid ${activo ? '#f5c518' : 'rgba(255,255,255,0.25)'}` }}>
            {activo && <div className="w-2 h-2 rounded-full" style={{ background: '#f5c518' }} />}
          </div>
          <span className="text-[14px] font-bold" style={{ color: activo ? '#f5c518' : '#e8e8f0' }}>
            {plan.nombre}
          </span>
        </div>
        <span className="font-mono-display text-[15px] font-bold" style={{ color: activo ? '#f5c518' : '#e8e8f0' }}>
          {formatMoney(precioLocal, countryCode)}
          <span className="text-[10px] font-normal" style={{ color: '#9a9ab0' }}>/mes</span>
        </span>
      </div>
      <p className="text-[12px] leading-relaxed mb-2.5 pl-6" style={{ color: '#9a9ab0' }}>
        {plan.descripcion}
      </p>
      <ul className="space-y-1 pl-6">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: activo ? '#c8c8d8' : '#888898' }}>
            <svg className="w-3 h-3 shrink-0" style={{ color: activo ? '#f5c518' : '#555566' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </button>
  )
}

// ── Canal selector (WhatsApp vs Email) ──────────────────────
function CanalSelector({ canal, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <button
        type="button"
        onClick={() => onChange('whatsapp')}
        className="relative flex flex-col items-center gap-2 py-4 px-3 rounded-[14px] transition-all"
        style={{
          background: canal === 'whatsapp' ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.03)',
          border: canal === 'whatsapp' ? '2px solid rgba(37,211,102,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
        }}
      >
        {canal === 'whatsapp' && (
          <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#25d366' }}>
            <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
        )}
        <svg className="w-7 h-7" style={{ color: canal === 'whatsapp' ? '#25d366' : '#666677' }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <div className="text-center">
          <p className="text-[13px] font-bold" style={{ color: canal === 'whatsapp' ? '#25d366' : '#c8c8d8' }}>WhatsApp</p>
          <p className="text-[10px]" style={{ color: '#9a9ab0' }}>Recomendado</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('email')}
        className="relative flex flex-col items-center gap-2 py-4 px-3 rounded-[14px] transition-all"
        style={{
          background: canal === 'email' ? 'rgba(245,197,24,0.08)' : 'rgba(255,255,255,0.03)',
          border: canal === 'email' ? '2px solid rgba(245,197,24,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
        }}
      >
        {canal === 'email' && (
          <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#f5c518' }}>
            <svg className="w-2.5 h-2.5" fill="#0a0a0a" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
        )}
        <svg className="w-7 h-7" style={{ color: canal === 'email' ? '#f5c518' : '#666677' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <div className="text-center">
          <p className="text-[13px] font-bold" style={{ color: canal === 'email' ? '#f5c518' : '#c8c8d8' }}>Correo</p>
          <p className="text-[10px]" style={{ color: '#9a9ab0' }}>Alternativo</p>
        </div>
      </button>
    </div>
  )
}

// ── Main form ───────────────────────────────────────────────
export default function RegistroForm({ refCode, planParam, countryParam }) {
  const router = useRouter()

  const validKeys = ALL_PLANES.map(p => p.key)
  const planInicial = validKeys.includes(planParam) ? planParam : 'starter'

  const [planSeleccionado, setPlanSeleccionado] = useState(planInicial)
  const [step, setStep] = useState(1)
  const countryInicial = PAISES.some(p => p.code === countryParam) ? countryParam : 'co'
  const [country, setCountry] = useState(countryInicial)
  const countryCfg = getCountryConfig(country)
  const infoPlan = ALL_PLANES.find(p => p.key === planSeleccionado)

  const [verificarPor, setVerificarPor] = useState('whatsapp')

  const [form, setForm] = useState({
    nombreOrganizacion: '',
    nombre:             '',
    email:              '',
    emailConfirmar:     '',
    telefono:           '',
    password:           '',
    confirmar:          '',
    terminosAceptados:  false,
  })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [referrer, setReferrer] = useState(null)

  // OTP step 3
  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading]       = useState(false)
  const [otpError, setOtpError]           = useState('')
  const [otpReenviado, setOtpReenviado]   = useState(false)
  const [otpReenviando, setOtpReenviando] = useState(false)

  useEffect(() => {
    if (!refCode) return
    fetch(`/api/auth/validar-referido?code=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((data) => { if (data.valid) setReferrer({ nombreOrg: data.nombreOrg }) })
      .catch(() => {})
  }, [refCode])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const requiereWhatsApp = verificarPor === 'whatsapp'
    const requiereEmail    = true // siempre obligatorio

    if (!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.email.trim() || !form.password) {
      setError('Todos los campos son obligatorios'); return
    }
    if (requiereWhatsApp && !form.telefono.trim()) {
      setError('Ingresa tu numero de WhatsApp'); return
    }

    if (requiereWhatsApp) {
      const telefonoLimpio = form.telefono.replace(/\D/g, '')
      if (!validatePhone(telefonoLimpio, country)) {
        setError(`Ingresa un ${countryCfg.phoneLabel.toLowerCase()} valido (ej: ${countryCfg.phonePlaceholder})`); return
      }
    }

    if (normalizarEmail(form.email) !== normalizarEmail(form.emailConfirmar)) {
      setError('Los correos electronicos no coinciden'); return
    }
    if (!form.terminosAceptados) { setError('Debes aceptar los terminos y condiciones'); return }
    if (form.password.length < 8) { setError('La contrasena debe tener al menos 8 caracteres'); return }
    if (form.password !== form.confirmar) { setError('Las contrasenas no coinciden'); return }

    const telefonoLimpio = form.telefono.replace(/\D/g, '')

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre:             form.nombre,
          email:              form.email,
          telefono:           telefonoLimpio || '0000000000',
          password:           form.password,
          terminosAceptados:  form.terminosAceptados,
          ...(refCode ? { ref: refCode } : {}),
          plan: planSeleccionado,
          country,
          canal: verificarPor,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar'); return }

      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead')
      }
      setStep(3)
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarOtp = async (codigoFinal) => {
    const codigo = codigoFinal || otpDigits.join('')
    if (codigo.length !== 6) { setOtpError('Ingresa el codigo de 6 digitos'); return }
    setOtpLoading(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizarEmail(form.email), codigo }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error || 'Codigo invalido'); setOtpLoading(false); return }

      const login = await signIn('credentials', {
        email: normalizarEmail(form.email),
        password: form.password,
        redirect: false,
      })
      if (login?.ok) { router.push('/dashboard'); return }
      router.push('/login')
    } catch {
      setOtpError('Error de conexion')
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
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
    if (value && index === 5) {
      const codigo = newDigits.join('')
      if (codigo.length === 6) handleVerificarOtp(codigo)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
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

  const accentColor = verificarPor === 'whatsapp' ? '#25d366' : '#f5c518'
  const selectedFlag = FLAGS[country] || '🌐'
  const selectedPaisNombre = PAISES.find(p => p.code === country)?.name || 'Colombia'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d0d14' }}>
      {/* Fondo con gradiente sutil arriba */}
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,197,24,0.08) 0%, transparent 70%)',
      }} />

      <div className="relative flex-1 flex flex-col items-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-lg">

          {/* Logo */}
          <div className="mb-8">
            <Link href="/login" className="inline-flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f5c518, #f2b211)' }}>
                <img src="/logo-icon.svg" alt="" width={22} height={22} />
              </div>
              <span className="text-[15px] font-bold" style={{ color: '#e8e8f0' }}>Control Finanzas</span>
            </Link>
          </div>

          {/* Heading */}
          <h1 className="text-[30px] lg:text-[36px] leading-[1.1] font-normal mb-1"
            style={{ color: '#f0f0f8', fontFamily: "var(--font-serif-display), Georgia, serif" }}>
            Crea tu <em style={{ color: '#f5c518', fontStyle: 'italic' }}>cuenta</em>
          </h1>
          <p className="text-[14px] mb-6" style={{ color: '#8888a0' }}>
            14 dias gratis · Sin tarjeta de credito
          </p>

          {/* Selector de pais con bandera */}
          <div className="relative mb-6 rounded-[14px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3 px-4 py-3 pointer-events-none">
              <span className="text-[20px] leading-none shrink-0">{selectedFlag}</span>
              <span className="flex-1 text-[14px] font-medium" style={{ color: '#e8e8f0' }}>{selectedPaisNombre}</span>
              <svg className="w-4 h-4 shrink-0" style={{ color: '#666677' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {PAISES.map(p => (
                <option key={p.code} value={p.code}
                  style={{ background: '#1a1a2e', color: '#e8e8f0' }}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-7">
            {[{ n: 1, label: 'Plan' }, { n: 2, label: 'Datos' }, { n: 3, label: 'Verificar' }].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 transition-all"
                    style={{
                      background: step >= n ? '#f5c518' : 'rgba(255,255,255,0.07)',
                      color: step >= n ? '#0a0a0a' : '#666677',
                    }}>
                    {step > n ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : n}
                  </div>
                  <span className="text-[12px] font-semibold"
                    style={{ color: step >= n ? '#e8e8f0' : '#555566' }}>{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px mx-1" style={{ background: step > n ? 'rgba(245,197,24,0.4)' : 'rgba(255,255,255,0.07)' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Plan selection ── */}
          {step === 1 && (
            <div>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="text-[13px] font-bold" style={{ color: '#e8e8f0' }}>Cobras solo</span>
                  <span className="text-[11px]" style={{ color: '#666677' }}>Sin cobradores</span>
                </div>
                <div className="grid gap-2">
                  {PLANES_SOLO.map(p => (
                    <PlanCard key={p.key} plan={p} selected={planSeleccionado} onSelect={setPlanSeleccionado} countryCode={country} />
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  <span className="text-[13px] font-bold" style={{ color: '#e8e8f0' }}>Con equipo</span>
                  <span className="text-[11px]" style={{ color: '#666677' }}>Tienes cobradores</span>
                </div>
                <div className="grid gap-2">
                  {PLANES_EQUIPO.map(p => (
                    <PlanCard key={p.key} plan={p} selected={planSeleccionado} onSelect={setPlanSeleccionado} countryCode={country} />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] leading-relaxed mb-5 px-1"
                style={{ color: '#666677' }}>
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>
                  Al terminar la prueba quedaras en <strong style={{ color: '#c8c8d8' }}>{infoPlan?.nombre}</strong>. Puedes cambiar de plan cuando quieras.
                </span>
              </div>

              {referrer && (
                <div className="flex items-center gap-2.5 rounded-[12px] px-4 py-3 mb-4"
                  style={{ background: 'rgba(245,197,24,0.07)', border: '1px solid rgba(245,197,24,0.2)', color: '#f5c518' }}>
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[12px]">Referido por <strong style={{ color: '#e8e8f0' }}>{referrer.nombreOrg}</strong></span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full h-12 rounded-[13px] text-[15px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: '#f5c518', color: '#0a0a0a' }}
              >
                Continuar con {infoPlan?.nombre}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Step 2: Account details ── */}
          {step === 2 && (
            <div>
              {/* Plan summary */}
              <div className="rounded-[12px] px-4 py-3 mb-5 flex items-center justify-between"
                style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.2)' }}>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: '#f5c518' }}>Plan {infoPlan?.nombre}</p>
                  <p className="text-[11px]" style={{ color: '#8888a0' }}>
                    14 dias gratis · luego {formatMoney(getPrecioPlan(infoPlan?.key, country), country)}/mes
                  </p>
                </div>
                <button type="button" onClick={() => setStep(1)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-[8px]"
                  style={{ color: '#f5c518', background: 'rgba(245,197,24,0.08)' }}>
                  Cambiar
                </button>
              </div>

              {/* Selector canal verificacion */}
              <div className="mb-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.06em] mb-3" style={{ color: '#8888a0' }}>
                  Verificar cuenta con
                </p>
                <CanalSelector canal={verificarPor} onChange={(c) => { setVerificarPor(c); setError('') }} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2.5 text-[13px] rounded-[10px] px-4 py-3"
                    style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#f87171' }}>
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <AuthInput
                  label="Nombre del negocio"
                  value={form.nombreOrganizacion}
                  onChange={set('nombreOrganizacion')}
                  placeholder="Ej: Prestamos Garcia"
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  }
                />

                <AuthInput
                  label="Tu nombre"
                  value={form.nombre}
                  onChange={set('nombre')}
                  placeholder="Ej: Carlos Garcia"
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  }
                />

                {/* Numero WhatsApp — solo si canal = whatsapp */}
                {verificarPor === 'whatsapp' && (
                  <div>
                    <AuthInput
                      label="Numero de WhatsApp"
                      type="tel"
                      inputMode="numeric"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, countryCfg.phoneDigits) })}
                      placeholder={countryCfg.phonePlaceholder}
                      autoComplete="tel"
                      maxLength={countryCfg.phoneDigits}
                      icon={
                        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      }
                    />
                    <p className="text-[11px] mt-1 px-0.5" style={{ color: '#666677' }}>
                      Recibes el codigo de verificacion aqui
                    </p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <AuthInput
                    label={verificarPor === 'email' ? 'Correo electronico (verificacion)' : 'Correo electronico'}
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
                  <div className="mt-2">
                    <AuthInput
                      label="Confirmar correo"
                      type="email"
                      value={form.emailConfirmar}
                      onChange={set('emailConfirmar')}
                      placeholder="Repite tu correo"
                      autoComplete="off"
                      icon={
                        <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    />
                  </div>
                  <p className="text-[11px] mt-1 px-0.5" style={{ color: '#666677' }}>
                    {verificarPor === 'whatsapp'
                      ? 'Para alertas de cobro y recuperar tu cuenta.'
                      : 'Recibes el codigo de verificacion aqui.'}
                  </p>
                </div>

                {/* Telefono opcional si canal = email */}
                {verificarPor === 'email' && (
                  <div>
                    <AuthInput
                      label={`${countryCfg.phoneLabel} (opcional)`}
                      type="tel"
                      inputMode="numeric"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, countryCfg.phoneDigits) })}
                      placeholder={countryCfg.phonePlaceholder}
                      autoComplete="tel"
                      maxLength={countryCfg.phoneDigits}
                      icon={
                        <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      }
                    />
                  </div>
                )}

                <AuthInput
                  label="Contrasena"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Minimo 8 caracteres"
                  autoComplete="new-password"
                  showPasswordToggle
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  }
                />

                <AuthInput
                  label="Confirmar contrasena"
                  type="password"
                  value={form.confirmar}
                  onChange={set('confirmar')}
                  placeholder="Repite tu contrasena"
                  autoComplete="new-password"
                  showPasswordToggle
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />

                <label className="flex items-start gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.terminosAceptados}
                    onChange={(e) => setForm({ ...form, terminosAceptados: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-[#f5c518]"
                  />
                  <span className="text-[12px] leading-relaxed" style={{ color: '#8888a0' }}>
                    Acepto los{' '}
                    <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer"
                      className="hover:underline" style={{ color: '#f5c518' }}>
                      Terminos de uso
                    </a>{' '}y la{' '}
                    <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer"
                      className="hover:underline" style={{ color: '#f5c518' }}>
                      Politica de privacidad
                    </a>
                  </span>
                </label>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-12 px-4 rounded-[12px] text-[13px] font-semibold transition-colors shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#9a9ab0' }}
                  >
                    Atras
                  </button>
                  <div className="flex-1">
                    <AuthButton loading={loading} loadingLabel="Creando cuenta...">
                      Crear cuenta gratis
                    </AuthButton>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 3: Verificacion OTP ── */}
          {step === 3 && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-18 h-18 rounded-full mb-5"
                style={{
                  width: 72, height: 72,
                  background: verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.12)' : 'rgba(245,197,24,0.1)',
                  border: `2px solid ${verificarPor === 'whatsapp' ? 'rgba(37,211,102,0.4)' : 'rgba(245,197,24,0.3)'}`,
                }}>
                {verificarPor === 'whatsapp' ? (
                  <svg style={{ width: 34, height: 34, color: '#25d366' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                ) : (
                  <svg style={{ width: 34, height: 34, color: '#f5c518' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              <h2 className="text-[22px] font-bold mb-2" style={{ color: '#f0f0f8' }}>
                {verificarPor === 'whatsapp' ? 'Revisa tu WhatsApp' : 'Verifica tu correo'}
              </h2>
              <p className="text-[13px] mb-1" style={{ color: '#8888a0' }}>
                Enviamos un codigo de 6 digitos a
              </p>
              <p className="text-[15px] font-bold mb-5" style={{ color: accentColor }}>
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
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9a9ab0' }}
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
                  style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#f87171' }}>
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
                      background: 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${digit ? accentColor + '99' : 'rgba(255,255,255,0.12)'}`,
                      color: '#f0f0f8',
                      caretColor: accentColor,
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => handleVerificarOtp()}
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full h-12 rounded-[13px] text-[15px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
                style={{ background: accentColor, color: '#0a0a0a' }}
              >
                {otpLoading ? 'Verificando...' : 'Verificar'}
              </button>

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleReenviarOtp}
                  disabled={otpReenviando || otpReenviado}
                  className="text-[13px] font-semibold transition-colors disabled:opacity-50"
                  style={{ color: otpReenviado ? '#22c55e' : accentColor }}
                >
                  {otpReenviado ? 'Codigo reenviado' : otpReenviando ? 'Reenviando...' : 'Reenviar codigo'}
                </button>
                <button
                  onClick={handleSaltarVerificacion}
                  disabled={otpLoading}
                  className="text-[12px] transition-colors"
                  style={{ color: '#555566' }}
                >
                  Saltar por ahora
                </button>
              </div>

              <p className="text-[11px] mt-5 leading-relaxed" style={{ color: '#555566' }}>
                {verificarPor === 'whatsapp'
                  ? 'El mensaje llega en segundos. Si no llega, usa el boton de verificar por correo.'
                  : 'Revisa tu bandeja y la carpeta de spam. El codigo expira en 30 minutos.'}
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="text-[13px] mt-8 text-center" style={{ color: '#666677' }}>
            {step !== 3 && (
              <>Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: '#f5c518' }}>
                Inicia sesion
              </Link></>
            )}
          </p>

          <div className="flex items-center justify-center gap-2.5 mt-6 text-[11px] flex-wrap" style={{ color: '#444455' }}>
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Conexion cifrada SSL
            </span>
            <span>·</span>
            <span>Tus datos estan seguros</span>
            <span>·</span>
            <span>Soporte en espanol</span>
          </div>
        </div>
      </div>
    </div>
  )
}
