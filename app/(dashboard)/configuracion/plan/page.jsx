'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'
import { formatMoney, getPaymentGateway } from '@/lib/i18n'

const planesBase = [
  { key: 'starter',      nombre: 'Inicial',      features: ['1 usuario', 'Hasta 150 clientes', '1 ruta', 'Dashboard básico'] },
  { key: 'basic',        nombre: 'Basico',        features: ['1 usuario', 'Hasta 450 clientes', '1 ruta', 'Control de cartera'] },
  { key: 'growth',       nombre: 'Crecimiento',  badge: 'Popular', features: ['2 usuarios', 'Hasta 1,000 clientes', '3 rutas', 'Lucas IA (20/día)', 'Cierre de caja'] },
  { key: 'standard',     nombre: 'Profesional',  features: ['5 usuarios', 'Hasta 2,000 clientes', '6 rutas', 'Lucas IA (60/día)', 'Reportes avanzados'] },
  { key: 'professional', nombre: 'Empresarial',  features: ['10 usuarios', 'Hasta 10,000 clientes', '10 rutas', 'Lucas IA (200/día)', 'Reportes + exportación'] },
]

const planTestBase = { key: 'test', nombre: 'Test', features: ['Solo testing interno', 'NO usar en produccion'] }

const WHATSAPP_SOPORTE = '573011993001'
const whatsappLink = (msg) => `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(msg)}`

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

