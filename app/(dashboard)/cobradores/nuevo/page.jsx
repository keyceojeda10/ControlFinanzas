'use client'
// app/(dashboard)/cobradores/nuevo/page.jsx

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Input }               from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import CompartirCredenciales   from '@/components/cobradores/CompartirCredenciales'
import { useOnline }           from '@/hooks/useOnline'
import OfflineFallback         from '@/components/offline/OfflineFallback'

const LIMITES = { starter: 1, basic: 1, growth: 2, standard: 5, professional: 10 }

export default function NuevoCobrador() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="No puedes crear cobradores sin conexion" volverHref="/cobradores" volverLabel="Volver a Cobradores" />
  return <NuevoCobradorInner />
}

function NuevoCobradorInner() {
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
  const [limitReached, setLimitReached] = useState(false)
  const [comprando, setComprando] = useState(false)
  const [permisos,  setPermisos]  = useState({
    crearPrestamos: false,
    gestionarPrestamos: false,
    reportarGastos: true,
    crearClientes:  false,
    editarClientes: false,
    verCapital:     false,
    verSaldoCaja:   false,
  })

  const plan     = session?.user?.plan ?? 'starter'
  const limite   = LIMITES[plan] ?? 1
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
          className="border border-[rgba(16,185,129,0.3)] rounded-[16px] p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, #22c55e0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #22c55e05 100%)',
            boxShadow: '0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-12 h-12 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[white] mb-1">¡Cobrador creado!</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-5">
            Guarda estas credenciales — la contraseña no se mostrará de nuevo.
          </p>

          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-4 text-left mb-4 space-y-2">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Nombre</p>
              <p className="text-sm font-medium text-[white]">{creado.nombre}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Email</p>
              <p className="text-sm font-medium text-[white]">{creado.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Contraseña temporal</p>
              <p className="text-sm font-bold text-[var(--color-accent)] font-mono">{creado.password}</p>
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
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, #a855f7 22%, transparent), color-mix(in srgb, #a855f7 12%, transparent))',
              border: '1px solid color-mix(in srgb, #a855f7 30%, transparent)',
              color: '#a855f7',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Nuevo cobrador</h1>
            {restantes !== null && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Puedes agregar{' '}
                <span style={{ color: restantes > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {restantes} cobrador{restantes !== 1 ? 'es' : ''}
                </span>{' '}
                más (plan {plan})
              </p>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border border-[var(--color-border)] rounded-[16px] p-5 space-y-4"
        style={{
          background: 'linear-gradient(135deg, #f5c5180A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f5c51805 100%)',
          boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {error && !limitReached && (
          <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {limitReached && puedeComprarExtra && (
          <div className="bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.25)] rounded-[12px] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Limite alcanzado</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Has usado todos los espacios de tu plan. Agrega un cobrador adicional por <span className="text-[var(--color-accent)] font-bold">$19.000/mes</span>.
                </p>
              </div>
            </div>
            <button
              onClick={comprarCobradorExtra}
              disabled={comprando}
              className="w-full h-10 rounded-[12px] text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] p-4 text-center">
            <p className="text-sm text-[var(--color-danger)] font-medium">Limite alcanzado</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Tu plan no permite cobradores extra. Actualiza al plan Crecimiento, Profesional o Empresarial.
            </p>
            <button
              onClick={() => router.push('/configuracion/plan')}
              className="mt-3 text-sm text-[var(--color-accent)] hover:underline"
            >
              Ver planes
            </button>
          </div>
        )}

        <Input
          label="Nombre completo *"
          placeholder="Ej: Pedro Ramírez"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Correo electrónico *"
          type="email"
          placeholder="cobrador@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            Si lo agregas, podrás enviarle las credenciales directo por WhatsApp.
          </p>
        </div>
        <Input
          label="Contraseña temporal *"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-[10px] text-[var(--color-text-muted)]">
          El cobrador deberá usar estas credenciales para ingresar al sistema.
        </p>

        {/* Permisos */}
        <div className="border-t border-[var(--color-border)] pt-4 mt-2">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Permisos del cobrador</p>
          <div className="space-y-3">
            {[
              { key: 'crearPrestamos', label: 'Crear préstamos', desc: 'Puede registrar préstamos nuevos para clientes de su ruta' },
              { key: 'gestionarPrestamos', label: 'Gestión de préstamos', desc: 'Renovar préstamos, modificar plazos, aplicar recargos y descuentos' },
              { key: 'reportarGastos', label: 'Reportar gastos menores', desc: 'Puede registrar gastos menores en caja (hoy o ayer)' },
              { key: 'crearClientes',  label: 'Crear clientes',  desc: 'Puede registrar nuevos clientes (se asignan a su ruta)' },
              { key: 'editarClientes', label: 'Editar clientes', desc: 'Puede modificar datos como teléfono, dirección, etc.' },
              { key: 'verSaldoCaja',   label: 'Ver saldo en caja', desc: 'Muestra al cobrador el mismo saldo en caja que ve el administrador (dinero disponible ahora para prestar)' },
              { key: 'verCapital',     label: 'Ver capital total de la organización', desc: 'Muestra el patrimonio completo (saldo en caja + cartera activa). Más sensible que el saldo en caja' },
            ].map((p) => (
              <div key={p.key} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white]">{p.label}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">{p.desc}</p>
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
                    permisos[p.key] ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)]',
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
          <p className="text-[9px] text-[var(--color-text-muted)] mt-2">
            Nota: "Gestión de préstamos" es un permiso avanzado e independiente para cambios administrativos de créditos.
          </p>
          <p className="text-[9px] text-[var(--color-text-muted)] mt-2">Los permisos se pueden modificar después desde la edición del cobrador.</p>
        </div>

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
