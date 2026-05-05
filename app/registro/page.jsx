'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams }    from 'next/navigation'
import { signIn }                        from 'next-auth/react'
import Link                              from 'next/link'
import { PLANES_CONFIG }                 from '@/lib/planes'
import AuthShell                         from '@/components/auth/AuthShell'
import AuthInput                         from '@/components/auth/AuthInput'
import AuthButton                        from '@/components/auth/AuthButton'

function RegistroForm() {
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const refCode        = searchParams.get('ref')
  const planParam      = searchParams.get('plan')

  const formatPrecio = (precio) => `$${precio.toLocaleString('es-CO')}`

  const PLANES_TRIAL = [
    { key: 'starter',      nombre: PLANES_CONFIG.starter.nombre,      desc: `${PLANES_CONFIG.starter.maxClientes.toLocaleString('es-CO')} clientes, ${PLANES_CONFIG.starter.maxRutas} ruta`,                                                            precio: formatPrecio(PLANES_CONFIG.starter.precio) },
    { key: 'basic',        nombre: PLANES_CONFIG.basic.nombre,        desc: `${PLANES_CONFIG.basic.maxClientes.toLocaleString('es-CO')} clientes, ${PLANES_CONFIG.basic.maxRutas} ruta`,                                                                precio: formatPrecio(PLANES_CONFIG.basic.precio) },
    { key: 'growth',       nombre: PLANES_CONFIG.growth.nombre,       desc: `${PLANES_CONFIG.growth.maxClientes.toLocaleString('es-CO')} clientes, ${PLANES_CONFIG.growth.maxRutas} rutas, ${PLANES_CONFIG.growth.maxUsuarios} usuarios`,             precio: formatPrecio(PLANES_CONFIG.growth.precio) },
    { key: 'standard',     nombre: PLANES_CONFIG.standard.nombre,     desc: `${PLANES_CONFIG.standard.maxClientes.toLocaleString('es-CO')} clientes, ${PLANES_CONFIG.standard.maxRutas} rutas, ${PLANES_CONFIG.standard.maxUsuarios} usuarios`,        precio: formatPrecio(PLANES_CONFIG.standard.precio) },
    { key: 'professional', nombre: PLANES_CONFIG.professional.nombre, desc: `${PLANES_CONFIG.professional.maxClientes.toLocaleString('es-CO')} clientes, ${PLANES_CONFIG.professional.maxRutas} rutas, ${PLANES_CONFIG.professional.maxUsuarios} usuarios`, precio: formatPrecio(PLANES_CONFIG.professional.precio) },
  ]
  const PLANES_MAP = Object.fromEntries(PLANES_TRIAL.map((p) => [p.key, p]))
  const planInicial = PLANES_MAP[planParam] ? planParam : 'starter'

  const [planSeleccionado, setPlanSeleccionado] = useState(planInicial)
  const infoPlan = PLANES_MAP[planSeleccionado]

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

    if (!form.nombreOrganizacion.trim() || !form.nombre.trim() || !form.email.trim() || !form.password) {
      setError('Todos los campos son obligatorios'); return
    }
    if (!form.terminosAceptados) { setError('Debes aceptar los términos y condiciones'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }

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
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle={`14 días gratis del plan ${infoPlan.nombre}`}
      maxWidth="max-w-md"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plan selector */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Elige tu plan de prueba
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PLANES_TRIAL.map((p) => {
              const activo = planSeleccionado === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlanSeleccionado(p.key)}
                  className="rounded-[12px] px-2 py-2.5 text-center transition-all cursor-pointer"
                  style={{
                    background: activo
                      ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 15%, transparent), color-mix(in srgb, var(--color-accent) 5%, transparent))'
                      : 'rgba(255,255,255,0.02)',
                    border: activo
                      ? '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)'
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: activo ? '0 0 16px rgba(245,197,24,0.15)' : 'none',
                  }}
                >
                  <p className="text-xs font-semibold"
                    style={{ color: activo ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                  >
                    {p.nombre}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {p.precio}/mes
                  </p>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] mt-2 leading-snug" style={{ color: '#22c55e' }}>
            14 días gratis · {infoPlan.desc}
          </p>
        </div>

        {/* Referral badge */}
        {referrer && (
          <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-2.5"
            style={{
              background: 'rgba(245,197,24,0.08)',
              border: '1px solid rgba(245,197,24,0.2)',
              color: 'var(--color-accent)',
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs">
              Referido por <strong style={{ color: 'var(--color-text-primary)' }}>{referrer.nombreOrg}</strong>
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-3"
            style={{
              background: 'var(--color-danger-dim)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              color: 'var(--color-danger)',
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
          placeholder="Ej: Préstamos García"
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
          placeholder="Ej: Carlos García"
          icon={
            <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
        />

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

        <AuthInput
          label="Confirmar contraseña"
          type="password"
          value={form.confirmar}
          onChange={set('confirmar')}
          placeholder="Repite tu contraseña"
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
          <span className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Acepto los{' '}
            <a href="https://control-finanzas.com/terminos-uso" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)' }}>
              Términos de uso
            </a>{' '}
            y la{' '}
            <a href="https://control-finanzas.com/privacidad" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)' }}>
              Política de privacidad
            </a>
          </span>
        </label>

        <AuthButton loading={loading} loadingLabel="Creando cuenta...">
          Probar plan {infoPlan.nombre} gratis
        </AuthButton>
      </form>
    </AuthShell>
  )
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  )
}
