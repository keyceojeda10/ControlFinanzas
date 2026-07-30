'use client'
// app/(dashboard)/cobradores/nuevo/page.jsx

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Input }               from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import CompartirCredenciales   from '@/components/cobradores/CompartirCredenciales'

const LIMITES = { starter: 1, basic: 1, growth: 2, standard: 5, professional: 10 }

// Card de seccion premium (definida fuera para evitar perdida de focus)
const SectionCard = ({ icon, title, color = 'var(--cf-gold)', children, accent }) => (
  <div
    className="rounded-[20px] p-4"
    style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--cf-card)) 0%, var(--cf-card) 100%)`,
      border: '1px solid var(--cf-border)',
    }}
  >
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <span className="w-3.5 h-3.5">{icon}</span>
        </div>
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color }}>
          {title}
        </p>
      </div>
      {accent}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
)

export default function NuevoCobrador() {
  const router = useRouter()
  const { session, esOwner, loading: authLoading } = useAuth()

  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [creado,    setCreado]    = useState(null)
  const [totalUsers, setTotalUsers] = useState(null)
  const [limiteUsuarios, setLimiteUsuarios] = useState(null)
  const [limitReached, setLimitReached] = useState(false)
  const [comprando, setComprando] = useState(false)
  const [permisos,  setPermisos]  = useState({
    crearPrestamos: false,
    gestionarPrestamos: false,
    reportarGastos: true,
    crearClientes:  false,
    editarClientes: false,
    verCapital:     false,
    verCapitalRuta: false,
    verSaldoCaja:   false,
    gestionarRutas: false,
    aplicarDescuentos: false,
    desembolsarLinea: false,
    reabrirCajaSinAprobacion: false,
  })

  const plan     = session?.user?.plan ?? 'starter'
  const limite   = limiteUsuarios ?? (LIMITES[plan] ?? 1)
  const restantes = isFinite(limite) && totalUsers !== null ? Math.max(0, limite - totalUsers) : null
  const puedeComprarExtra = plan === 'growth' || plan === 'standard' || plan === 'professional'

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/cobradores')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch('/api/cobradores')
      .then((r) => r.json())
      .then((d) => setTotalUsers((Array.isArray(d) ? d.length : 0) + 1)) // +1 por el owner
      .catch(() => {})
    // Limite real (incluye cobradores extra comprados), no solo el base del plan.
    fetch('/api/pagos/estado')
      .then((r) => r.json())
      .then((d) => { if (typeof d?.limiteUsuarios === 'number') setLimiteUsuarios(d.limiteUsuarios) })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre || !email || !password) { setError('Todos los campos son requeridos'); return }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/cobradores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, email, telefono, password, permisos }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.limitReached) { setLimitReached(true) }
        setError(data.error ?? 'Error al crear el cobrador')
        return
      }
      setCreado({ nombre, email, telefono, password })
    } catch {
      setError('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  const comprarCobradorExtra = async () => {
    setComprando(true)
    try {
      const res = await fetch('/api/pagos/cobrador-extra', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el pago'); return }
      window.location.href = data.initPoint
    } catch {
      setError('Error de conexión')
    } finally {
      setComprando(false)
    }
  }

  if (authLoading) return null

  // Cobrador creado exitosamente
  if (creado) {
    return (
      <div className="max-w-md mx-auto">
        <div
          className="border border-[color-mix(in_srgb,var(--cf-green-dark)_30%,transparent)] rounded-[20px] p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-green-dark) 4%, transparent) 0%, var(--cf-card) 40%, var(--cf-card) 70%, color-mix(in srgb, var(--cf-green-dark) 2%, transparent) 100%)',
            boxShadow: '0 0 30px color-mix(in srgb, var(--cf-green-dark) 3%, transparent), 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--cf-green-dark)_12%,transparent)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[var(--cf-ink)] mb-1">¡Cobrador creado!</h2>
          <p className="text-xs text-[var(--cf-ink-3)] mb-5">
            Guarda estas credenciales — la contraseña no se mostrará de nuevo.
          </p>

          <div className="bg-[var(--cf-card)] border border-[var(--cf-border)] rounded-[12px] p-4 text-left mb-4 space-y-2">
            <div>
              <p className="text-[10px] text-[var(--cf-ink-3)]">Nombre</p>
              <p className="text-sm font-medium text-[var(--cf-ink)]">{creado.nombre}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--cf-ink-3)]">Email</p>
              <p className="text-sm font-medium text-[var(--cf-ink)]">{creado.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--cf-ink-3)]">Contraseña temporal</p>
              <p className="text-sm font-bold text-[var(--cf-gold)] font-mono">{creado.password}</p>
            </div>
          </div>

          <div className="mb-4">
            <CompartirCredenciales
              nombreCobrador={creado.nombre}
              email={creado.email}
              password={creado.password}
              telefono={creado.telefono}
              nombreOwner={session?.user?.nombre}
            />
          </div>

          <Button onClick={() => router.push('/cobradores')} className="w-full">
            Ir a cobradores
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm transition-colors mb-3"
          style={{ color: 'var(--cf-ink-3)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-ink-2) 22%, transparent), color-mix(in srgb, var(--cf-ink-2) 12%, transparent))',
              border: '1px solid color-mix(in srgb, var(--cf-ink-2) 30%, transparent)',
              color: 'var(--cf-ink-2)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[25px] font-semibold leading-tight" style={{ color: 'var(--cf-ink)' }}>Nuevo cobrador</h1>
            {restantes !== null && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                Puedes agregar{' '}
                <span style={{ color: restantes > 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                  {restantes} cobrador{restantes !== 1 ? 'es' : ''}
                </span>{' '}
                más (plan {plan})
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && !limitReached && (
          <div className="flex items-center gap-2 bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {limitReached && puedeComprarExtra && (
          <div className="bg-[color-mix(in_srgb,var(--cf-gold-dark)_8%,transparent)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_25%,transparent)] rounded-[12px] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--cf-gold-dark)_15%,transparent)] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--cf-ink)]">Límite alcanzado</p>
                <p className="text-xs text-[var(--cf-ink-3)] mt-0.5">
                  Has usado todos los espacios de tu plan. Agrega un cobrador adicional por <span className="text-[var(--cf-gold)] font-bold">$19.000/mes</span>.
                </p>
              </div>
            </div>
            <button
              onClick={comprarCobradorExtra}
              disabled={comprando}
              className="w-full h-10 rounded-[12px] text-sm font-semibold bg-[var(--cf-gold)] hover:bg-[var(--cf-gold-dark)] text-[var(--cf-ink)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {comprando ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Procesando...
                </>
              ) : 'Agregar cobrador extra — $19.000/mes'}
            </button>
          </div>
        )}

        {limitReached && !puedeComprarExtra && (
          <div className="bg-[color-mix(in_srgb,var(--cf-red-dark)_8%,transparent)] border border-[color-mix(in_srgb,var(--cf-red-dark)_20%,transparent)] rounded-[12px] p-4 text-center">
            <p className="text-sm text-[var(--cf-red-dark)] font-medium">Límite alcanzado</p>
            <p className="text-xs text-[var(--cf-ink-3)] mt-1">
              Tu plan no permite cobradores extra. Actualiza al plan Crecimiento, Profesional o Empresarial.
            </p>
            <button
              onClick={() => router.push('/configuracion/plan')}
              className="mt-3 text-sm text-[var(--cf-gold)] hover:underline"
            >
              Ver planes
            </button>
          </div>
        )}

        {/* Datos personales */}
        <SectionCard
          title="Datos personales"
          color="var(--cf-ink-2)"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
        >
          <div className="space-y-3">
            <Input
              label="Nombre completo *"
              placeholder="Ej: Pedro Ramírez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
            />
            <div>
              <Input
                label="Teléfono (opcional)"
                type="tel"
                inputMode="numeric"
                placeholder="Ej: 3001234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                autoComplete="tel"
              />
              <p className="text-[10px] text-[var(--cf-ink-3)] mt-1">
                Si lo agregas, podrás enviarle las credenciales directo por WhatsApp.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Acceso al sistema */}
        <SectionCard
          title="Acceso al sistema"
          color="var(--cf-green-dark)"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
        >
          <div className="space-y-3">
            <Input
              label="Correo electrónico *"
              type="email"
              placeholder="cobrador@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contraseña temporal *"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-[10px] text-[var(--cf-ink-3)]">
              El cobrador deberá usar estas credenciales para ingresar al sistema.
            </p>
          </div>
        </SectionCard>

        {/* Permisos */}
        <SectionCard
          title="Permisos del cobrador"
          color="var(--cf-gold)"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        >
          <div className="space-y-3">
            {[
              { key: 'crearPrestamos', label: 'Crear préstamos', desc: 'Puede registrar préstamos nuevos para clientes de su ruta' },
              { key: 'gestionarPrestamos', label: 'Gestión de préstamos', desc: 'Renovar préstamos, modificar plazos y aplicar recargos' },
              { key: 'aplicarDescuentos', label: 'Aplicar descuentos y liquidaciones', desc: 'Permite reducir el saldo de un préstamo (descuento o liquidación anticipada). Riesgoso: actívalo solo a cobradores de confianza' },
              { key: 'desembolsarLinea', label: 'Desembolsar líneas de crédito', desc: 'Permite registrar desembolsos en lineas de credito rotativas de los clientes de su ruta' },
              { key: 'reportarGastos', label: 'Reportar gastos menores', desc: 'Puede registrar gastos menores en caja (hoy o ayer)' },
              { key: 'crearClientes',  label: 'Crear clientes',  desc: 'Puede registrar nuevos clientes (se asignan a su ruta)' },
              { key: 'editarClientes', label: 'Editar clientes', desc: 'Puede modificar datos como teléfono, dirección, etc.' },
              { key: 'verSaldoCaja',   label: 'Ver saldo en caja', desc: 'Muestra al cobrador el mismo saldo en caja que ve el administrador (dinero disponible ahora para prestar)' },
              { key: 'verCapitalRuta', label: 'Ver capital y cartera', desc: 'Permite al cobrador ver el capital y la cartera de su(s) ruta(s). Si está apagado, no ve ningún dato de capital' },
              { key: 'verCapital',     label: 'Ver capital de TODA la organización', desc: 'Además de su ruta, muestra el patrimonio completo de todas las rutas. Más sensible' },
              { key: 'gestionarRutas', label: 'Gestionar clientes en rutas', desc: 'Permite añadir y quitar clientes de sus rutas asignadas (para rotar clientes por día)' },
              { key: 'reabrirCajaSinAprobacion', label: 'Reabrir caja sin aprobación', desc: 'Si cierra su caja y necesita seguir cobrando, puede reabrirla el mismo sin esperar a que el administrador apruebe' },
            ].map((p) => (
              <div key={p.key} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--cf-ink)]">{p.label}</p>
                  <p className="text-[10px] text-[var(--cf-ink-3)] leading-snug">{p.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermisos(prev => {
                    if (p.key === 'crearPrestamos') {
                      const nuevoValor = !prev.crearPrestamos
                      return {
                        ...prev,
                        crearPrestamos: nuevoValor,
                        ...(nuevoValor ? {} : { gestionarPrestamos: false }),
                      }
                    }
                    return { ...prev, [p.key]: !prev[p.key] }
                  })}
                  disabled={p.key === 'gestionarPrestamos' && !permisos.crearPrestamos}
                  className={[
                    'relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5',
                    permisos[p.key] ? 'bg-[var(--cf-gold)]' : 'bg-[var(--cf-fill)]',
                    p.key === 'gestionarPrestamos' && !permisos.crearPrestamos ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm',
                    permisos[p.key] ? 'left-[20px]' : 'left-[2px]',
                  ].join(' ')} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-[var(--cf-ink-3)] mt-2">
            Nota: "Gestión de préstamos" es un permiso avanzado e independiente para cambios administrativos de créditos.
          </p>
          <p className="text-[9px] text-[var(--cf-ink-3)] mt-2">Los permisos se pueden modificar después desde la edición del cobrador.</p>
        </SectionCard>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear cobrador
          </Button>
        </div>
      </form>
    </div>
  )
}

