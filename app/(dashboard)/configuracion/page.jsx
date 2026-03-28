'use client'

import { useState, useEffect, Suspense } from 'react'
import Link                    from 'next/link'
import { useSearchParams }     from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'
import { Skeleton }            from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planBadge  = { basic: 'gray', growth: 'blue', standard: 'yellow', professional: 'purple' }
const PRECIOS    = { basic: 59000, growth: 79000, standard: 119000, professional: 259000 }
const PLAN_NAMES = { basic: 'Basico', growth: 'Crecimiento', standard: 'Profesional', professional: 'Empresarial' }

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
                <span className="text-xs text-[#888888]"><span className="font-mono-display">{formatCOP(PRECIOS[org?.plan ?? 'basic'])}</span>/mes</span>
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
      <Card
        style={{
          background: `linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)`,
          boxShadow: `0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <p className="text-xs text-[#888888] mb-1">Plan actual</p>
            <div className="flex items-center gap-2">
              <Badge variant={planBadge[org?.plan ?? 'basic']}>
                {PLAN_NAMES[org?.plan ?? 'basic']}
              </Badge>
              <span className="text-xs text-[#888888]"><span className="font-mono-display">{formatCOP(PRECIOS[org?.plan ?? 'basic'])}</span>/mes</span>
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
                  {h.montoCOP > 0 ? <span className="font-mono-display">{formatCOP(h.montoCOP)}</span> : 'Gratis'}
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
// TAB 4 — REFERIDOS
// ══════════════════════════════════════════════════════════════
function TabReferidos() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/referidos')
      .then((r) => r.json())
      .then((d) => setData(d.data ?? d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-32 w-full" /><Skeleton className="h-20 w-full" />
    </div>
  )

  const codigo = data?.codigoReferido
  const referidos = data?.referidos ?? []
  const link = codigo ? `https://app.control-finanzas.com/registro?ref=${codigo}` : ''

  const copiarLink = () => {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const compartirWhatsApp = () => {
    if (!link) return
    const msg = encodeURIComponent(`Prueba Control Finanzas, la mejor app para gestionar préstamos y cobros. Regístrate gratis: ${link}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Tu link de referido</p>
        <div className="space-y-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-4 py-3">
            <p className="text-xs text-[#888888] mb-1">Código</p>
            <p className="text-lg font-bold font-mono text-[#f5c518]">{codigo ?? 'Sin código'}</p>
          </div>

          {link && (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] px-4 py-3">
              <p className="text-xs text-[#888888] mb-1">Link de registro</p>
              <p className="text-xs text-[#888888] break-all">{link}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={copiarLink} size="sm" variant={copiado ? 'success' : 'primary'}>
              {copiado ? 'Copiado' : 'Copiar link'}
            </Button>
            <Button onClick={compartirWhatsApp} size="sm" variant="secondary">
              Compartir por WhatsApp
            </Button>
          </div>

          <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] rounded-[12px] px-4 py-3">
            <p className="text-sm text-[#22c55e] font-medium">Por cada referido que pague su primer plan, ganas 1 mes gratis en tu suscripción.</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Referidos</p>
          <Badge variant="green">{referidos.length}</Badge>
        </div>
        {referidos.length === 0 ? (
          <p className="text-sm text-[#555555]">Aún no tienes referidos. Comparte tu link para empezar a ganar meses gratis.</p>
        ) : (
          <div className="space-y-0">
            {referidos.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-[#2a2a2a] last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{r.nombre}</p>
                  <p className="text-[10px] text-[#555555]">{new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
                </div>
                <Badge variant={r.pagado ? 'green' : 'gray'}>{r.pagado ? '+30 días' : 'Pendiente'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: NOTIFICACIONES
// ══════════════════════════════════════════════════════════════
function TabNotificaciones() {
  const [status, setStatus] = useState('loading') // loading, unsupported, denied, subscribed, unsubscribed
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  const toggle = async () => {
    setWorking(true)
    try {
      if (status === 'subscribed') {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setStatus('unsubscribed')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') { setStatus('denied'); setWorking(false); return }

        const reg = await navigator.serviceWorker.ready
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) { setWorking(false); return }

        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
        const raw = atob(base64)
        const arr = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: arr,
        })
        const { endpoint, keys } = subscription.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, keys }),
        })
        setStatus('subscribed')
      }
    } catch (err) {
      console.error('[push] Error:', err)
    }
    setWorking(false)
  }

  return (
    <Card>
      <div className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Notificaciones push</h2>
        <p className="text-xs text-[#888]">
          Recibe alertas cuando un cobrador registra pagos, clientes entran en mora o tu suscripción está por vencer.
        </p>

        {status === 'unsupported' && (
          <p className="text-xs text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded-lg px-3 py-2">
            Tu navegador no soporta notificaciones push. Usa Chrome, Edge o Firefox.
          </p>
        )}

        {status === 'denied' && (
          <p className="text-xs text-[#ef4444] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
            Las notificaciones fueron bloqueadas. Habilítalas desde la configuración de tu navegador.
          </p>
        )}

        {(status === 'subscribed' || status === 'unsubscribed') && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{status === 'subscribed' ? 'Activadas' : 'Desactivadas'}</p>
              <p className="text-[10px] text-[#666]">{status === 'subscribed' ? 'Recibirás notificaciones push' : 'No recibirás notificaciones'}</p>
            </div>
            <button
              onClick={toggle}
              disabled={working}
              className={`relative w-12 h-6 rounded-full transition-colors ${status === 'subscribed' ? 'bg-[#f5c518]' : 'bg-[#2a2a2a]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${status === 'subscribed' ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#333] border-t-[#f5c518] rounded-full animate-spin" />
            <span className="text-xs text-[#666]">Verificando...</span>
          </div>
        )}
      </div>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
function ConfiguracionContent() {
  const { session, esOwner } = useAuth()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState(tabParam || 'perfil')

  useEffect(() => {
    if (tabParam) setTab(tabParam)
  }, [tabParam])

  const rol = session?.user?.rol ?? 'cobrador'

  const tabs = [
    { key: 'perfil',       label: 'Mi perfil',    visible: true },
    { key: 'organizacion', label: 'Organización', visible: rol === 'owner' },
    { key: 'suscripcion',  label: 'Suscripción',  visible: rol === 'owner' },
    { key: 'referidos',    label: 'Referidos',     visible: rol === 'owner' },
    { key: 'notificaciones', label: 'Notificaciones', visible: true },
  ].filter((t) => t.visible)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Configuración</h1>
        <p className="text-sm text-[#888888] mt-0.5">Gestiona tu perfil y tu organización</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#2a2a2a] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap',
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
      {tab === 'referidos'    && esOwner && <TabReferidos />}
      {tab === 'notificaciones' && <TabNotificaciones />}
    </div>
  )
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto"><Skeleton className="h-10 w-full" /></div>}>
      <ConfiguracionContent />
    </Suspense>
  )
}
