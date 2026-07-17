'use client'

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, Suspense } from 'react'
import Link                    from 'next/link'
import { useSearchParams }     from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'
import { Skeleton }            from '@/components/ui/Skeleton'
import { PLANES_CONFIG }       from '@/lib/planes'
import { AVATARS, AVATAR_CATEGORIES } from '@/lib/avatars'
import Avatar                  from '@/components/ui/Avatar'
import { Modal }               from '@/components/ui/Modal'
import { ConfirmModal }        from '@/components/ui/ConfirmModal'
import DiasSinCobroSelector    from '@/components/ui/DiasSinCobroSelector'
import FestivosManager         from '@/components/ui/FestivosManager'
import MetodoPagoAdmin         from '@/components/pagos/MetodoPagoAdmin'
import ThemeToggle             from '@/components/ui/ThemeToggle'
import { Toggle }              from '@/components/ui/Toggle'
import { useTheme }             from '@/lib/theme/ThemeProvider'
import { getCountryList, COUNTRIES } from '@/lib/countries'
import { InstallGuideModal } from '@/components/layout/InstallButton'
import { AgregarCampoRecibo, CamposReciboList, CAMPOS_DATO_LABELS } from '@/components/recibos/CamposReciboEditor'

const PAISES_LIST = getCountryList()
const WHATSAPP_SOPORTE = '573011993001'

const planBadge  = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green' }
const PRECIOS    = Object.fromEntries(Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.precio]))
const PLAN_NAMES = Object.fromEntries(Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.nombre]))

function Alerta({ tipo = 'success', children }) {
  const styles = {
    success: { background: 'var(--color-success-dim)', borderColor: 'var(--color-success-border)', color: 'var(--color-success)' },
    error:   { background: 'var(--color-danger-dim)',  borderColor: 'var(--color-danger-border)',  color: 'var(--color-danger)' },
    warning: { background: 'var(--color-warning-dim)', borderColor: 'var(--color-warning-border)', color: 'var(--color-warning)' },
  }
  return (
    <div className="border rounded-[12px] px-4 py-3 text-sm" style={styles[tipo] ?? styles.success}>
      {children}
    </div>
  )
}

const inputClass =
  'cf-input w-full h-11 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed'

