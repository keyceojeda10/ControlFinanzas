'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card }                 from '@/components/ui/Card'
import { Button }               from '@/components/ui/Button'
import { Badge }                from '@/components/ui/Badge'
import { SkeletonCard }         from '@/components/ui/Skeleton'
import { formatMoney }          from '@/lib/i18n'
import PrecioPreferencial        from '@/components/admin/PrecioPreferencial'
import AsignarPlanDirecto        from '@/components/admin/AsignarPlanDirecto'
import { PLANES_CONFIG, cuposDe, admiteAdicionales } from '@/lib/planes'

/* ⚠ ESTA TABLA ESTABA COPIADA AQUÍ, Y YA SE HABÍA DESFASADO: decía 150 clientes
   para Inicial cuando `lib/planes.js` dice 100, así que la ficha del superadmin
   enseñaba un tope que no existe. Los límites salen de la fuente única, que es
   la que usan de verdad el API y el cobro. */
const limitesDe = (plan) => {
  const c = PLANES_CONFIG[plan] ?? PLANES_CONFIG.starter
  return { usuarios: c.maxUsuarios, clientes: c.maxClientes, rutas: c.maxRutas }
}

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green' }

export default function OrgDetallePage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [org,     setOrg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState('')
  const [demoDias, setDemoDias] = useState('1')
  /* Arranca en el vencimiento que ya tiene: así el calendario abre por donde
     está y no en el mes de hoy, que casi nunca es lo que uno busca. */
  const [fechaVence, setFechaVence] = useState('')
  const [cobradoresInput, setCobradoresInput] = useState('')
  const [clientesInput, setClientesInput] = useState('')
  const [rutasInput, setRutasInput] = useState('')
  const [adicCobradoresInput, setAdicCobradoresInput] = useState('')
  const [adicRutasInput, setAdicRutasInput] = useState('')
  const [extensionDias, setExtensionDias] = useState('')
  const [diaFijoPago, setDiaFijoPago] = useState('')

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/organizaciones/${id}`)
      if (!res.ok) { router.push('/admin/organizaciones'); return }
      const datos = await res.json()
      setOrg(datos)
      /* El calendario abre por donde ESTÁ el vencimiento, no en el mes de hoy:
         quien va a moverlo casi siempre lo mueve unos días, no medio año. */
      const vence = datos?.suscripciones?.[0]?.fechaVencimiento
      if (vence) setFechaVence(new Date(vence).toISOString().slice(0, 10))
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { fetchOrg() }, [fetchOrg])

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
        return true
      }
      alert(data.error ?? 'Error')
      return false
    } catch { alert('Error de conexión'); return false } finally {
      setAccionando('')
    }
  }

  const accionSuscripcion = async (subId, accion, extra = {}) => {
    /* `accionUI` es solo para saber QUÉ BOTÓN gira: quitar días y extender son
       la misma acción para el servidor —una con el número en negativo— y sin
       esto el reloj aparecía en el botón de al lado. No se manda. */
    const { accionUI, ...cuerpo } = extra
    setAccionando(accionUI ?? accion)
    try {
      const res = await fetch(`/api/admin/suscripciones/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...cuerpo }),
      })
      const data = await res.json()
      if (res.ok) await fetchOrg()
      else alert(data.error ?? 'Error')
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
  const limite = limitesDe(org.plan)
  const diasRestantes = sub
    ? Math.ceil((new Date(sub.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[25px] font-semibold text-[var(--cf-ink)]">{org.nombre}</h1>
            <Badge variant={planBadge[org.plan]}>{org.plan}</Badge>
            <Badge variant={org.activo ? 'green' : 'red'}>
              {org.activo ? 'Activa' : 'Suspendida'}
            </Badge>
          </div>
          <p className="text-sm text-[var(--cf-ink-3)] mt-0.5">
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
                ? `Cambiar plan de "${org.nombre}" de ${org.plan} a ${nuevoPlan}?\n\nSe mantienen las mismas fechas de suscripción (vence: ${fechaVenc}).`
                : `Cambiar plan de "${org.nombre}" de ${org.plan} a ${nuevoPlan}?`
              if (confirm(msg)) {
                ejecutarAccion('cambiarPlan', { plan: nuevoPlan })
              } else {
                e.target.value = org.plan
              }
            }}
            disabled={!!accionando}
            className="h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-xs text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
          >
            <option value="starter">Inicial</option>
            <option value="basic">Básico</option>
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
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center">
          <p className="text-[10px] text-[var(--cf-ink-3)]">Usuarios</p>
          <p className="text-base font-bold text-[var(--cf-ink)]">
            {org.users?.length ?? 0}
            <span className="text-[10px] text-[var(--cf-ink-3)] font-normal"> / {limite.usuarios === 999 ? '∞' : limite.usuarios}</span>
          </p>
        </div>
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center">
          <p className="text-[10px] text-[var(--cf-ink-3)]">Clientes</p>
          <p className="text-base font-bold text-[var(--cf-ink)]">
            {org._count?.clientes ?? 0}
            <span className="text-[10px] text-[var(--cf-ink-3)] font-normal"> / {limite.clientes > 9999 ? '∞' : limite.clientes + (org.clientesExtra ?? 0)}</span>
          </p>
        </div>
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center">
          <p className="text-[10px] text-[var(--cf-ink-3)]">Préstamos activos</p>
          <p className="text-base font-bold text-[var(--cf-gold)]">{org.prestamosActivos}</p>
        </div>
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center">
          <p className="text-[10px] text-[var(--cf-ink-3)]">Cartera activa</p>
          <p className="text-base font-bold text-[var(--cf-green-dark)] font-mono-display">{formatMoney(org.carteraActiva)}</p>
        </div>
      </div>

      {/* Suscripción actual */}
      {sub && (
        <Card>
          <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Suscripción actual</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={planBadge[sub.plan]}>{sub.plan}</Badge>
                <Badge variant={sub.estado === 'activa' ? 'green' : sub.estado === 'vencida' ? 'red' : 'gray'}>
                  {sub.estado}
                </Badge>
              </div>
              <p className="text-xs text-[var(--cf-ink-3)]">
                {new Date(sub.fechaInicio).toLocaleDateString('es-CO')} → {new Date(sub.fechaVencimiento).toLocaleDateString('es-CO')}
              </p>
              {diasRestantes !== null && (
                <p className={`text-sm font-bold ${diasRestantes > 0 ? 'text-[var(--cf-green-dark)]' : 'text-[var(--cf-red-dark)]'}`}>
                  {diasRestantes > 0
                    ? `${diasRestantes} días restantes`
                    : `${Math.abs(diasRestantes)} días vencida`}
                </p>
              )}
              <p className="text-xs text-[var(--cf-ink-3)]">Monto: {formatMoney(sub.montoCOP)}</p>
            </div>
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--cf-ink-3)]">Dias</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={extensionDias}
                    onChange={(e) => setExtensionDias(e.target.value)}
                    placeholder="30"
                    className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--cf-ink-3)]">Dia fijo (opcional)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={diaFijoPago}
                    onChange={(e) => setDiaFijoPago(e.target.value)}
                    placeholder="Ej: 28"
                    className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={accionando === 'renovar'}
                  onClick={() => {
                    const dias = parseInt(extensionDias) || 30
                    const diaFijo = parseInt(diaFijoPago) || null
                    const label = diaFijo ? `${dias} dias (dia fijo: ${diaFijo})` : `${dias} dias`
                    if (confirm(`Renovar suscripcion de "${org.nombre}" por ${label}?`)) {
                      accionSuscripcion(sub.id, 'renovar', { dias, diaFijo })
                    }
                  }}
                >
                  Renovar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={accionando === 'extender'}
                  onClick={() => {
                    const dias = parseInt(extensionDias)
                    const diaFijo = parseInt(diaFijoPago) || null
                    if (!dias || dias < 1) { alert('Ingresa la cantidad de dias'); return }
                    const label = diaFijo ? `${dias} dias (dia fijo: ${diaFijo})` : `${dias} dias`
                    if (confirm(`Extender suscripcion de "${org.nombre}" por ${label}?`)) {
                      accionSuscripcion(sub.id, 'extender', { dias, diaFijo })
                    }
                  }}
                >
                  Extender
                </Button>
                {/* ⚠ QUITAR DÍAS, que antes no se podía.
                    «Yo puedo agregar días, pero no puedo quitar días.» — el
                    dueño. El API rechazaba cualquier negativo, así que un +30
                    mal puesto solo se deshacía dando la vuelta al año. */}
                <Button
                  variant="secondary"
                  size="sm"
                  loading={accionando === 'quitar'}
                  onClick={() => {
                    const dias = parseInt(extensionDias)
                    if (!dias || dias < 1) { alert('Escribe cuántos días quitar'); return }
                    if (confirm(`¿Quitarle ${dias} días a "${org.nombre}"? Si queda en el pasado, la suscripción pasa a vencida.`)) {
                      accionSuscripcion(sub.id, 'extender', { dias: -dias, accionUI: 'quitar' })
                    }
                  }}
                >
                  Quitar dias
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
              {/* ⚠ LA FECHA EXACTA. «No puedo ubicarle una fecha específica o
                  establecerle una fecha con un calendario.» — el dueño. Sumar y
                  restar días sirve para ajustar; cuando alguien paga hasta el 15
                  de octubre, lo que uno quiere es escribir el 15 de octubre. */}
              <div className="flex gap-2 flex-wrap items-end pt-2" style={{ borderTop: '1px dashed var(--cf-border)' }}>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--cf-ink-3)]">O ponle una fecha exacta</label>
                  <input
                    type="date"
                    value={fechaVence}
                    onChange={(e) => setFechaVence(e.target.value)}
                    className="h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={accionando === 'fecha'}
                  onClick={() => {
                    if (!fechaVence) { alert('Elige la fecha'); return }
                    if (confirm(`¿Que "${org.nombre}" venza el ${fechaVence}?`)) {
                      accionSuscripcion(sub.id, 'fecha', { fecha: fechaVence })
                    }
                  }}
                >
                  Vence ese dia
                </Button>
                <p className="text-[10px] text-[var(--cf-ink-3)] basis-full">
                  Se guarda al final del día, para que el día pactado se disfrute entero.
                </p>
              </div>

              {diaFijoPago && (
                <p className="text-[10px] text-[var(--cf-gold)]">
                  Con dia fijo {diaFijoPago}: al renovar/extender, la fecha se ajusta para que venza el dia {diaFijoPago} del mes
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <PrecioPreferencial org={org} accionando={accionando} ejecutarAccion={ejecutarAccion} />

      <AsignarPlanDirecto org={org} sub={sub} diasRestantes={diasRestantes} accionando={accionando} ejecutarAccion={ejecutarAccion} />

      {/* Demo Day */}
      <Card>
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Demo de plan</p>
        {org.planOriginal && org.planDemoHasta ? (
          <div className="space-y-3">
            <div className="bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] rounded-[12px] px-4 py-3">
              <p className="text-sm text-[var(--cf-blue)] font-semibold">Demo activo</p>
              <p className="text-xs text-[var(--cf-ink-3)] mt-1">
                Plan actual: <span className="text-[var(--cf-ink)] font-medium">{org.plan}</span> ·
                Plan original: <span className="text-[var(--cf-ink)] font-medium">{org.planOriginal}</span>
              </p>
              <p className="text-xs text-[var(--cf-ink-3)]">
                Expira: <span className="text-[var(--cf-ink)]">{new Date(org.planDemoHasta).toLocaleString('es-CO')}</span>
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
            <p className="text-xs text-[var(--cf-ink-3)]">
              Asigna acceso temporal al plan Professional para que el cliente pruebe las funciones premium.
              Al expirar, vuelve automáticamente a su plan actual ({org.plan}).
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--cf-ink-3)]">Días:</label>
                <select
                  value={demoDias}
                  onChange={(e) => setDemoDias(e.target.value)}
                  className="h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-xs text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
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

      {/* Referidos. El «descuento %» que vivía aquí se fue el 12 sep 2026:
          nadie lo cobraba igual (la hoja lo restaba, el cron no) y un descuento
          sin fecha es justo lo que el dueño pidió quitar. Lo sustituye el
          precio preferencial, arriba. */}
      <Card>
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Referidos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Referidos */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--cf-ink-3)]">Código de referido</p>
            <p className="text-sm font-mono text-[var(--cf-gold)]">{org.codigoReferido ?? 'Sin código'}</p>
            {org.referidoPor && (
              <p className="text-xs text-[var(--cf-ink-3)]">
                Referido por: <span className="text-[var(--cf-ink)]">{org.referidoPor.nombre}</span>
              </p>
            )}
            {org.referidos?.length > 0 && (
              <div>
                <p className="text-xs text-[var(--cf-ink-3)]">Referidos: <span className="text-[var(--cf-green-dark)] font-bold">{org.referidos.length}</span></p>
                <div className="mt-1 space-y-1">
                  {org.referidos.slice(0, 5).map((r) => (
                    <p key={r.id} className="text-[11px] text-[var(--cf-ink-3)]">
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
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Cobradores extra y adicionales</p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Límite base del plan</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{limite.usuarios === 999 ? '∞' : limite.usuarios} usuario{limite.usuarios !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Regalados</p>
              <p className="text-sm font-bold text-[var(--cf-gold)]">{org.cobradoresExtra ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Pagados</p>
              <p className="text-sm font-bold text-[var(--cf-gold)]">{org.cobradoresAdicionales ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Total permitido</p>
              <p className="text-sm font-bold text-[var(--cf-green-dark)]">{cuposDe(org).usuarios}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Usuarios actuales</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{org.users?.length ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--cf-ink-3)]">Regalar cobradores extra:</label>
            <input
              type="number"
              min="0"
              max="50"
              value={cobradoresInput}
              onChange={(e) => setCobradoresInput(e.target.value)}
              placeholder={String(org.cobradoresExtra ?? 0)}
              className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
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
          {/* Los PAGADOS: van en cada cobro del plan. Aquí se cargan los que
              se piden por WhatsApp (países sin Wompi); en Colombia los compra
              el negocio solo desde «Mi plan». */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--cf-ink-3)]">Cobradores adicionales pagados:</label>
            <input
              type="number"
              min="0"
              max="50"
              value={adicCobradoresInput}
              onChange={(e) => setAdicCobradoresInput(e.target.value)}
              placeholder={String(org.cobradoresAdicionales ?? 0)}
              disabled={!admiteAdicionales(org.plan)}
              className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] disabled:opacity-50"
            />
            <Button
              size="sm"
              disabled={!admiteAdicionales(org.plan)}
              loading={accionando === 'cambiarAdicionales'}
              onClick={() => {
                const val = adicCobradoresInput === '' ? org.cobradoresAdicionales ?? 0 : parseInt(adicCobradoresInput)
                if (confirm(`¿Cambiar cobradores adicionales PAGADOS de ${org.cobradoresAdicionales ?? 0} a ${val} para "${org.nombre}"? Van en su próximo cobro.`)) {
                  ejecutarAccion('cambiarAdicionales', { tipo: 'cobradores', cantidad: val })
                  setAdicCobradoresInput('')
                }
              }}
            >
              Aplicar
            </Button>
            {!admiteAdicionales(org.plan) && <span className="text-xs text-[var(--cf-ink-3)]">Su plan no admite adicionales</span>}
          </div>
        </div>
      </Card>

      {/* Clientes extra
          Nació de dos cuentas del plan Inicial atascadas en 113 y 109 con un
          tope de 100: no podían registrar ni uno más, y subirlas de plan no
          siempre es la respuesta. Antes esto se tocaba a mano en la base. */}
      <Card>
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Clientes extra</p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Límite base del plan</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{limite.clientes > 9999 ? '∞' : limite.clientes} clientes</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Clientes extra</p>
              <p className="text-sm font-bold text-[var(--cf-gold)]">{org.clientesExtra ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Total permitido</p>
              <p className="text-sm font-bold text-[var(--cf-green-dark)]">{limite.clientes > 9999 ? '∞' : limite.clientes + (org.clientesExtra ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Clientes actuales</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{org._count?.clientes ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--cf-ink-3)]">Asignar clientes extra:</label>
            <input
              type="number"
              min="0"
              max="5000"
              value={clientesInput}
              onChange={(e) => setClientesInput(e.target.value)}
              placeholder={String(org.clientesExtra ?? 0)}
              className="w-24 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
            />
            <Button
              size="sm"
              loading={accionando === 'cambiarClientes'}
              onClick={() => {
                const val = clientesInput === '' ? org.clientesExtra ?? 0 : parseInt(clientesInput)
                if (confirm(`¿Cambiar clientes extra de ${org.clientesExtra ?? 0} a ${val} para "${org.nombre}"?`)) {
                  ejecutarAccion('cambiarClientes', { clientesExtra: val })
                  setClientesInput('')
                }
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Card>

      {/* Rutas extra
          Era el único de los tres cupos que no se podía dar desde aquí, así que
          conceder una ruta obligaba a tocar la base a mano y sin rastro. Y en
          Inicial y Básico la ruta extra NO está a la venta (`rutaExtra: 0`):
          esto es la única forma de que esas cuentas tengan una segunda. */}
      <Card>
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Rutas extra y adicionales</p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Límite base del plan</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{limite.rutas} ruta{limite.rutas !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Regaladas</p>
              <p className="text-sm font-bold text-[var(--cf-gold)]">{org.rutasExtra ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Pagadas</p>
              <p className="text-sm font-bold text-[var(--cf-gold)]">{org.rutasAdicionales ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Total permitido</p>
              <p className="text-sm font-bold text-[var(--cf-green-dark)]">{cuposDe(org).rutas}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--cf-ink-3)]">Rutas creadas</p>
              <p className="text-sm font-bold text-[var(--cf-ink)]">{org._count?.rutas ?? 0}</p>
            </div>
          </div>
          {/* Lo que pasa cuando el cupo queda por debajo de lo que ya tiene: las
              rutas NO se borran, se congelan. La regla vive en
              `lib/limites-plan.js` y aquí solo se avisa. */}
          {(org._count?.rutas ?? 0) > cuposDe(org).rutas && (
            <p className="text-xs text-[var(--cf-red-dark)]">
              Tiene {org._count.rutas} rutas creadas y solo {cuposDe(org).rutas} permitidas: las de más están congeladas, no borradas.
            </p>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--cf-ink-3)]">Regalar rutas extra:</label>
            <input
              type="number"
              min="0"
              max="20"
              value={rutasInput}
              onChange={(e) => setRutasInput(e.target.value)}
              placeholder={String(org.rutasExtra ?? 0)}
              className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]"
            />
            <Button
              size="sm"
              loading={accionando === 'cambiarRutas'}
              onClick={() => {
                const val = rutasInput === '' ? org.rutasExtra ?? 0 : parseInt(rutasInput)
                if (confirm(`¿Cambiar rutas extra de ${org.rutasExtra ?? 0} a ${val} para "${org.nombre}"?`)) {
                  ejecutarAccion('cambiarRutas', { rutasExtra: val })
                  setRutasInput('')
                }
              }}
            >
              Aplicar
            </Button>
          </div>
          {/* Los PAGADOS: van en cada cobro del plan. Aquí se cargan los que
              se piden por WhatsApp (países sin Wompi); en Colombia los compra
              el negocio solo desde «Mi plan». */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--cf-ink-3)]">Rutas adicionales pagadas:</label>
            <input
              type="number"
              min="0"
              max="50"
              value={adicRutasInput}
              onChange={(e) => setAdicRutasInput(e.target.value)}
              placeholder={String(org.rutasAdicionales ?? 0)}
              disabled={!admiteAdicionales(org.plan)}
              className="w-20 h-9 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] disabled:opacity-50"
            />
            <Button
              size="sm"
              disabled={!admiteAdicionales(org.plan)}
              loading={accionando === 'cambiarAdicionales'}
              onClick={() => {
                const val = adicRutasInput === '' ? org.rutasAdicionales ?? 0 : parseInt(adicRutasInput)
                if (confirm(`¿Cambiar rutas adicionales PAGADAS de ${org.rutasAdicionales ?? 0} a ${val} para "${org.nombre}"? Van en su próximo cobro.`)) {
                  ejecutarAccion('cambiarAdicionales', { tipo: 'rutas', cantidad: val })
                  setAdicRutasInput('')
                }
              }}
            >
              Aplicar
            </Button>
            {!admiteAdicionales(org.plan) && <span className="text-xs text-[var(--cf-ink-3)]">Su plan no admite adicionales</span>}
          </div>
        </div>
      </Card>

      {/* Usuarios de la organización */}
      <Card>
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">
          Usuarios ({(org.users ?? []).length})
        </p>
        <div className="space-y-3">
          {(org.users ?? []).map((u) => (
            <div key={u.id} className="rounded-[12px] border border-[var(--cf-border)] p-3.5 bg-[var(--cf-surface)]">
              {/* Fila 1: Info del usuario */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--cf-ink)]">{u.nombre}</p>
                  <p className="text-xs text-[var(--cf-ink-3)] truncate mt-0.5">{u.email}</p>
                  {u.lastLoginAt && (
                    <p className="text-[10px] text-[var(--cf-ink-3)] mt-1">
                      Último login: {new Date(u.lastLoginAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {!u.lastLoginAt && (
                    <p className="text-[10px] text-[#555] mt-1">Nunca ha iniciado sesión</p>
                  )}
                </div>
                <Badge variant={u.rol === 'owner' ? 'blue' : 'gray'}>
                  {{ owner: 'Admin', cobrador: 'Cobrador' }[u.rol] ?? u.rol}
                </Badge>
              </div>

              {/* Fila 2: Badges de estado (clickables) */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => ejecutarAccion('toggleUsuario', { userId: u.id })}
                  disabled={!!accionando}
                  title={u.activo ? 'Click para desactivar usuario' : 'Click para activar usuario'}
                  className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <Badge variant={u.activo ? 'green' : 'red'}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </button>

                <button
                  onClick={() => {
                    const accionLabel = u.emailVerificado ? 'desverificar' : 'verificar'
                    if (!confirm(`¿${u.emailVerificado ? 'Desverificar' : 'Verificar'} el email de ${u.nombre} (${u.email})?`)) return
                    ejecutarAccion('verificarEmail', { userId: u.id })
                  }}
                  disabled={!!accionando}
                  title={u.emailVerificado ? 'Email verificado — click para desverificar' : 'Email NO verificado — click para verificar'}
                  className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <Badge variant={u.emailVerificado ? 'green' : 'yellow'}>
                    {u.emailVerificado ? 'Email verificado' : 'Email sin verificar'}
                  </Badge>
                </button>
              </div>

              {/* Fila 3: Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const nueva = prompt(`Nueva contraseña para ${u.nombre} (${u.email}):\n\nMinimo 6 caracteres.`)
                    if (nueva == null) return
                    const clean = nueva.trim()
                    if (clean.length < 6) {
                      alert('La contraseña debe tener al menos 6 caracteres')
                      return
                    }
                    if (!confirm(`¿Restablecer la contraseña de ${u.nombre}?`)) return
                    ejecutarAccion('resetearPassword', { userId: u.id, nuevaPassword: clean })
                  }}
                  disabled={!!accionando}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-[var(--cf-gold)] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)] hover:bg-[rgba(245,197,24,0.15)] transition-all disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Cambiar contraseña
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Historial de acciones admin */}
      {org.adminLogs?.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Historial de acciones</p>
          <div className="space-y-2">
            {org.adminLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[var(--cf-border)] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--cf-gold)] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--cf-ink)]">{log.detalle ?? log.accion}</p>
                  <p className="text-[10px] text-[var(--cf-ink-3)]">
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
