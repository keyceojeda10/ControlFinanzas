'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'
import { Skeleton }            from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planBadge  = { basic: 'gray', standard: 'yellow', professional: 'purple' }
const PRECIOS    = { basic: 59000, standard: 119000, professional: 199000 }
const PLAN_NAMES = { basic: 'Básico', standard: 'Profesional', professional: 'Empresarial' }

function Alerta({ tipo = 'success', children }) {
  const styles = {
    success: 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)] text-[#22c55e]',
    error:   'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#ef4444]',
    warning: 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.2)] text-[#f59e0b]',
  }
  return (
    <div className={`border rounded-[12px] px-4 py-3 text-sm ${styles[tipo]}`}>
      {children}
    </div>
  )
}

const inputClass =
  'w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] transition-all disabled:opacity-50 disabled:cursor-not-allowed'

// ══════════════════════════════════════════════════════════════
// TAB 1 — MI PERFIL
// ══════════════════════════════════════════════════════════════
function TabPerfil() {
  const { session } = useAuth()
  const [perfil,  setPerfil]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [nombre,       setNombre]       = useState('')
  const [guardandoNom, setGuardandoNom] = useState(false)
  const [msgNom,       setMsgNom]       = useState(null)
  const [pwActual,    setPwActual]    = useState('')
  const [pwNuevo,     setPwNuevo]     = useState('')
  const [pwConfirmar, setPwConfirmar] = useState('')
  const [guardandoPw, setGuardandoPw] = useState(false)
  const [msgPw,       setMsgPw]       = useState(null)

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d) => { setPerfil(d); setNombre(d.nombre ?? '') })
      .finally(() => setLoading(false))
  }, [])

  const guardarNombre = async () => {
    setGuardandoNom(true); setMsgNom(null)
    try {
      const res  = await fetch('/api/configuracion/perfil', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      const data = await res.json()
      setMsgNom(res.ok
        ? { tipo: 'success', texto: 'Nombre actualizado correctamente' }
        : { tipo: 'error',   texto: data.error ?? 'Error al guardar' })
    } catch {
      setMsgNom({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardandoNom(false) }
  }

  const cambiarPassword = async () => {
    setMsgPw(null)
    if (!pwActual || !pwNuevo || !pwConfirmar) {
      setMsgPw({ tipo: 'error', texto: 'Todos los campos son obligatorios' }); return
    }
    if (pwNuevo.length < 6) {
      setMsgPw({ tipo: 'error', texto: 'La nueva contraseña debe tener al menos 6 caracteres' }); return
    }
    if (pwNuevo !== pwConfirmar) {
      setMsgPw({ tipo: 'error', texto: 'Las contraseñas no coinciden' }); return
    }
    setGuardandoPw(true)
    try {
      const res  = await fetch('/api/configuracion/perfil', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordActual: pwActual, nuevoPassword: pwNuevo }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgPw({ tipo: 'success', texto: 'Contraseña actualizada correctamente' })
        setPwActual(''); setPwNuevo(''); setPwConfirmar('')
      } else {
        setMsgPw({ tipo: 'error', texto: data.error ?? 'Error al cambiar contraseña' })
      }
    } catch {
      setMsgPw({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardandoPw(false) }
  }

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" />
    </div>
  )

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Información personal</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Email</label>
            <input type="email" value={perfil?.email ?? ''} readOnly disabled className={inputClass} />
            <p className="text-[10px] text-[#888888]">El email no se puede cambiar</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Rol</label>
            <div className="flex items-center gap-2">
              <Badge variant={session?.user?.rol === 'owner' ? 'blue' : 'gray'}>
                {{ owner: 'Administrador', cobrador: 'Cobrador', superadmin: 'Super Admin' }[session?.user?.rol] ?? 'Usuario'}
              </Badge>
            </div>
          </div>
          {msgNom && <Alerta tipo={msgNom.tipo}>{msgNom.texto}</Alerta>}
          <Button onClick={guardarNombre} loading={guardandoNom} size="sm">Guardar nombre</Button>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Cambiar contraseña</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Contraseña actual</label>
            <input type="password" value={pwActual} onChange={(e) => setPwActual(e.target.value)} placeholder="Tu contraseña actual" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Nueva contraseña</label>
            <input type="password" value={pwNuevo} onChange={(e) => setPwNuevo(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Confirmar nueva contraseña</label>
            <input type="password" value={pwConfirmar} onChange={(e) => setPwConfirmar(e.target.value)} placeholder="Repite la nueva contraseña" className={inputClass} />
          </div>
          {msgPw && <Alerta tipo={msgPw.tipo}>{msgPw.texto}</Alerta>}
          <Button onClick={cambiarPassword} loading={guardandoPw} size="sm">Cambiar contraseña</Button>
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — MI ORGANIZACIÓN
// ══════════════════════════════════════════════════════════════
function TabOrganizacion() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [nombre,   setNombre]   = useState('')
  const [telefono, setTelefono] = useState('')
  const [ciudad,   setCiudad]   = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetch('/api/configuracion/organizacion')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setNombre(d.org?.nombre ?? '')
        setTelefono(d.org?.telefono ?? '')
        setCiudad(d.org?.ciudad ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  const guardar = async () => {
    setGuardando(true); setMsg(null)
    try {
      const res  = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, ciudad }),
      })
      const d = await res.json()
      setMsg(res.ok
        ? { tipo: 'success', texto: 'Organización actualizada correctamente' }
        : { tipo: 'error',   texto: d.error ?? 'Error al guardar' })
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardando(false) }
  }

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
    </div>
  )

  const { org, suscripcion, diasRestantes } = data ?? {}
  const vencida   = diasRestantes !== null && diasRestantes !== undefined && diasRestantes <= 0
  const porVencer = diasRestantes !== null && diasRestantes !== undefined && diasRestantes > 0 && diasRestantes <= 7

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Datos del negocio</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Nombre del negocio</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Teléfono</label>
            <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Ciudad</label>
            <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Bogotá" className={inputClass} />
          </div>
          {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
          <Button onClick={guardar} loading={guardando} size="sm">Guardar cambios</Button>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Plan y suscripción</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#888888]">Plan actual</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={planBadge[org?.plan ?? 'basic']}>
                  {PLAN_NAMES[org?.plan ?? 'basic']}
                </Badge>
                <span className="text-xs text-[#888888]">{formatCOP(PRECIOS[org?.plan ?? 'basic'])}/mes</span>
              </div>
            </div>
            <Link
              href="/configuracion/plan"
              className="px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[#2a2a2a] text-[#888888] hover:text-[white] hover:bg-[#333333] transition-all"
            >
              Cambiar plan
            </Link>
          </div>

          {suscripcion && (
            <div className="pt-3 border-t border-[#2a2a2a] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#888888]">Vencimiento</span>
                <span className="text-[#888888]">
                  {new Date(suscripcion.fechaVencimiento).toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
              {vencida && (
                <Alerta tipo="error">
                  Tu suscripción venció hace {Math.abs(diasRestantes)} día{Math.abs(diasRestantes) !== 1 ? 's' : ''}.
                  {' '}<Link href="/configuracion/plan" className="underline font-medium">Renueva ahora</Link>
                </Alerta>
              )}
              {porVencer && (
                <Alerta tipo="warning">
                  Tu suscripción vence en {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}.
                  {' '}<Link href="/configuracion/plan" className="underline font-medium">Renueva ahora</Link>
                </Alerta>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — SUSCRIPCIÓN
// ══════════════════════════════════════════════════════════════
function TabSuscripcion() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/configuracion/organizacion')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-32 w-full" /><Skeleton className="h-20 w-full" />
    </div>
  )

  const { org, suscripcion, diasRestantes, historial } = data ?? {}

  const barColor = diasRestantes === null || diasRestantes === undefined ? '#555555'
    : diasRestantes > 15 ? '#22c55e'
    : diasRestantes > 7  ? '#f59e0b'
    : '#ef4444'

  const barPct = (diasRestantes == null) ? 0 : Math.max(0, Math.min(100, (diasRestantes / 30) * 100))

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <p className="text-xs text-[#888888] mb-1">Plan actual</p>
            <div className="flex items-center gap-2">
              <Badge variant={planBadge[org?.plan ?? 'basic']}>
                {PLAN_NAMES[org?.plan ?? 'basic']}
              </Badge>
              <span className="text-xs text-[#888888]">{formatCOP(PRECIOS[org?.plan ?? 'basic'])}/mes</span>
            </div>
          </div>
          <Link
            href="/configuracion/plan"
            className="inline-flex items-center justify-center h-10 px-5 rounded-[12px] text-sm font-semibold bg-[#f5c518] text-white hover:bg-[#f0b800] transition-all shrink-0"
          >
            Renovar / Cambiar
          </Link>
        </div>

        {suscripcion ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#888888]">Inicio</p>
                <p className="text-[#888888] mt-0.5">{new Date(suscripcion.fechaInicio).toLocaleDateString('es-CO')}</p>
              </div>
              <div>
                <p className="text-[#888888]">Vencimiento</p>
                <p className="text-[#888888] mt-0.5">{new Date(suscripcion.fechaVencimiento).toLocaleDateString('es-CO')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#888888]">Tiempo restante</span>
                <span className="font-medium" style={{ color: barColor }}>
                  {diasRestantes != null
                    ? diasRestantes > 0
                      ? `${diasRestantes} días`
                      : `Vencida hace ${Math.abs(diasRestantes)} días`
                    : '—'}
                </span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: barColor }} />
              </div>
            </div>

            {diasRestantes != null && diasRestantes <= 0 && (
              <Alerta tipo="error">
                Tu suscripción venció.{' '}
                <Link href="/configuracion/plan" className="underline font-medium">Renueva ahora</Link> para seguir usando la plataforma.
              </Alerta>
            )}
            {diasRestantes != null && diasRestantes > 0 && diasRestantes <= 7 && (
              <Alerta tipo="warning">
                Solo quedan {diasRestantes} días.{' '}
                <Link href="/configuracion/plan" className="underline font-medium">Renueva tu plan</Link> para no perder el acceso.
              </Alerta>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#888888]">No hay información de suscripción disponible.</p>
        )}
      </Card>

      {historial?.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Historial de suscripciones</p>
          <div className="space-y-0">
            <div className="hidden sm:grid grid-cols-4 gap-2 text-[10px] text-[#888888] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
              <span>Período</span>
              <span className="text-center">Plan</span>
              <span className="text-center">Estado</span>
              <span className="text-right">Monto</span>
            </div>
            {historial.map((h) => (
              <div key={h.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-b border-[#2a2a2a] last:border-0 items-center">
                <p className="text-xs text-[#888888]">
                  {new Date(h.fechaInicio).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                  {' → '}
                  {new Date(h.fechaVencimiento).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                </p>
                <div className="text-center"><Badge variant={planBadge[h.plan]}>{PLAN_NAMES[h.plan] ?? h.plan}</Badge></div>
                <div className="text-center">
                  <Badge variant={h.estado === 'activa' ? 'green' : h.estado === 'vencida' ? 'red' : 'gray'}>
                    {h.estado}
                  </Badge>
                </div>
                <p className="text-xs text-[#888888] text-right">
                  {h.montoCOP > 0 ? formatCOP(h.montoCOP) : 'Gratis'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function ConfiguracionPage() {
  const { session, esOwner } = useAuth()
  const [tab, setTab] = useState('perfil')

  const rol = session?.user?.rol ?? 'cobrador'

  const tabs = [
    { key: 'perfil',       label: 'Mi perfil',    visible: true },
    { key: 'organizacion', label: 'Organización', visible: rol === 'owner' },
    { key: 'suscripcion',  label: 'Suscripción',  visible: rol === 'owner' },
  ].filter((t) => t.visible)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Configuración</h1>
        <p className="text-sm text-[#888888] mt-0.5">Gestiona tu perfil y tu organización</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#2a2a2a]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.key
                ? 'text-[#f5c518] border-[#f5c518]'
                : 'text-[#888888] border-transparent hover:text-[#888888]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perfil'       && <TabPerfil />}
      {tab === 'organizacion' && esOwner && <TabOrganizacion />}
      {tab === 'suscripcion'  && esOwner && <TabSuscripcion />}
    </div>
  )
}
