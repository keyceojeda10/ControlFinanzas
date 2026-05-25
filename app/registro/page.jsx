'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams }    from 'next/navigation'
import { signIn }                        from 'next-auth/react'
import Link                              from 'next/link'
import { PLANES_CONFIG }                 from '@/lib/planes'
import AuthInput                         from '@/components/auth/AuthInput'
import AuthButton                        from '@/components/auth/AuthButton'

const formatPrecio = (precio) => `$${precio.toLocaleString('es-CO')}`

// ── Plan definitions with descriptions ─────────────────────
const PLANES_SOLO = [
  {
    key: 'starter',
    nombre: PLANES_CONFIG.starter.nombre,
    precio: PLANES_CONFIG.starter.precio,
    descripcion: 'Para carteras pequenas. Ideal si estas empezando o manejas pocos clientes.',
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
    descripcion: 'Para carteras en crecimiento. Mas capacidad, misma simplicidad.',
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
    descripcion: 'Para equipos pequenos. Agrega cobradores y organiza rutas.',
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
    descripcion: 'Para operaciones medianas. Control total de tu equipo y cartera.',
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
    descripcion: 'Para empresas grandes. Maxima capacidad y soporte prioritario.',
    features: [
      `Hasta ${PLANES_CONFIG.professional.maxClientes.toLocaleString('es-CO')} clientes`,
      `${PLANES_CONFIG.professional.maxRutas} rutas · ${PLANES_CONFIG.professional.maxUsuarios} usuarios`,
      'Asistente IA Lucas (200 consultas/dia)',
      'Reportes completos + exportacion',
    ],
  },
]

const ALL_PLANES = [...PLANES_SOLO, ...PLANES_EQUIPO]

// ── Plan card component ────────────────────────────────────
function PlanCard({ plan, selected, onSelect }) {
  const activo = selected === plan.key
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.key)}
      className="relative rounded-[14px] p-4 text-left transition-all w-full"
      style={{
        background: activo
          ? 'rgba(245,197,24,0.06)'
          : 'rgba(255,255,255,0.02)',
        border: activo
          ? '1.5px solid rgba(245,197,24,0.5)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {plan.popular && (
        <span
          className="absolute -top-2.5 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#f5c518', color: '#0a0a0a' }}
        >
          Popular
        </span>
      )}

      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{
            border: `2px solid ${activo ? '#f5c518' : 'rgba(255,255,255,0.15)'}`,
          }}>
            {activo && <div className="w-2 h-2 rounded-full" style={{ background: '#f5c518' }} />}
          </div>
          <span className="text-[13px] font-semibold" style={{ color: activo ? '#f5c518' : '#f0f0f5' }}>
            {plan.nombre}
          </span>
        </div>
        <span className="font-mono-display text-[14px] font-bold" style={{ color: activo ? '#f5c518' : '#f0f0f5' }}>
          {formatPrecio(plan.precio)}
          <span className="text-[10px] font-normal" style={{ color: '#666' }}>/mes</span>
        </span>
      </div>

      <p className="text-[11px] leading-relaxed mb-3" style={{ color: '#888' }}>
        {plan.descripcion}
      </p>

      <ul className="space-y-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: '#999' }}>
            <svg className="w-3 h-3 shrink-0" style={{ color: activo ? '#f5c518' : '#666' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

    </button>
  )
}