// ── Usage bar ──────────────────────────────────────────────
function UsageBar({ label, usado, limite }) {
  if (!limite || limite <= 0) return null
  const pct = Math.min((usado / limite) * 100, 100)
  const high = pct >= 80

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-3 flex-1 max-w-[200px]">
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: high ? 'var(--color-warning)' : 'var(--color-accent)',
            }}
          />
        </div>
        <span className="text-[12px] font-mono-display font-medium tabular whitespace-nowrap" style={{ color: high ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
          {usado.toLocaleString('es-CO')}
          <span style={{ color: 'var(--color-text-muted)' }}> / {limite.toLocaleString('es-CO')}</span>
        </span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
export default function PlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, loading: authLoading } = useAuth()
  const wompiRetorno = searchParams.get('wompi') === 'retorno'

  const country = session?.user?.country ?? 'co'
  const esSuperadmin = session?.user?.rol === 'superadmin' || session?.user?.email === 'ccaojd@gmail.com'
  const planes = planesBase.map(p => ({ ...p, precio: getPrecioPlan(p.key, country) }))
  const planTest = { ...planTestBase, precio: getPrecioPlan('test', country) }

  const [estado,       setEstado]       = useState(null)
  const [uso,          setUso]          = useState(null)
  const [loadEstado,   setLoadEstado]   = useState(true)
  const [periodo,      setPeriodo]      = useState('mensual')
  const [descuentoOrg, setDescuentoOrg] = useState(0)
  const [showPlanes,   setShowPlanes]   = useState(false)
  const [pagando,      setPagando]      = useState(null)
  const [errorPago,    setErrorPago]    = useState(null)

  const gateway = getPaymentGateway(country)

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      fetch('/api/pagos/estado').then(r => r.ok ? r.json() : null),
      fetch('/api/plan/uso').then(r => r.ok ? r.json() : null),
    ]).then(([est, u]) => {
      if (est) { setEstado(est); setDescuentoOrg(est.descuento ?? 0) }
      if (u) setUso(u)
    }).catch(() => {}).finally(() => setLoadEstado(false))
  }, [authLoading])

  const planActual = uso?.plan ?? estado?.plan ?? session?.user?.plan ?? 'starter'
  const tieneRecurrente = estado?.tieneRecurrenteActiva
  const subCancelada = !!estado?.canceladaAt && estado?.tipo === 'recurrente'
  const infoPlan = [...planes, planTest].find(p => p.key === planActual) || planes[0]
  const orgNombre = session?.user?.nombreOrganizacion || session?.user?.name || ''

  // Next plan up for upgrade CTA
  const planIndex = planes.findIndex(p => p.key === planActual)
  const nextPlan = planIndex >= 0 && planIndex < planes.length - 1 ? planes[planIndex + 1] : null

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : ''

  // ── Calculo de precios (conservado) ──
  const calcularPrecio = (precioBase) => {
    const meses = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1
    const mesesCobrados = periodo === 'anual' ? 10 : meses
    const descuentoPeriodo = periodo === 'anual' ? 17 : periodo === 'trimestral' ? 10 : 0
    const descuentoFinal = Math.max(descuentoOrg, descuentoPeriodo)
    const total = precioBase * meses
    const conDescuento = periodo === 'anual'
      ? precioBase * mesesCobrados
      : Math.round(total * (1 - descuentoFinal / 100))
    const ahorro = total - conDescuento
    return { total, conDescuento, descuentoFinal, meses, ahorro }
  }

  // ── Activar/renovar plan via WhatsApp (MercadoPago desactivado temporalmente) ──
  const activarPlanWA = (planKey) => {
    const info = [...planes, planTest].find(p => p.key === planKey)
    if (!info) return
    const { conDescuento, meses } = calcularPrecio(info.precio)
    const periodoLabel = periodo === 'anual' ? 'anual' : periodo === 'trimestral' ? 'trimestral' : 'mensual'
    const orgRef = orgNombre ? ` para mi cuenta "${orgNombre}"` : ''
    const msg = `Hola, quiero activar el plan ${info.nombre} (${periodoLabel})${orgRef}. Valor: ${formatMoney(conDescuento)}${meses > 1 ? ` por ${meses} meses` : '/mes'}.`
    window.open(whatsappLink(msg), '_blank', 'noopener,noreferrer')
  }

  const cancelarPlanWA = () => {
    const orgRef = orgNombre ? ` de mi cuenta "${orgNombre}"` : ''
    const msg = `Hola, quiero cancelar la suscripcion${orgRef}.`
    window.open(whatsappLink(msg), '_blank', 'noopener,noreferrer')
  }

  const activarPlanOnline = async (planKey) => {
    setPagando(planKey)
    setErrorPago(null)
    try {
      if (gateway === 'wompi') {
        const res = await fetch('/api/pagos/wompi/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey, periodo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error creando pago')

        const form = document.createElement('form')
        form.method = 'GET'
        form.action = data.checkoutUrl
        const fields = {
          'public-key': data.publicKey,
          currency: data.moneda,
          'amount-in-cents': String(data.montoCentavos),
          reference: data.referencia,
          'signature:integrity': data.firma,
          'redirect-url': data.redirectUrl,
        }
        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.appendChild(input)
        }
        document.body.appendChild(form)
        form.submit()
        return
      }

      if (gateway === 'mercadopago') {
        const res = await fetch('/api/pagos/crear-preferencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey, periodo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error creando pago')
        window.location.href = data.initPoint
        return
      }

      activarPlanWA(planKey)
    } catch (err) {
      setErrorPago(err.message)
    } finally {
      setPagando(null)
    }
  }

  // ── Loading state ──
  if (authLoading || loadEstado) {
    return (
      <div className="max-w-lg mx-auto space-y-4 px-4 pt-6">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  const esTrial = estado?.estado !== 'activa' || (!tieneRecurrente && !estado?.mercadopagoId)

  return (
    <div className="max-w-lg mx-auto px-4 pb-12 space-y-5">

      {/* ── Header ── */}
      <div className="pt-2 flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 mt-1 transition-colors"
          style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          aria-label="Volver"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-[25px] font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            Mi <em style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>plan</em>
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {orgNombre}{orgNombre ? ' · ' : ''}{infoPlan.nombre}
          </p>
        </div>
      </div>

      {/* ── Banner trial ── */}
      {estado?.enTrial && (
        <div
          className="rounded-[20px] cf-card-shadow px-5 py-4 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, color-mix(in srgb, var(--color-accent) 4%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
            <svg className="w-4 h-4" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Prueba gratuita · {estado.diasTrial} {estado.diasTrial === 1 ? 'dia' : 'dias'} restantes
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Tienes acceso completo al plan Empresarial. Al terminar la prueba, tu cuenta pasara al plan {PLANES_CONFIG[estado.planAlTerminar]?.nombre || 'Inicial'}.
            </p>
          </div>
        </div>
      )}

      {/* ── Retorno Wompi ── */}
      {wompiRetorno && (
        <div
          className="rounded-[20px] cf-card-shadow px-5 py-4 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, color-mix(in srgb, var(--color-success) 4%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
          }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}>
            <svg className="w-4 h-4" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Pago procesado
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Tu pago se está verificando. El plan se activará automáticamente en unos segundos. Si no se refleja, recarga la página.
            </p>
          </div>
        </div>
      )}

      {/* ── Plan Actual card ── */}
      <div
        className="rounded-[20px] cf-card-shadow p-5 relative overflow-hidden"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Decorative gradient blob */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full" style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 8%, transparent) 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }} />

        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-3 font-mono-display" style={{ color: 'var(--color-accent)' }}>
          Plan actual
        </p>
        <h2 className="text-[32px] font-normal leading-none mb-1 serif" style={{ color: 'var(--color-text-primary)' }}>
          {infoPlan.nombre}
        </h2>
        {(() => {
          const cfg = PLANES_CONFIG[planActual] || PLANES_CONFIG.starter
          const limClientes = uso?.clientes?.limite ?? cfg.maxClientes
          const limUsuarios = uso?.usuarios?.limite ?? cfg.maxUsuarios
          return (
            <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Hasta {limClientes.toLocaleString('es-CO')} clientes · {limUsuarios} {limUsuarios === 1 ? 'usuario' : 'usuarios'}
            </p>
          )
        })()}

        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-bold leading-none font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
            {formatMoney(infoPlan.precio)}
          </span>
          <span className="text-[12px] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>/mes</span>
        </div>
      </div>

      {/* ── Vencimiento con barra de progreso ── */}
      {(() => {
        const dias = estado?.diasRestantes ?? 0
        const fechaVenc = estado?.fechaVencimiento || estado?.proximoCobroAt
        const totalDias = 30 // ciclo mensual
        const diasTranscurridos = Math.max(0, totalDias - dias)
        const pctUsado = Math.min((diasTranscurridos / totalDias) * 100, 100)
        const urgente = dias <= 5
        const barColor = urgente ? 'var(--color-warning)' : 'var(--color-accent)'

        return (
          <div
            className="rounded-[20px] cf-card-shadow p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                {esTrial ? 'Prueba gratuita' : subCancelada ? 'Acceso hasta' : 'Vencimiento'}
              </p>
              {tieneRecurrente && !subCancelada && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}>Renovación automática</span>
              )}
            </div>

            <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {subCancelada
                ? `Cancelada · acceso hasta el ${formatFecha(fechaVenc)}`
                : fechaVenc
                ? `Tu plan ${esTrial ? 'vence' : 'se renueva'} el ${formatFecha(fechaVenc)}`
                : 'Sin fecha de vencimiento'}
            </p>

            {/* Progress bar */}
            <div className="h-[6px] rounded-full overflow-hidden mt-3 mb-2" style={{ background: 'var(--color-bg-hover)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${100 - pctUsado}%`, background: barColor }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono-display font-semibold" style={{ color: urgente ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                {dias} días restantes
              </span>
              <span className="text-[11px] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                de {totalDias} días
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Uso actual ── */}
      {(() => {
        const cfg = PLANES_CONFIG[planActual] || PLANES_CONFIG.starter
        const u = uso || {
          clientes:      { usado: 0, limite: cfg.maxClientes },
          usuarios:      { usado: 0, limite: cfg.maxUsuarios },
          rutas:         { usado: 0, limite: cfg.maxRutas },
          lucasMensajes: { usado: 0, limite: cfg.aiMensajesDia },
        }
        return (
          <div className="rounded-[20px] cf-card-shadow overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] px-4 pt-4 pb-2 font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
              Uso actual
            </p>
            <UsageBar label="Clientes"   usado={u.clientes.usado}      limite={u.clientes.limite} />
            <UsageBar label="Usuarios"   usado={u.usuarios.usado}      limite={u.usuarios.limite} />
            <UsageBar label="Rutas"      usado={u.rutas.usado}         limite={u.rutas.limite} />
            {u.lucasMensajes.limite > 0 && (
              <UsageBar label="Lucas IA (hoy)" usado={u.lucasMensajes.usado} limite={u.lucasMensajes.limite} />
            )}
          </div>
        )
      })()}

      {/* ── Renovar plan actual ── */}
      {!esTrial && !showPlanes && (
        <button
          onClick={() => gateway === 'manual' ? activarPlanWA(planActual) : activarPlanOnline(planActual)}
          disabled={pagando === planActual}
          className="w-full h-12 rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          {pagando === planActual ? (
            <Spinner />
          ) : gateway === 'manual' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          )}
          Renovar mi plan
        </button>
      )}

      {/* ── Cambiar plan / Cancel CTAs ── */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPlanes(v => !v)}
          className="w-full h-10 rounded-[12px] text-[12px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          {showPlanes ? 'Ocultar planes' : 'Cambiar de plan'}
        </button>

        {tieneRecurrente && !subCancelada && (
          <button
            onClick={cancelarPlanWA}
            className="w-full h-10 rounded-[12px] text-[12px] font-medium flex items-center justify-center gap-1 transition-colors"
            style={{ color: 'var(--color-danger)' }}
          >
            Cancelar suscripción
          </button>
        )}
      </div>

      {/* ── Plan selector (expandable) ── */}
      {showPlanes && (
        <div className="space-y-5 pt-2">
          <div className="text-center">
            <h2 className="text-[20px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Cambiar plan
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              El cambio aplica inmediatamente.
            </p>
          </div>

          {/* Period toggle — elige cuanto tiempo activar */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-[12px] p-1 overflow-x-auto" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
              {[
                { key: 'mensual', label: 'Mensual' },
                { key: 'trimestral', label: 'Trimestral', badge: '-10%' },
                { key: 'anual', label: 'Anual', badge: '2 gratis' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className="px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap"
                  style={periodo === p.key
                    ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                    : { color: 'var(--color-text-muted)' }
                  }
                >
                  {p.label}
                  {p.badge && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded-full font-mono-display" style={{
                      background: periodo === p.key ? 'rgba(0,0,0,0.15)' : 'var(--color-success)',
                      color: periodo === p.key ? 'var(--color-accent-text)' : '#fff',
                    }}>{p.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {esSuperadmin && (
            <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted)' }}>
              Modo superadmin — plan test disponible
            </p>
          )}

          {/* Plan cards */}
          <div className="space-y-3">
            {(esSuperadmin ? [planTest, ...planes] : planes).map((p) => {
              const esActual = p.key === planActual
              const esTest = p.key === 'test'
              const esRecurrActiva = tieneRecurrente && esActual && !subCancelada
              const { conDescuento, descuentoFinal, meses, ahorro } = calcularPrecio(p.precio)
              const tieneDesc = descuentoFinal > 0

              return (
                <div
                  key={p.key}
                  className="rounded-[12px] p-4 transition-all"
                  style={{
                    background: esActual ? 'color-mix(in srgb, var(--color-accent) 4%, transparent)' : 'var(--color-bg-card)',
                    border: esActual
                      ? '1.5px solid color-mix(in srgb, var(--color-accent) 40%, transparent)'
                      : esTest
                      ? '1px dashed var(--color-border-hover)'
                      : '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold" style={{ color: esActual ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                        {p.nombre}
                      </span>
                      {p.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>
                          {p.badge}
                        </span>
                      )}
                      {esRecurrActiva && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-success)', color: '#fff' }}>
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {tieneDesc ? (
                        <div>
                          <span className="text-[10px] line-through font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                            {formatMoney(p.precio * meses)}
                          </span>
                          <span className="text-[14px] font-bold font-mono-display ml-1" style={{ color: 'var(--color-text-primary)' }}>
                            {formatMoney(conDescuento)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                          {formatMoney(conDescuento)}
                          <span className="text-[10px] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                            /{meses === 12 ? 'ano' : meses === 3 ? 'trim.' : 'mes'}
                          </span>
                        </span>
                      )}
                      {ahorro > 0 && (
                        <p className="text-[9px] font-mono-display" style={{ color: 'var(--color-success)' }}>
                          Ahorras {formatMoney(ahorro)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
                    {p.features.map((f, i) => (
                      <span key={i} className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {f}
                      </span>
                    ))}
                  </div>

                  {esRecurrActiva ? (
                    <div className="h-9 rounded-[12px] flex items-center justify-center text-[12px] font-semibold" style={{
                      background: 'var(--color-bg-hover)', color: 'var(--color-success)',
                    }}>
                      Plan actual
                    </div>
                  ) : esActual && periodo === 'mensual' && !subCancelada ? (
                    <div className="h-9 rounded-[12px] flex items-center justify-center text-[12px] font-semibold" style={{
                      background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)',
                    }}>
                      Plan actual
                    </div>
                  ) : gateway === 'manual' ? (
                    <button
                      onClick={() => activarPlanWA(p.key)}
                      className="w-full h-9 rounded-[12px] text-[12px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                      style={{ background: '#25D366', color: '#fff' }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      {subCancelada && esActual ? 'Renovar' : 'Activar por WhatsApp'}
                    </button>
                  ) : (
                    <button
                      onClick={() => activarPlanOnline(p.key)}
                      disabled={pagando === p.key}
                      className="w-full h-9 rounded-[12px] text-[12px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-60"
                      style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                    >
                      {pagando === p.key ? (
                        <Spinner />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                      {subCancelada && esActual ? 'Renovar plan' : 'Pagar'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      )}

      {errorPago && (
        <div className="rounded-[12px] px-4 py-3 text-[12px] font-medium" style={{
          background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
          color: 'var(--color-danger)',
        }}>
          {errorPago}
        </div>
      )}

      {/* ── Support ── */}
      <div className="rounded-[20px] cf-card-shadow p-4 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Necesitas ayuda?</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Te ayudamos por WhatsApp con pagos y planes.</p>
        </div>
        <a
          href={whatsappLink('Hola, necesito ayuda con el pago de mi plan en Control Finanzas.')}
          target="_blank" rel="noopener noreferrer"
          className="shrink-0 h-9 px-3 rounded-[12px] flex items-center gap-1.5 text-[12px] font-semibold transition-all"
          style={{ background: '#25D366', color: '#fff' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Soporte
        </a>
      </div>
    </div>
  )
}
