'use client'
// app/(dashboard)/cobradores/[id]/editar/page.jsx

import { useState, useEffect, use } from 'react'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import { Input }                    from '@/components/ui/Input'
import { Button }                   from '@/components/ui/Button'
import CompartirCredenciales        from '@/components/cobradores/CompartirCredenciales'
import { useOnline }                from '@/hooks/useOnline'
import OfflineFallback              from '@/components/offline/OfflineFallback'

const SectionCard = ({ icon, title, color = 'var(--color-accent)', children, accent }) => (
  <div
    className="rounded-[16px] p-4"
    style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
      border: '1px solid var(--color-border)',
    }}
  >
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <span className="w-3.5 h-3.5">{icon}</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {title}
        </p>
      </div>
      {accent}
    </div>
    {children}
  </div>
)

export default function EditarCobrador({ params }) {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="No puedes editar cobradores sin conexion" volverHref="/cobradores" volverLabel="Volver a Cobradores" />
  return <EditarCobradorInner params={params} />
}

function EditarCobradorInner({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const { session, esOwner, loading: authLoading } = useAuth()

  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState(false)
  const [credencialesGuardadas, setCredencialesGuardadas] = useState(null)
  const [permisos,  setPermisos]  = useState({
    crearPrestamos: false,
    gestionarPrestamos: false,
    reportarGastos: true,
    crearClientes:  false,
    editarClientes: false,
    verCapital:     false,
    verSaldoCaja:   false,
  })

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/cobradores')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch(`/api/cobradores/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setNombre(data.nombre || '')
        setEmail(data.email || '')
        setTelefono(data.telefono || '')
        if (data.permisos) {
          setPermisos({
            crearPrestamos: data.permisos.crearPrestamos ?? false,
            gestionarPrestamos: data.permisos.gestionarPrestamos ?? data.permisos.crearPrestamos ?? false,
            reportarGastos: data.permisos.reportarGastos ?? true,
            crearClientes:  data.permisos.crearClientes  ?? false,
            editarClientes: data.permisos.editarClientes ?? false,
            verCapital:     data.permisos.verCapital     ?? false,
            verSaldoCaja:   data.permisos.verSaldoCaja   ?? false,
          })
        }
      })
      .catch(() => setError('No se pudo cargar el cobrador'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!email.trim())  { setError('El correo es requerido'); return }
    if (password && password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setSaving(true)
    setError('')
    setExito(false)

    const body = { nombre: nombre.trim(), email: email.trim(), telefono, permisos }
    if (password) body.password = password

    try {
      const res = await fetch(`/api/cobradores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setExito(true)
      // Si se cambió contraseña, mostrar opción de reenviar credenciales
      if (password) {
        setCredencialesGuardadas({ nombre: nombre.trim(), email: email.trim(), telefono, password })
      }
      setPassword('')
      setTimeout(() => setExito(false), 3000)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--color-bg-surface)] rounded w-40" />
          <div className="h-48 bg-[var(--color-bg-surface)] rounded-[16px]" />
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </div>
          <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Editar cobrador</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}
        {exito && (
          <div className="flex items-center gap-2 bg-[var(--color-success-dim)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] text-[var(--color-success)] text-sm rounded-[12px] px-4 py-3">
            Cambios guardados correctamente
          </div>
        )}

        {/* Datos personales */}
        <SectionCard
          title="Datos personales"
          color="#a855f7"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
        >
          <div className="space-y-3">
            <Input
              label="Nombre completo"
              placeholder="Ej: Pedro Ramírez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
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
                Útil para enviarle las credenciales por WhatsApp.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Acceso al sistema */}
        <SectionCard
          title="Acceso al sistema"
          color="#22c55e"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
        >
          <div className="space-y-3">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="cobrador@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div>
              <Input
                label="Nueva contraseña (opcional)"
                placeholder="Dejar vacío para no cambiar"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Solo llena este campo si quieres cambiar la contraseña del cobrador.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Compartir credenciales después de cambiar contraseña */}
        {credencialesGuardadas && (
          <div className="border border-[rgba(16,185,129,0.3)] rounded-[12px] p-4"
            style={{ background: 'linear-gradient(135deg, #22c55e0A 0%, var(--color-bg-card) 50%, #22c55e05 100%)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Contraseña actualizada</p>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-3">
              Envía las nuevas credenciales al cobrador. La contraseña no se mostrará de nuevo.
            </p>
            <CompartirCredenciales
              nombreCobrador={credencialesGuardadas.nombre}
              email={credencialesGuardadas.email}
              password={credencialesGuardadas.password}
              telefono={credencialesGuardadas.telefono}
              nombreOwner={session?.user?.nombre}
            />
          </div>
        )}

        {/* Permisos */}
        <SectionCard
          title="Permisos del cobrador"
          color="var(--color-accent)"
          icon={<svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        >
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
        </SectionCard>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
