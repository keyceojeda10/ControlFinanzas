'use client'
// app/(dashboard)/cobradores/nuevo/page.jsx

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Input }               from '@/components/ui/Input'
import { Button }              from '@/components/ui/Button'
import CompartirCredenciales   from '@/components/cobradores/CompartirCredenciales'

const LIMITES = { starter: 1, basic: 1, growth: 2, standard: 5, professional: 10 }

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
  const [limitReached, setLimitReached] = useState(false)
  const [comprando, setComprando] = useState(false)
  const [permisos,  setPermisos]  = useState({
    crearPrestamos: false,
    gestionarPrestamos: false,
    reportarGastos: true,
    crearClientes:  false,
    editarClientes: false,
    verCapital:     false,
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
            background: 'linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 40%, #1a1a1a 70%, #22c55e05 100%)',
            boxShadow: '0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <div className="w-12 h-12 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[white] mb-1">¡Cobrador creado!</h2>
          <p className="text-xs text-[#888888] mb-5">
            Guarda estas credenciales — la contraseña no se mostrará de nuevo.
          </p>

          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] p-4 text-left mb-4 space-y-2">
            <div>
              <p className="text-[10px] text-[#888888]">Nombre</p>
              <p className="text-sm font-medium text-[white]">{creado.nombre}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888]">Email</p>
              <p className="text-sm font-medium text-[white]">{creado.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888]">Contraseña temporal</p>
              <p className="text-sm font-bold text-[#f5c518] font-mono">{creado.password}</p>
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
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[white]">Nuevo cobrador</h1>
        {restantes !== null && (
          <p className="text-xs text-[#888888] mt-1">
            Puedes agregar{' '}
            <span className={restantes > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
              {restantes} cobrador{restantes !== 1 ? 'es' : ''}
            </span>{' '}
            más (plan {plan})
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border border-[#2a2a2a] rounded-[16px] p-5 space-y-4"
        style={{
          background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
          boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {error && !limitReached && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {limitReached && puedeComprarExtra && (
          <div className="bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.25)] rounded-[12px] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Limite alcanzado</p>
                <p className="text-xs text-[#888888] mt-0.5">
                  Has usado todos los espacios de tu plan. Agrega un cobrador adicional por <span className="text-[#f5c518] font-bold">$19.000/mes</span>.
                </p>
              </div>
            </div>
            <button
              onClick={comprarCobradorExtra}
              disabled={comprando}
              className="w-full h-10 rounded-[12px] text-sm font-semibold bg-[#f5c518] hover:bg-[#f0b800] text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
            <p className="text-sm text-[#ef4444] font-medium">Limite alcanzado</p>
            <p className="text-xs text-[#888888] mt-1">
              Tu plan no permite cobradores extra. Actualiza al plan Crecimiento, Profesional o Empresarial.
            </p>
            <button
              onClick={() => router.push('/configuracion/plan')}
              className="mt-3 text-sm text-[#f5c518] hover:underline"
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
          <p className="text-[10px] text-[#888888] mt-1">
            Si lo agregas, podrás enviarle las credenciales directo por WhatsApp.
          </p>
        </div>
        <Input
          label="Contraseña temporal *"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-[10px] text-[#888888]">
          El cobrador deberá usar estas credenciales para ingresar al sistema.
        </p>

        {/* Permisos */}
        <div className="border-t border-[#2a2a2a] pt-4 mt-2">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">Permisos del cobrador</p>
          <div className="space-y-3">
            {[
              { key: 'crearPrestamos', label: 'Crear préstamos', desc: 'Puede registrar préstamos nuevos para clientes de su ruta' },
              { key: 'gestionarPrestamos', label: 'Gestión de préstamos', desc: 'Renovar préstamos, modificar plazos, aplicar recargos y descuentos' },
              { key: 'reportarGastos', label: 'Reportar gastos menores', desc: 'Puede registrar gastos menores en caja (hoy o ayer)' },
              { key: 'crearClientes',  label: 'Crear clientes',  desc: 'Puede registrar nuevos clientes (se asignan a su ruta)' },
              { key: 'editarClientes', label: 'Editar clientes', desc: 'Puede modificar datos como teléfono, dirección, etc.' },
              { key: 'verCapital',     label: 'Ver capital de la organización', desc: 'Muestra al cobrador el saldo total disponible para prestar (solo lectura)' },
            ].map((p) => (
              <div key={p.key} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white]">{p.label}</p>
                  <p className="text-[10px] text-[#666666] leading-snug">{p.desc}</p>
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
                    permisos[p.key] ? 'bg-[#f5c518]' : 'bg-[#333333]',
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
          <p className="text-[9px] text-[#888888] mt-2">
            Nota: "Gestión de préstamos" es un permiso avanzado e independiente para cambios administrativos de créditos.
          </p>
          <p className="text-[9px] text-[#555555] mt-2">Los permisos se pueden modificar después desde la edición del cobrador.</p>
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
