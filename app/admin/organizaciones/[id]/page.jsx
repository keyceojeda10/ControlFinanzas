'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card }                 from '@/components/ui/Card'
import { Button }               from '@/components/ui/Button'
import { Badge }                from '@/components/ui/Badge'
import { SkeletonCard }         from '@/components/ui/Skeleton'
import { formatCOP }            from '@/lib/calculos'

const LIMITES = {
  basic:        { usuarios: 1, clientes: 50 },
  standard:     { usuarios: 3, clientes: 200 },
  professional: { usuarios: 999, clientes: 999999 },
}

const planBadge = { basic: 'gray', standard: 'blue', professional: 'purple' }

export default function OrgDetallePage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState('')

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
            onChange={(e) => ejecutarAccion('cambiarPlan', { plan: e.target.value })}
            disabled={!!accionando}
            className="h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#3b82f6]"
          >
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="professional">Professional</option>
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
          <p className="text-base font-bold text-[#3b82f6]">{org.prestamosActivos}</p>
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

      {/* Usuarios de la organización */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Usuarios</p>
        <div className="space-y-0">
          <div className="hidden sm:grid grid-cols-4 gap-2 text-[10px] text-[#555555] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
            <span>Nombre</span>
            <span>Email</span>
            <span className="text-center">Rol</span>
            <span className="text-center">Estado</span>
          </div>
          {(org.users ?? []).map((u) => (
            <div key={u.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5 border-b border-[#2a2a2a] last:border-0 items-center">
              <p className="text-sm font-medium text-[white]">{u.nombre}</p>
              <p className="text-xs text-[#888888] truncate">{u.email}</p>
              <div className="text-center">
                <Badge variant={u.rol === 'owner' ? 'blue' : 'gray'}>{{ owner: 'Admin', cobrador: 'Cobrador' }[u.rol] ?? u.rol}</Badge>
              </div>
              <div className="text-center">
                <Badge variant={u.activo ? 'green' : 'red'}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </Badge>
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
                <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] mt-1.5 shrink-0" />
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
