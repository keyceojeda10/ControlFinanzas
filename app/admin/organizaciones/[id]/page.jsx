'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card }                 from '@/components/ui/Card'
import { Button }               from '@/components/ui/Button'
import { Badge }                from '@/components/ui/Badge'
import { SkeletonCard }         from '@/components/ui/Skeleton'
import { formatCOP }            from '@/lib/calculos'

const LIMITES = {
  basic:        { usuarios: 1,  clientes: 450 },
  growth:       { usuarios: 2,  clientes: 1000 },
  standard:     { usuarios: 5,  clientes: 2000 },
  professional: { usuarios: 10, clientes: 10000 },
}

const planBadge = { basic: 'gray', growth: 'blue', standard: 'yellow', professional: 'purple' }

export default function OrgDetallePage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState('')
  const [descuentoInput, setDescuentoInput] = useState('')
  const [demoDias, setDemoDias] = useState('1')
  const [pagoDirecto, setPagoDirecto] = useState({ plan: 'basic', periodo: 'mensual', monto: '', extender: false })
  const [cobradoresInput, setCobradoresInput] = useState('')

  const fetchOrg = async () => {
    try {
      const res = await fetch(`/api/admin/organizaciones/${id}`)
      if (!res.ok) { router.push('/admin/organizaciones'); return }
      setOrg(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrg() }, [id])

  const ejecutarAccion = async (accion, extra = {}) => {
    setAccionando(accion)
    try {
      const res = await fetch(`/api/admin/organizaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra }),
      })
      const data = await res.json()
      if (res.ok) {
        await fetchOrg()
      } else {
        alert(data.error ?? 'Error')
      }
    } catch { alert('Error de conexión') } finally {
      setAccionando('')
    }
  }

  const accionSuscripcion = async (subId, accion) => {
    setAccionando(accion)
    try {
      const res = await fetch(`/api/admin/suscripciones/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (res.ok) await fetchOrg()
      else alert((await res.json()).error ?? 'Error')
    } catch { alert('Error de conexión') } finally {
      setAccionando('')
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!org) return null

  const sub    = org.suscripciones?.[0]
  const limite = LIMITES[org.plan] ?? LIMITES.basic
  const diasRestantes = sub
    ? Math.ceil((new Date(sub.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[white]">{org.nombre}</h1>
            <Badge variant={planBadge[org.plan]}>{org.plan}</Badge>
            <Badge variant={org.activo ? 'green' : 'red'}>
              {org.activo ? 'Activa' : 'Suspendida'}
            </Badge>
          </div>
          <p className="text-sm text-[#555555] mt-0.5">
            Registrada: {new Date(org.createdAt).toLocaleDateString('es-CO')}
            {org.ciudad && ` · ${org.ciudad}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Cambiar plan */}
          <select
            value={org.plan}
            onChange={(e) => {
              const nuevoPlan = e.target.value
              if (nuevoPlan === org.plan) return
              const fechaVenc = sub ? new Date(sub.fechaVencimiento).toLocaleDateString('es-CO') : null
              const msg = fechaVenc
                ? `Cambiar plan de "${org.nombre}" de ${org.plan} a ${nuevoPlan}?\n\nSe mantienen las mismas fechas de suscripcion (vence: ${fechaVenc}).`
                : `Cambiar plan de "${org.nombre}" de ${org.plan} a ${nuevoPlan}?`
              if (confirm(msg)) {
                ejecutarAccion('cambiarPlan', { plan: nuevoPlan })
              } else {
                e.target.value = org.plan
              }
            }}
            disabled={!!accionando}
            className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#f5c518]"
          >
            <option value="basic">Basico</option>
            <option value="growth">Crecimiento</option>
            <option value="standard">Profesional</option>
            <option value="professional">Empresarial</option>
          </select>
          {/* Suspender / Activar */}
          {org.activo ? (
            <Button
              variant="danger"
              size="sm"
              loading={accionando === 'suspender'}
              onClick={() => {
                if (confirm(`¿Suspender "${org.nombre}"? Sus usuarios no podrán iniciar sesión.`)) {
                  ejecutarAccion('suspender')
                }
              }}
            >
              Suspender
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              loading={accionando === 'activar'}
              onClick={() => ejecutarAccion('activar')}
            >
              Activar
            </Button>
          )}
        </div>
      </div>

      {/* Métricas de uso */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center">
          <p className="text-[10px] text-[#555555]">Usuarios</p>
          <p className="text-base font-bold text-[white]">
            {org.users?.length ?? 0}
            <span className="text-[10px] text-[#555555] font-normal"> / {limite.usuarios === 999 ? '∞' : limite.usuarios}</span>
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center">
          <p className="text-[10px] text-[#555555]">Clientes</p>
          <p className="text-base font-bold text-[white]">
            {org._count?.clientes ?? 0}
            <span className="text-[10px] text-[#555555] font-normal"> / {limite.clientes > 9999 ? '∞' : limite.clientes}</span>
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center">
          <p className="text-[10px] text-[#555555]">Préstamos activos</p>
          <p className="text-base font-bold text-[#f5c518]">{org.prestamosActivos}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center">
          <p className="text-[10px] text-[#555555]">Cartera activa</p>
          <p className="text-base font-bold text-[#22c55e]">{formatCOP(org.carteraActiva)}</p>
        </div>
      </div>

      {/* Suscripción actual */}
      {sub && (
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Suscripción actual</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={planBadge[sub.plan]}>{sub.plan}</Badge>
                <Badge variant={sub.estado === 'activa' ? 'green' : sub.estado === 'vencida' ? 'red' : 'gray'}>
                  {sub.estado}
                </Badge>
              </div>
              <p className="text-xs text-[#888888]">
                {new Date(sub.fechaInicio).toLocaleDateString('es-CO')} → {new Date(sub.fechaVencimiento).toLocaleDateString('es-CO')}
              </p>
              {diasRestantes !== null && (
                <p className={`text-sm font-bold ${diasRestantes > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {diasRestantes > 0
                    ? `${diasRestantes} días restantes`
                    : `${Math.abs(diasRestantes)} días vencida`}
                </p>
              )}
              <p className="text-xs text-[#555555]">Monto: {formatCOP(sub.montoCOP)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                loading={accionando === 'renovar'}
                onClick={() => accionSuscripcion(sub.id, 'renovar')}
              >
                Renovar 30d
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={accionando === 'gracia'}
                onClick={() => accionSuscripcion(sub.id, 'gracia')}
              >
                Gracia 7d
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={accionando === 'cancelar'}
                onClick={() => {
                  if (confirm('¿Cancelar esta suscripción?')) accionSuscripcion(sub.id, 'cancelar')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Asignar plan — Pago directo */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Asignar plan (pago directo)</p>
        <p className="text-xs text-[#888888] mb-4">
          Usa esto cuando el cliente te paga directamente (transferencia, efectivo, etc.). Se activa igual que si pagara por MercadoPago: actualiza suscripción, le llega email de confirmación y se procesan referidos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555555]">Plan</label>
            <select
              value={pagoDirecto.plan}
              onChange={(e) => setPagoDirecto(p => ({ ...p, plan: e.target.value }))}
              className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#f5c518]"
            >
              <option value="basic">Basico ($59.000/mes)</option>
              <option value="growth">Crecimiento ($79.000/mes)</option>
              <option value="standard">Profesional ($119.000/mes)</option>
              <option value="professional">Empresarial ($259.000/mes)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555555]">Periodo</label>
            <select
              value={pagoDirecto.periodo}
              onChange={(e) => setPagoDirecto(p => ({ ...p, periodo: e.target.value }))}
              className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#f5c518]"
            >
              <option value="mensual">Mensual (30 días)</option>
              <option value="trimestral">Trimestral (90 días)</option>
              <option value="anual">Anual (365 días)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555555]">Monto recibido ($)</label>
            <input
              type="number"
              min="0"
              value={pagoDirecto.monto}
              onChange={(e) => setPagoDirecto(p => ({ ...p, monto: e.target.value }))}
              placeholder="Ej: 59000"
              className="w-32 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] focus:outline-none focus:border-[#f5c518]"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button
              size="sm"
              loading={accionando === 'asignarPlan'}
              onClick={() => {
                if (!pagoDirecto.monto || parseInt(pagoDirecto.monto) <= 0) {
                  alert('Ingresa el monto que recibiste')
                  return
                }
                const periodoLabel = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }[pagoDirecto.periodo]
                const extMsg = pagoDirecto.extender ? '\n(Se extiende desde la fecha de vencimiento actual)' : '\n(Empieza desde hoy)'
                if (confirm(`¿Asignar plan ${pagoDirecto.plan} (${periodoLabel}) a "${org.nombre}" por $${parseInt(pagoDirecto.monto).toLocaleString('es-CO')}?${extMsg}\n\nSe le enviará email de confirmación al cliente.`)) {
                  ejecutarAccion('asignarPlan', {
                    plan: pagoDirecto.plan,
                    periodo: pagoDirecto.periodo,
                    monto: pagoDirecto.monto,
                    extender: pagoDirecto.extender,
                  })
                  setPagoDirecto(p => ({ ...p, monto: '', extender: false }))
                }
              }}
            >
              Asignar plan
            </Button>
          </div>
        </div>
        {sub && sub.estado === 'activa' && diasRestantes > 0 && sub.plan === pagoDirecto.plan && (
          <label className="mt-3 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pagoDirecto.extender}
              onChange={(e) => setPagoDirecto(p => ({ ...p, extender: e.target.checked }))}
              className="w-4 h-4 rounded border-[#2a2a2a] bg-[#111111] accent-[#f5c518]"
            />
            <span className="text-xs text-[#888888]">
              Extender desde vencimiento actual ({new Date(sub.fechaVencimiento).toLocaleDateString('es-CO')}) en vez de empezar desde hoy
            </span>
          </label>
        )}
        {sub && (
          <div className="mt-3 bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.15)] rounded-[12px] px-4 py-2">
            <p className="text-[11px] text-[#f5c518]">
              Suscripción actual: {sub.plan} · Vence: {new Date(sub.fechaVencimiento).toLocaleDateString('es-CO')}
              {diasRestantes !== null && ` (${diasRestantes > 0 ? diasRestantes + ' días restantes' : Math.abs(diasRestantes) + ' días vencida'})`}
              {' '}— El nuevo plan empieza desde hoy{sub.estado === 'activa' && diasRestantes > 0 && sub.plan === pagoDirecto.plan ? ' (o puedes extender desde el vencimiento actual marcando la casilla arriba)' : ''}.
            </p>
          </div>
        )}
      </Card>

      {/* Demo Day */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Demo de plan</p>
        {org.planOriginal && org.planDemoHasta ? (
          <div className="space-y-3">
            <div className="bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] rounded-[12px] px-4 py-3">
              <p className="text-sm text-[#a855f7] font-semibold">Demo activo</p>
              <p className="text-xs text-[#888888] mt-1">
                Plan actual: <span className="text-[white] font-medium">{org.plan}</span> ·
                Plan original: <span className="text-[white] font-medium">{org.planOriginal}</span>
              </p>
              <p className="text-xs text-[#888888]">
                Expira: <span className="text-[white]">{new Date(org.planDemoHasta).toLocaleString('es-CO')}</span>
                {' '}({Math.max(0, Math.ceil((new Date(org.planDemoHasta) - new Date()) / (1000 * 60 * 60)))}h restantes)
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={accionando === 'revertirDemo'}
              onClick={() => {
                if (confirm(`¿Revertir demo? Volverá al plan ${org.planOriginal}`)) {
                  ejecutarAccion('revertirDemo')
                }
              }}
            >
              Revertir ahora a {org.planOriginal}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#888888]">
              Asigna acceso temporal al plan Professional para que el cliente pruebe las funciones premium.
              Al expirar, vuelve automáticamente a su plan actual ({org.plan}).
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#888888]">Días:</label>
                <select
                  value={demoDias}
                  onChange={(e) => setDemoDias(e.target.value)}
                  className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#f5c518]"
                >
                  <option value="1">1 día</option>
                  <option value="2">2 días</option>
                  <option value="3">3 días</option>
                  <option value="5">5 días</option>
                  <option value="7">7 días</option>
                </select>
              </div>
              <Button
                size="sm"
                loading={accionando === 'demoDay'}
                onClick={() => {
                  if (confirm(`¿Activar demo Professional por ${demoDias} día(s) para "${org.nombre}"?`)) {
                    ejecutarAccion('demoDay', { dias: demoDias, planDemo: 'professional' })
                  }
                }}
              >
                Activar Demo Pro
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Descuento y referidos */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Descuento y referidos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Descuento */}
          <div className="space-y-2">
            <p className="text-xs text-[#888888]">Descuento especial (%)</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={descuentoInput}
                onChange={(e) => setDescuentoInput(e.target.value)}
                placeholder={String(org.descuento ?? 0)}
                className="w-20 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] focus:outline-none focus:border-[#f5c518]"
              />
              <Button
                size="sm"
                loading={accionando === 'cambiarDescuento'}
                onClick={() => {
                  ejecutarAccion('cambiarDescuento', { descuento: descuentoInput || '0' })
                  setDescuentoInput('')
                }}
              >
                Aplicar
              </Button>
            </div>
            {org.descuento > 0 && (
              <p className="text-xs text-[#22c55e]">Descuento activo: {org.descuento}%</p>
            )}
          </div>

          {/* Referidos */}
          <div className="space-y-2">
            <p className="text-xs text-[#888888]">Código de referido</p>
            <p className="text-sm font-mono text-[#f5c518]">{org.codigoReferido ?? 'Sin código'}</p>
            {org.referidoPor && (
              <p className="text-xs text-[#888888]">
                Referido por: <span className="text-[white]">{org.referidoPor.nombre}</span>
              </p>
            )}
            {org.referidos?.length > 0 && (
              <div>
                <p className="text-xs text-[#888888]">Referidos: <span className="text-[#22c55e] font-bold">{org.referidos.length}</span></p>
                <div className="mt-1 space-y-1">
                  {org.referidos.slice(0, 5).map((r) => (
                    <p key={r.id} className="text-[11px] text-[#888888]">
                      {r.nombre} · {new Date(r.createdAt).toLocaleDateString('es-CO')}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Cobradores extra */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Cobradores extra</p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[#888888]">Límite base del plan</p>
              <p className="text-sm font-bold text-[white]">{limite.usuarios === 999 ? '∞' : limite.usuarios} usuario{limite.usuarios !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-[#888888]">Cobradores extra</p>
              <p className="text-sm font-bold text-[#f5c518]">{org.cobradoresExtra ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[#888888]">Total permitido</p>
              <p className="text-sm font-bold text-[#22c55e]">{(limite.usuarios === 999 ? '∞' : limite.usuarios + (org.cobradoresExtra ?? 0))}</p>
            </div>
            <div>
              <p className="text-xs text-[#888888]">Usuarios actuales</p>
              <p className="text-sm font-bold text-[white]">{org.users?.length ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#888888]">Asignar cobradores extra:</label>
            <input
              type="number"
              min="0"
              max="50"
              value={cobradoresInput}
              onChange={(e) => setCobradoresInput(e.target.value)}
              placeholder={String(org.cobradoresExtra ?? 0)}
              className="w-20 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] focus:outline-none focus:border-[#f5c518]"
            />
            <Button
              size="sm"
              loading={accionando === 'cambiarCobradores'}
              onClick={() => {
                const val = cobradoresInput === '' ? org.cobradoresExtra ?? 0 : parseInt(cobradoresInput)
                if (confirm(`¿Cambiar cobradores extra de ${org.cobradoresExtra ?? 0} a ${val} para "${org.nombre}"?`)) {
                  ejecutarAccion('cambiarCobradores', { cobradoresExtra: val })
                  setCobradoresInput('')
                }
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Card>

      {/* Usuarios de la organización */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Usuarios</p>
        <div className="space-y-0">
          <div className="hidden sm:grid grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_0.9fr] gap-2 text-[10px] text-[#555555] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
            <span>Nombre</span>
            <span>Email</span>
            <span className="text-center">Rol</span>
            <span className="text-center">Estado</span>
            <span className="text-center">Acciones</span>
          </div>
          {(org.users ?? []).map((u) => (
            <div key={u.id} className="grid grid-cols-2 sm:grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_0.9fr] gap-2 py-2.5 border-b border-[#2a2a2a] last:border-0 items-center">
              <p className="text-sm font-medium text-[white]">{u.nombre}</p>
              <p className="text-xs text-[#888888] truncate">{u.email}</p>
              <div className="text-center">
                <Badge variant={u.rol === 'owner' ? 'blue' : 'gray'}>{{ owner: 'Admin', cobrador: 'Cobrador' }[u.rol] ?? u.rol}</Badge>
              </div>
              <div className="text-center">
                <button
                  onClick={() => ejecutarAccion('toggleUsuario', { userId: u.id })}
                  disabled={!!accionando}
                  title={u.activo ? 'Click para desactivar' : 'Click para activar'}
                >
                  <Badge variant={u.activo ? 'green' : 'red'}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => {
                    const nueva = prompt(`Nueva contraseña para ${u.nombre} (${u.email}):\n\nMínimo 6 caracteres.`)
                    if (nueva == null) return
                    const clean = nueva.trim()
                    if (clean.length < 6) {
                      alert('La contraseña debe tener al menos 6 caracteres')
                      return
                    }
                    if (!confirm(`¿Restablecer la contraseña de ${u.nombre}?\n\nEl usuario deberá usar la nueva contraseña en su próximo inicio de sesión.`)) return
                    ejecutarAccion('resetearPassword', { userId: u.id, nuevaPassword: clean })
                  }}
                  disabled={!!accionando}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#f5c518] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)] hover:bg-[rgba(245,197,24,0.15)] transition-all disabled:opacity-50"
                  title="Restablecer contraseña"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Historial de acciones admin */}
      {org.adminLogs?.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Historial de acciones</p>
          <div className="space-y-2">
            {org.adminLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[#2a2a2a] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f5c518] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white]">{log.detalle ?? log.accion}</p>
                  <p className="text-[10px] text-[#555555]">
                    {log.admin?.nombre ?? 'Admin'} · {new Date(log.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