// ══════════════════════════════════════════════════════════════
// TAB 1 — MI PERFIL
// ══════════════════════════════════════════════════════════════
function TabPerfil() {
  const { session, updateSession } = useAuth()

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
  const [avatarSeleccionado, setAvatarSeleccionado] = useState(null)
  const [guardandoAvatar, setGuardandoAvatar] = useState(false)
  const [msgAvatar, setMsgAvatar] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [telefono,       setTelefono]       = useState('')
  const [guardandoTel,   setGuardandoTel]   = useState(false)
  const [msgTel,         setMsgTel]         = useState(null)

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d) => { setPerfil(d); setNombre(d.nombre ?? ''); setAvatarSeleccionado(d.avatarId ?? null); setTelefono(d.telefono ?? '') })
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

  const guardarAvatar = async (id) => {
    setAvatarSeleccionado(id)
    setGuardandoAvatar(true); setMsgAvatar(null)
    try {
      const res = await fetch('/api/configuracion/perfil', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: id || null }),
      })
      if (res.ok) {
        setMsgAvatar({ tipo: 'success', texto: 'Avatar actualizado' })
        // Forzar refresh del JWT para que Header/Sidebar lo muestren al instante
        if (updateSession) await updateSession()
      } else {
        setMsgAvatar({ tipo: 'error', texto: 'Error al guardar avatar' })
      }
    } catch {
      setMsgAvatar({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardandoAvatar(false) }
  }

  const guardarTelefono = async () => {
    setGuardandoTel(true); setMsgTel(null)
    const limpio = telefono.replace(/\D/g, '')
    if (limpio && (limpio.length < 7 || limpio.length > 15)) {
      setMsgTel({ tipo: 'error', texto: 'Ingresa un número de WhatsApp válido' })
      setGuardandoTel(false); return
    }
    try {
      const res  = await fetch('/api/configuracion/perfil', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: limpio || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setPerfil(p => ({ ...p, telefono: limpio || null }))
        setMsgTel({ tipo: 'success', texto: 'Número de WhatsApp actualizado' })
      } else {
        setMsgTel({ tipo: 'error', texto: data.error ?? 'Error al guardar' })
      }
    } catch {
      setMsgTel({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardandoTel(false) }
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
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Información personal</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Email</label>
            <input type="email" value={perfil?.email ?? ''} readOnly disabled className={inputClass} />
            <p className="text-[10px] text-[var(--color-text-muted)]">El email no se puede cambiar</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Número de WhatsApp</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 3001234567"
              className={inputClass}
            />
            <p className="text-[10px] text-[var(--color-text-muted)]">Lo usamos para enviarte códigos de verificación. Si lo cambias, usa el nuevo número para iniciar sesión.</p>
          </div>
          {msgTel && <Alerta tipo={msgTel.tipo}>{msgTel.texto}</Alerta>}
          <Button onClick={guardarTelefono} loading={guardandoTel} size="sm">Guardar WhatsApp</Button>
          <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }} />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Rol</label>
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
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-3">Avatar de perfil</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
          Se mostrará en el menú y en el sidebar.
        </p>

        {/* Preview actual + acciones */}
        <div className="flex items-center gap-3">
          <Avatar nombre={nombre || perfil?.nombre} avatarId={avatarSeleccionado} size={56} fontSize={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{nombre || perfil?.nombre}</p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
              {avatarSeleccionado ? AVATARS.find(a => a.id === avatarSeleccionado)?.nombre ?? 'Avatar seleccionado' : 'Usando iniciales del nombre'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAvatarPickerOpen(true)}
              className="text-[11px] px-3 py-1.5 rounded-full transition-colors font-medium"
              style={{ color: 'var(--color-accent)', background: 'var(--color-accent-soft)', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)' }}
            >
              Cambiar
            </button>
            {avatarSeleccionado && (
              <button
                onClick={() => guardarAvatar(null)}
                disabled={guardandoAvatar}
                className="text-[11px] px-3 py-1.5 rounded-full transition-colors font-medium"
                style={{ color: 'var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)' }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
        {msgAvatar && <div className="mt-3"><Alerta tipo={msgAvatar.tipo}>{msgAvatar.texto}</Alerta></div>}
      </Card>

      <Modal open={avatarPickerOpen} onClose={() => setAvatarPickerOpen(false)} title="Elige tu avatar" size="lg">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {AVATAR_CATEGORIES.map(cat => {
            const catAvatars = AVATARS.filter(a => a.categoria === cat.id)
            if (!catAvatars.length) return null
            return (
              <div key={cat.id}>
                <p className="text-[11px] font-extrabold uppercase tracking-[.07em] text-[var(--color-text-muted)] mb-2.5">{cat.nombre}</p>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
                  {catAvatars.map((av) => {
                    const selected = avatarSeleccionado === av.id
                    return (
                      <button
                        key={av.id}
                        onClick={() => { guardarAvatar(av.id); setAvatarPickerOpen(false) }}
                        disabled={guardandoAvatar}
                        className="group relative rounded-full overflow-hidden transition-all hover:scale-110 active:scale-95"
                        style={{
                          aspectRatio: '1',
                          boxShadow: selected ? '0 0 0 3px var(--color-accent), 0 0 0 5px color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'none',
                          transform: selected ? 'scale(1.08)' : undefined,
                        }}
                        title={av.nombre}
                      >
                        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: av.svg }} />
                        {selected && (
                          <div className="absolute inset-0 flex items-end justify-center pb-1">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="var(--color-accent-text)" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <Card>
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Cambiar contraseña</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Contraseña actual</label>
            <input type="password" value={pwActual} onChange={(e) => setPwActual(e.target.value)} placeholder="Tu contraseña actual" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Nueva contraseña</label>
            <input type="password" value={pwNuevo} onChange={(e) => setPwNuevo(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Confirmar nueva contraseña</label>
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
  const { updateSession } = useAuth()
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [nombre,   setNombre]   = useState('')
  const [telefono, setTelefono] = useState('')
  const [ciudad,   setCiudad]   = useState('')
  const [country,  setCountryState] = useState('co')
  const [diasSinCobro, setDiasSinCobro] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [guardandoDSC, setGuardandoDSC] = useState(false)
  const [msg, setMsg] = useState(null)
  const [msgDSC, setMsgDSC] = useState(null)
  const [festivos, setFestivos] = useState([])
  const [festivosLoading, setFestivosLoading] = useState(false)
  const [tasaMoratorio, setTasaMoratorio] = useState(0)
  const [diasGraciaMoratorio, setDiasGraciaMoratorio] = useState(5)
  const [guardandoMora, setGuardandoMora] = useState(false)
  const [msgMora, setMsgMora] = useState(null)
  const [ocultarSaldoWA, setOcultarSaldoWA] = useState(false)
  const [guardandoSaldoWA, setGuardandoSaldoWA] = useState(false)
  const [camposRecibo, setCamposRecibo] = useState([])
  const [guardandoCampos, setGuardandoCampos] = useState(false)
  const [msgCampos, setMsgCampos] = useState(null)

  const guardarCamposRecibo = async (campos) => {
    setGuardandoCampos(true); setMsgCampos(null)
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposRecibo: campos }),
      })
      if (res.ok) {
        setData(prev => ({ ...prev, org: { ...prev.org, camposRecibo: campos } }))
        setMsgCampos({ tipo: 'success', texto: 'Campos del recibo actualizados' })
        if (updateSession) await updateSession()
      } else {
        setMsgCampos({ tipo: 'error', texto: 'Error al guardar' })
      }
    } catch { setMsgCampos({ tipo: 'error', texto: 'Error de conexion' }) }
    finally { setGuardandoCampos(false) }
    setTimeout(() => setMsgCampos(null), 3000)
  }

  const [descargandoBackup, setDescargandoBackup] = useState(false)
  const [confirmReinicio, setConfirmReinicio] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [msgReinicio, setMsgReinicio] = useState(null)

  useEffect(() => {
    fetch('/api/configuracion/organizacion')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setNombre(d.org?.nombre ?? '')
        setTelefono(d.org?.telefono ?? '')
        setCiudad(d.org?.ciudad ?? '')
        setCountryState(d.org?.country ?? 'co')
        setTasaMoratorio(d.org?.tasaMoratorio ?? 0)
        setDiasGraciaMoratorio(d.org?.diasGraciaMoratorio ?? 5)
        setOcultarSaldoWA(d.org?.ocultarSaldoWA ?? false)
        setCamposRecibo(Array.isArray(d.org?.camposRecibo) ? d.org.camposRecibo : [])
        try { setDiasSinCobro(JSON.parse(d.org?.diasSinCobro || '[]')) } catch { setDiasSinCobro([]) }
      })
      .finally(() => setLoading(false))

    fetch('/api/festivos')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setFestivos(d.festivos ?? []) })
      .catch(() => {})
  }, [])

  const agregarFestivo = async (fecha, nombre) => {
    setFestivosLoading(true)
    try {
      const res = await fetch('/api/festivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, nombre }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ tipo: 'error', texto: data.error || 'Error al agregar festivo' })
        return
      }
      setFestivos(prev => [...prev, data.festivo].sort((a, b) => new Date(a.fecha) - new Date(b.fecha)))
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de conexión' })
    } finally {
      setFestivosLoading(false)
    }
  }

  const eliminarFestivo = async (id) => {
    setFestivosLoading(true)
    try {
      const res = await fetch(`/api/festivos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setMsg({ tipo: 'error', texto: data.error || 'Error al eliminar festivo' })
        return
      }
      setFestivos(prev => prev.filter(f => f.id !== id))
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de conexión' })
    } finally {
      setFestivosLoading(false)
    }
  }

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

  const guardarDSC = async () => {
    setGuardandoDSC(true); setMsgDSC(null)
    try {
      const res = await fetch('/api/configuracion/organizacion', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diasSinCobro }),
      })
      const d = await res.json()
      setMsgDSC(res.ok
        ? { tipo: 'success', texto: 'Días sin cobro guardados' }
        : { tipo: 'error',   texto: d.error ?? 'Error al guardar' })
    } catch {
      setMsgDSC({ tipo: 'error', texto: 'Error de conexión' })
    } finally { setGuardandoDSC(false) }
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
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Datos del negocio</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Nombre del negocio</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Teléfono</label>
            <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">País</label>
            <div
              className="flex items-center justify-between rounded-[12px] px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {COUNTRIES[country]?.name ?? 'Colombia'}
                </span>
              </div>
              <a
                href={`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(`Hola, soy ${nombre || 'usuario'} y quiero cambiar el país de mi cuenta. Actualmente esta en ${COUNTRIES[country]?.name ?? 'Colombia'}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium px-2.5 py-1 rounded-[8px] transition-all whitespace-nowrap"
                style={{
                  background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                  color: 'var(--color-accent)',
                  border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
                }}
              >
                Cambiar país
              </a>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-snug px-0.5">
              Para cambiar el país asociado a tu cuenta debes contactar a soporte.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Ciudad</label>
            <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Bogotá" className={inputClass} />
          </div>
          {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
          <Button onClick={guardar} loading={guardando} size="sm">Guardar cambios</Button>
        </div>
      </Card>

      <Card>
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-3">Días sin cobro</p>
        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mb-3">
          Los días que marques no generarán mora para ningún cliente. Puedes configurar días diferentes por ruta o por cliente.
        </p>
        <DiasSinCobroSelector value={diasSinCobro} onChange={setDiasSinCobro} />
        {diasSinCobro.length > 0 && (
          <p className="text-[10px] text-[var(--color-warning)] mt-2">
            {diasSinCobro.length === 1 ? '1 día' : `${diasSinCobro.length} días`} sin cobro configurados para toda la organización
          </p>
        )}
        {msgDSC && <Alerta tipo={msgDSC.tipo}>{msgDSC.texto}</Alerta>}
        <Button onClick={guardarDSC} loading={guardandoDSC} size="sm" className="mt-3">Guardar días sin cobro</Button>
      </Card>

      {/* Toggle capital = efectivo en mano */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">Capital en ruta = efectivo en mano</p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">
              Activa si entregas el capital de la ruta como plata física al cobrador. El sistema usará ese valor para calcular el dinero en mano y el cuadre de caja.
            </p>
          </div>
          <Toggle
            checked={!!org?.capitalEsEfectivo}
            onChange={async (nuevoValor) => {
              try {
                const res = await fetch('/api/configuracion/organizacion', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ capitalEsEfectivo: nuevoValor }),
                })
                if (res.ok) setData(prev => ({ ...prev, org: { ...prev.org, capitalEsEfectivo: nuevoValor } }))
              } catch {}
            }}
          />
        </div>
      </Card>

      {/* Toggle modo abreviado de montos */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">Modo abreviado de montos</p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">
              Escribe montos sin los ultimos tres ceros. Por ejemplo, 100 se convierte en 100.000 y 1.500 en 1.500.000.
            </p>
          </div>
          <Toggle
            checked={!!org?.modoAbreviado}
            onChange={async (nuevoValor) => {
              try {
                const res = await fetch('/api/configuracion/organizacion', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ modoAbreviado: nuevoValor }),
                })
                if (res.ok) {
                  setData(prev => ({ ...prev, org: { ...prev.org, modoAbreviado: nuevoValor } }))
                  if (updateSession) await updateSession()
                }
              } catch {}
            }}
          />
        </div>
      </Card>

      {/* Toggle aprobación de préstamos */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">Aprobar prestamos del cobrador</p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">
              Cuando un cobrador crea un prestamo, queda pendiente hasta que lo apruebes. Sin esta opcion, los prestamos se activan de inmediato.
            </p>
          </div>
          <Toggle
            checked={!!org?.requiereAprobacionPrestamos}
            onChange={async (nuevoValor) => {
              try {
                const res = await fetch('/api/configuracion/organizacion', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requiereAprobacionPrestamos: nuevoValor }),
                })
                if (res.ok) setData(prev => ({ ...prev, org: { ...prev.org, requiereAprobacionPrestamos: nuevoValor } }))
              } catch {}
            }}
          />
        </div>
      </Card>

      {/* Toggle portal de clientes — datos completos */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">Portal: mostrar datos completos</p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">
              Cuando el cliente ingresa al portal, ve monto prestado, total a pagar, tasa de interes y demas detalles financieros. Si desactivas esto, solo vera saldo, cuota y fecha de pago.
            </p>
          </div>
          <Toggle
            checked={!!org?.portalDatosCompletos}
            onChange={async (nuevoValor) => {
              try {
                const res = await fetch('/api/configuracion/organizacion', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ portalDatosCompletos: nuevoValor }),
                })
                if (res.ok) setData(prev => ({ ...prev, org: { ...prev.org, portalDatosCompletos: nuevoValor } }))
              } catch {}
            }}
          />
        </div>
      </Card>

      {/* Intereses moratorios */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[var(--color-warning)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-medium text-white text-sm">Intereses moratorios</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Cuando un cliente lleva varios dias sin pagar, el sistema calcula un interes adicional. Tu decides si aplicarlo o no desde cada prestamo.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Tasa moratorio mensual (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tasaMoratorio}
              onChange={(e) => setTasaMoratorio(e.target.value)}
              placeholder="0 = desactivado"
              className={inputClass}
            />
            <p className="text-[10px] text-[var(--color-text-muted)] leading-snug px-0.5">
              Porcentaje mensual sobre el monto en mora. Ej: 3 = 3% mensual. Dejalo en 0 para desactivar.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Dias de gracia</label>
            <input
              type="number"
              min="0"
              max="90"
              step="1"
              value={diasGraciaMoratorio}
              onChange={(e) => setDiasGraciaMoratorio(e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-[var(--color-text-muted)] leading-snug px-0.5">
              Dias que deben pasar en mora antes de que se empiece a calcular el interes moratorio.
            </p>
          </div>
          {msgMora && <Alerta tipo={msgMora.tipo}>{msgMora.texto}</Alerta>}
          <Button
            onClick={async () => {
              setGuardandoMora(true); setMsgMora(null)
              try {
                const res = await fetch('/api/configuracion/organizacion', {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tasaMoratorio: Number(tasaMoratorio), diasGraciaMoratorio: Number(diasGraciaMoratorio) }),
                })
                const d = await res.json()
                setMsgMora(res.ok
                  ? { tipo: 'success', texto: 'Configuración de moratorios guardada' }
                  : { tipo: 'error', texto: d.error ?? 'Error al guardar' })
                if (res.ok) {
                  setData(prev => ({ ...prev, org: { ...prev.org, tasaMoratorio: Number(tasaMoratorio), diasGraciaMoratorio: Number(diasGraciaMoratorio) } }))
                }
              } catch {
                setMsgMora({ tipo: 'error', texto: 'Error de conexión' })
              } finally { setGuardandoMora(false) }
            }}
            loading={guardandoMora}
            size="sm"
          >
            Guardar moratorios
          </Button>
        </div>
      </Card>

      {/* Mensajes de WhatsApp */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[#25d366] shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
          </svg>
          <h3 className="font-medium text-white text-sm">Mensajes de WhatsApp</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Configura que informacion se incluye en los mensajes que se envian a los clientes por WhatsApp.
        </p>
        <Toggle
          checked={ocultarSaldoWA}
          disabled={guardandoSaldoWA}
          label="Ocultar saldo pendiente"
          description="No mostrar el saldo pendiente, total a pagar ni porcentaje de progreso en los mensajes de WhatsApp (comprobantes, mora, recordatorios). Útil si no quieres que el cliente vea el monto total con intereses."
          onChange={async (nuevo) => {
            setOcultarSaldoWA(nuevo)
            setGuardandoSaldoWA(true)
            try {
              await fetch('/api/configuracion/organizacion', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ocultarSaldoWA: nuevo }),
              })
              setData(prev => ({ ...prev, org: { ...prev.org, ocultarSaldoWA: nuevo } }))
            } catch {}
            setGuardandoSaldoWA(false)
          }}
        />
      </Card>

      {/* Campos personalizados en recibos — plantilla por defecto */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="font-medium text-white text-sm">Campos del recibo (plantilla)</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Plantilla por defecto para todos los clientes. Puedes personalizar los campos de cada cliente desde la pagina del prestamo.
        </p>

        {camposRecibo.length > 0 && (
          <div className="mb-4">
            <CamposReciboList
              campos={camposRecibo}
              onRemove={(i) => {
                const next = camposRecibo.filter((_, j) => j !== i)
                setCamposRecibo(next)
                guardarCamposRecibo(next)
              }}
            />
          </div>
        )}

        {camposRecibo.length < 10 && (
          <AgregarCampoRecibo
            onAdd={(campo) => {
              const next = [...camposRecibo, campo]
              setCamposRecibo(next)
              guardarCamposRecibo(next)
            }}
          />
        )}

        {msgCampos && <div className="mt-3"><Alerta tipo={msgCampos.tipo}>{msgCampos.texto}</Alerta></div>}
      </Card>

      {/* Festivos */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="font-medium text-white text-sm">Festivos y días sin cobro específicos</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Fechas concretas en las que no se realiza cobro. No generan mora ese día.
        </p>
        <FestivosManager
          festivos={festivos}
          onAdd={agregarFestivo}
          onDelete={eliminarFestivo}
          loading={festivosLoading}
        />
      </Card>

      <Card>
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Plan y suscripción</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Plan actual</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={planBadge[org?.plan ?? 'starter']}>
                  {PLAN_NAMES[org?.plan ?? 'starter']}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)]"><span className="font-mono-display">{formatMoney(PRECIOS[org?.plan ?? 'starter'])}</span>/mes</span>
              </div>
            </div>
            <Link
              href="/configuracion/plan"
              className="px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all"
            >
              Cambiar plan
            </Link>
          </div>

          {suscripcion && (
            <div className="pt-3 border-t border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Vencimiento</span>
                <span className="text-[var(--color-text-muted)]">
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

      {/* Medios de transferencia */}
      <MetodoPagoAdmin />

      {/* Zona de peligro */}
      <Card style={{ border: '1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border))' }}>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <h3 className="font-medium text-sm" style={{ color: 'var(--color-danger)' }}>Zona de peligro</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Descarga un respaldo completo de tu cuenta o reinicia todos los datos para empezar de cero.
        </p>

        <div className="space-y-3">
          <div
            className="flex items-center justify-between gap-3 p-3 rounded-[12px]"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Descargar respaldo</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Descarga toda la informacion de tu cuenta en un archivo JSON.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={descargandoBackup}
              onClick={async () => {
                setDescargandoBackup(true)
                try {
                  const res = await fetch('/api/cuenta/backup')
                  if (!res.ok) throw new Error('Error al generar respaldo')
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = res.headers.get('Content-Disposition')?.split('filename="')?.[1]?.replace('"', '') || 'backup.json'
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                } catch {
                  alert('No se pudo generar el respaldo. Intenta de nuevo.')
                } finally {
                  setDescargandoBackup(false)
                }
              }}
            >
              Descargar
            </Button>
          </div>

          <div
            className="flex items-center justify-between gap-3 p-3 rounded-[12px]"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)' }}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-danger)' }}>Reiniciar mi cuenta</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Elimina todos los clientes, prestamos, pagos, rutas, socios y cobradores. Tu cuenta y suscripcion se mantienen.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmReinicio(true)}
            >
              Reiniciar
            </Button>
          </div>

          {msgReinicio && <Alerta tipo={msgReinicio.tipo}>{msgReinicio.texto}</Alerta>}
        </div>
      </Card>

      <ConfirmModal
        open={confirmReinicio}
        onClose={() => setConfirmReinicio(false)}
        title="Reiniciar toda la cuenta"
        message="Se eliminaran TODOS los datos: clientes, prestamos, pagos, rutas, socios, cobradores, capital y configuraciones de cobro. Solo se conserva tu cuenta de usuario y la suscripcion. Esta accion NO se puede deshacer. Te recomendamos descargar un respaldo antes de continuar."
        confirmLabel="Reiniciar todo"
        color="danger"
        loading={reiniciando}
        onConfirm={async () => {
          setReiniciando(true)
          setMsgReinicio(null)
          try {
            const res = await fetch('/api/cuenta/reiniciar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ confirmacion: 'REINICIAR' }),
            })
            const d = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(d.error || 'Error al reiniciar')
            setConfirmReinicio(false)
            setMsgReinicio({ tipo: 'success', texto: 'Cuenta reiniciada. La pagina se recargara en unos segundos.' })
            setTimeout(() => window.location.href = '/dashboard', 3000)
          } catch (e) {
            setMsgReinicio({ tipo: 'error', texto: e.message })
            setConfirmReinicio(false)
          } finally {
            setReiniciando(false)
          }
        }}
      />
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

  const barColor = diasRestantes === null || diasRestantes === undefined ? 'var(--color-text-muted)'
    : diasRestantes > 15 ? 'var(--color-success)'
    : diasRestantes > 7  ? 'var(--color-warning)'
    : 'var(--color-danger)'

  const barPct = (diasRestantes == null) ? 0 : Math.max(0, Math.min(100, (diasRestantes / 30) * 100))

  return (
    <div className="space-y-5">
      <Card
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 4%, transparent) 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, color-mix(in srgb, var(--color-accent) 2%, transparent) 100%)`,
          boxShadow: `0 0 30px color-mix(in srgb, var(--color-accent) 3%, transparent), 0 1px 2px rgba(0,0,0,0.3)`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Plan actual</p>
            <div className="flex items-center gap-2">
              <Badge variant={planBadge[org?.plan ?? 'starter']}>
                {PLAN_NAMES[org?.plan ?? 'starter']}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)]"><span className="font-mono-display">{formatMoney(PRECIOS[org?.plan ?? 'starter'])}</span>/mes</span>
            </div>
          </div>
          <Link
            href="/configuracion/plan"
            className="inline-flex items-center justify-center h-10 px-5 rounded-[12px] text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-all shrink-0"
          >
            Renovar / Cambiar
          </Link>
        </div>

        {suscripcion ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[var(--color-text-muted)]">Inicio</p>
                <p className="text-[var(--color-text-muted)] mt-0.5">{new Date(suscripcion.fechaInicio).toLocaleDateString('es-CO')}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Vencimiento</p>
                <p className="text-[var(--color-text-muted)] mt-0.5">{new Date(suscripcion.fechaVencimiento).toLocaleDateString('es-CO')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Tiempo restante</span>
                <span className="font-medium" style={{ color: barColor }}>
                  {diasRestantes != null
                    ? diasRestantes > 0
                      ? `${diasRestantes} días`
                      : `Vencida hace ${Math.abs(diasRestantes)} días`
                    : '—'}
                </span>
              </div>
              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
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
          <p className="text-sm text-[var(--color-text-muted)]">No hay información de suscripción disponible.</p>
        )}
      </Card>

      {historial?.length > 0 && (
        <Card>
          <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Historial de suscripciones</p>
          <div className="space-y-0">
            <div className="hidden sm:grid grid-cols-4 gap-2 text-[10px] text-[var(--color-text-muted)] font-medium uppercase pb-2 border-b border-[var(--color-border)]">
              <span>Período</span>
              <span className="text-center">Plan</span>
              <span className="text-center">Estado</span>
              <span className="text-right">Monto</span>
            </div>
            {historial.map((h) => (
              <div key={h.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-b border-[var(--color-border)] last:border-0 items-center">
                <p className="text-xs text-[var(--color-text-muted)]">
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
                <p className="text-xs text-[var(--color-text-muted)] text-right">
                  {h.montoCOP > 0 ? <span className="font-mono-display">{formatMoney(h.montoCOP)}</span> : 'Gratis'}
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
        <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em] mb-4">Tu link de referido</p>
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-hover)] border border-[var(--color-border)] rounded-[12px] px-4 py-3">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Código</p>
            <p className="text-lg font-bold font-mono text-[var(--color-accent)]">{codigo ?? 'Sin código'}</p>
          </div>

          {link && (
            <div className="bg-[var(--color-bg-hover)] border border-[var(--color-border)] rounded-[12px] px-4 py-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Link de registro</p>
              <p className="text-xs text-[var(--color-text-muted)] break-all">{link}</p>
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
            <p className="text-sm text-[var(--color-success)] font-medium">Por cada referido que pague su primer plan, ganas 1 mes gratis en tu suscripción.</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">Referidos</p>
          <Badge variant="green">{referidos.length}</Badge>
        </div>
        {referidos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aún no tienes referidos. Comparte tu link para empezar a ganar meses gratis.</p>
        ) : (
          <div className="space-y-0">
            {referidos.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{r.nombre}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
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
        <p className="text-xs text-[var(--color-text-muted)]">
          Recibe alertas cuando un cobrador registra pagos, clientes entran en mora o tu suscripción está por vencer.
        </p>

        {status === 'unsupported' && (
          <p className="text-xs text-[var(--color-warning)] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded-lg px-3 py-2">
            Tu navegador no soporta notificaciones push. Usa Chrome, Edge o Firefox.
          </p>
        )}

        {status === 'denied' && (
          <p className="text-xs text-[var(--color-danger)] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
            Las notificaciones fueron bloqueadas. Habilítalas desde la configuración de tu navegador.
          </p>
        )}

        {(status === 'subscribed' || status === 'unsubscribed') && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{status === 'subscribed' ? 'Activadas' : 'Desactivadas'}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{status === 'subscribed' ? 'Recibirás notificaciones push' : 'No recibirás notificaciones'}</p>
            </div>
            <Toggle checked={status === 'subscribed'} onChange={toggle} disabled={working} />
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Verificando...</span>
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
    { key: 'apariencia',     label: 'Apariencia',     visible: true },
  ].filter((t) => t.visible)

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)]">Configuración</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gestiona tu perfil y tu organización</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--color-border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap',
              tab === t.key
                ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-muted)]',
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
      {tab === 'apariencia'     && <TabApariencia />}
    </div>
  )
}

function InstallSection() {
  const [installed, setInstalled] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (standalone) { setInstalled(true); return }
    setInstalled(false)
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === 'accepted') setInstalled(true)
      return
    }
    setShowGuide(true)
  }

  return (
    <Card>
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Instalar la app</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Instala Control Finanzas como aplicacion en tu dispositivo para acceder mas rapido y usarla sin internet.
          </p>
        </div>

        {installed ? (
          <div
            className="flex items-center gap-3 p-3 rounded-[12px]"
            style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' }}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="var(--color-success)" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px]" style={{ color: 'var(--color-success)' }}>La app ya esta instalada en este dispositivo</p>
          </div>
        ) : (
          <button
            onClick={handleInstall}
            className="flex items-center gap-3 w-full p-3 rounded-[12px] text-left transition-all active:scale-[0.99]"
            style={{
              background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
            }}
          >
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-accent)' }}>Instalar en este dispositivo</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Te mostramos los pasos segun tu navegador</p>
            </div>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      {showGuide && <InstallGuideModal onClose={() => setShowGuide(false)} />}
    </Card>
  )
}

function TabApariencia() {
  const { theme, resolvedTheme } = useTheme()
  return (
    <div className="space-y-5">
      <Card>
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Tema de la aplicación</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Elige como se ve Control Finanzas. El modo sistema sigue la preferencia de tu dispositivo.
            </p>
          </div>
          <ThemeToggle variant="segmented" />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Modo actual: <strong style={{ color: 'var(--color-text-primary)' }}>{theme}</strong>
            {theme === 'system' && ` (resuelto a ${resolvedTheme})`}
          </p>
        </div>
      </Card>
      <InstallSection />
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