// ── Main form ──────────────────────────────────────────────
function RegistroForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const refCode      = searchParams.get('ref')
  const planParam    = searchParams.get('plan')

  const validKeys = ALL_PLANES.map(p => p.key)
  const planInicial = validKeys.includes(planParam) ? planParam : 'starter'

  const [planSeleccionado, setPlanSeleccionado] = useState(planInicial)
  const [step, setStep] = useState(1) // 1 = plan, 2 = datos
  const infoPlan = ALL_PLANES.find(p => p.key === planSeleccionado)

  const [form, setForm] = useState({
    nombreOrganizacion: '',
    nombre:             '',
    email:              '',
    telefono:           '',
    password:           '',
    confirmar:          '',
    terminosAceptados:  false,
  })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [referrer, setReferrer] = useState(null)

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

    if (!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.email.trim() || !form.telefono.trim() || !form.password) {
      setError('Todos los campos son obligatorios'); return
    }
    const telefonoLimpio = form.telefono.replace(/\D/g, '')
    if (!/^3\d{9}$/.test(telefonoLimpio)) {
      setError('Ingresa un celular colombiano valido (ej: 3001234567)'); return
    }
    if (!form.terminosAceptados) { setError('Debes aceptar los terminos y condiciones'); return }
    if (form.password.length < 8) { setError('La contrasena debe tener al menos 8 caracteres'); return }
    if (form.password !== form.confirmar) { setError('Las contrasenas no coinciden'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombreOrganizacion: form.nombreOrganizacion,
          nombre:             form.nombre,
          email:              form.email,
          telefono:           telefonoLimpio,
          password:           form.password,
          terminosAceptados:  form.terminosAceptados,
          ...(refCode ? { ref: refCode } : {}),
          plan: planSeleccionado,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar'); return }

      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'Lead')
      }

      const login = await signIn('credentials', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      })
      if (login?.ok) { router.push('/dashboard'); return }
      router.push('/verificar-email')
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#060609' }}>
      <div className="flex-1 flex flex-col items-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-lg">

          {/* Logo */}
          <div className="mb-6">
            <Link href="/login" className="inline-flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f5c518, #f2b211)' }}
              >
                <img src="/logo-icon.svg" alt="" width={22} height={22} />
              </div>
              <span className="text-[14px] font-bold" style={{ color: '#f0f0f5' }}>Control Finanzas</span>
            </Link>
          </div>

          {/* Heading */}
          <h1
            className="text-[28px] lg:text-[34px] leading-[1.1] font-normal mb-2"
            style={{ color: '#f0f0f5', fontFamily: "var(--font-serif-display), Georgia, serif" }}
          >
            Crea tu <em style={{ color: '#f5c518', fontStyle: 'italic' }}>cuenta</em>
          </h1>
          <p className="text-[14px] mb-6" style={{ color: '#666' }}>
            14 dias gratis. Sin tarjeta de credito.
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{
                background: step >= 1 ? '#f5c518' : 'rgba(255,255,255,0.06)',
                color: step >= 1 ? '#0a0a0a' : '#666',
              }}>1</div>
              <span className="text-[12px] font-medium" style={{ color: step >= 1 ? '#f0f0f5' : '#666' }}>Plan</span>
            </div>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{
                background: step >= 2 ? '#f5c518' : 'rgba(255,255,255,0.06)',
                color: step >= 2 ? '#0a0a0a' : '#666',
              }}>2</div>
              <span className="text-[12px] font-medium" style={{ color: step >= 2 ? '#f0f0f5' : '#666' }}>Datos</span>
            </div>
          </div>

          {/* ── Step 1: Plan selection ── */}
          {step === 1 && (
            <div>
              {/* Section: Cobras solo */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="text-[13px] font-semibold" style={{ color: '#f0f0f5' }}>Cobras solo</span>
                  <span className="text-[11px]" style={{ color: '#666' }}>Manejas tu cartera sin cobradores</span>
                </div>
                <div className="grid gap-2">
                  {PLANES_SOLO.map(p => (
                    <PlanCard key={p.key} plan={p} selected={planSeleccionado} onSelect={setPlanSeleccionado} />
                  ))}
                </div>
              </div>

              {/* Section: Con equipo */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  <span className="text-[13px] font-semibold" style={{ color: '#f0f0f5' }}>Necesitas cobradores</span>
                  <span className="text-[11px]" style={{ color: '#666' }}>Tienes un equipo que cobra por ti</span>
                </div>
                <div className="grid gap-2">
                  {PLANES_EQUIPO.map(p => (
                    <PlanCard key={p.key} plan={p} selected={planSeleccionado} onSelect={setPlanSeleccionado} />
                  ))}
                </div>
              </div>

              {/* Info notices */}
              <div className="space-y-2 mb-6">
                <div className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: '#888' }}>
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f5c518' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>
                    Al terminar la prueba, quedaras en el plan <strong style={{ color: '#f0f0f5' }}>{infoPlan?.nombre}</strong>.
                    Puedes cambiar de plan en cualquier momento desde la configuracion.
                  </span>
                </div>
              </div>

              {/* Referral badge */}
              {referrer && (
                <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-2.5 mb-4"
                  style={{
                    background: 'rgba(245,197,24,0.08)',
                    border: '1px solid rgba(245,197,24,0.2)',
                    color: '#f5c518',
                  }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs">
                    Referido por <strong style={{ color: '#f0f0f5' }}>{referrer.nombreOrg}</strong>
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full h-11 rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
              {/* Selected plan summary */}
              <div
                className="rounded-[12px] px-4 py-3 mb-5 flex items-center justify-between"
                style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.2)' }}
              >
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: '#f5c518' }}>
                    Plan {infoPlan?.nombre}
                  </p>
                  <p className="text-[11px]" style={{ color: '#888' }}>
                    14 dias gratis · luego {formatPrecio(infoPlan?.precio)}/mes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: '#f5c518', background: 'rgba(245,197,24,0.08)' }}
                >
                  Cambiar
                </button>
              </div>

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

                <AuthInput
                  label="Correo electronico"
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
                  label="Celular (WhatsApp)"
                  type="tel"
                  inputMode="numeric"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="3001234567"
                  autoComplete="tel"
                  maxLength={10}
                  icon={
                    <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  }
                />

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

                <label className="flex items-start gap-3 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={form.terminosAceptados}
                    onChange={(e) => setForm({ ...form, terminosAceptados: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-[#f5c518]"
                  />
                  <span className="text-xs leading-relaxed" style={{ color: '#666' }}>
                    Acepto los{' '}
                    <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#f5c518' }}>
                      Terminos de uso
                    </a>{' '}
                    y la{' '}
                    <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#f5c518' }}>
                      Politica de privacidad
                    </a>
                  </span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-11 px-4 rounded-[12px] text-[13px] font-medium transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
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

          {/* Footer links */}
          <p className="text-[13px] mt-8 text-center" style={{ color: '#666' }}>
            Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium hover:underline" style={{ color: '#f5c518' }}>
              Inicia sesion
            </Link>
          </p>

          <div className="flex items-center justify-center gap-4 mt-8 text-[11px]" style={{ color: '#444' }}>
            <span>Cifrado SSL</span>
            <span>·</span>
            <span>Colombia</span>
            <span>·</span>
            <span>v 4.2</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegistroFallback() {
  return (
    <div className="flex items-center justify-center" style={{ background: '#060609', minHeight: '100vh' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: '#f5c518', borderTopColor: 'transparent' }} />
        <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<RegistroFallback />}>
      <RegistroForm />
    </Suspense>
  )
}
