'use client'

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import { useOnline }           from '@/hooks/useOnline'
import OfflineFallback         from '@/components/offline/OfflineFallback'

const planes = [
  {
    key: 'starter',
    nombre: 'Inicial',
    precio: 39000,
    badge: null,
    features: [
      '1 usuario (administrador)',
      'Hasta 150 clientes',
      '1 ruta',
      'Gestión de préstamos',
      'Dashboard básico',
    ],
  },
  {
    key: 'basic',
    nombre: 'Básico',
    precio: 59000,
    badge: null,
    features: [
      '1 usuario (administrador)',
      'Hasta 450 clientes',
      '1 ruta',
      'Gestión de préstamos',
      'Control más amplio de cartera',
    ],
  },
  {
    key: 'growth',
    nombre: 'Crecimiento',
    precio: 79000,
    badge: 'Más popular',
    features: [
      'Hasta 2 usuarios',
      'Hasta 1,000 clientes',
      'Hasta 3 rutas',
      'Cobradores incluidos',
      'Cierre de caja diario',
      'Cobrador extra: $19.000/mes',
      'Ruta extra: $29.000/mes',
    ],
  },
  {
    key: 'standard',
    nombre: 'Profesional',
    precio: 119000,
    badge: null,
    features: [
      'Hasta 5 usuarios',
      'Hasta 2,000 clientes',
      'Hasta 6 rutas',
      'Reportes completos',
      'Cobrador extra: $19.000/mes',
      'Ruta extra: $29.000/mes',
    ],
  },
  {
    key: 'professional',
    nombre: 'Empresarial',
    precio: 259000,
    badge: null,
    features: [
      'Hasta 10 usuarios',
      'Hasta 10,000 clientes',
      'Hasta 10 rutas',
      'Reportes avanzados',
      'Exportar a Excel',
      'Cobrador extra: $19.000/mes',
      'Ruta extra: $29.000/mes',
      'Todo lo del plan Profesional',
    ],
  },
]

const BeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-1 align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 0 1 .45 2.311l-.987 2.963c-.43 1.292-1.643 2.226-3.063 2.226H7.8c-1.42 0-2.633-.934-3.063-2.226L3.75 17.31A2.25 2.25 0 0 1 4.2 15h15.6Z" />
  </svg>
)

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

const WHATSAPP_SOPORTE = '573011993001'
const whatsappLink = (mensaje) =>
  `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`

const planTest = {
  key: 'test',
  nombre: 'Test ($1.500)',
  precio: 1500,
  badge: 'Solo pruebas',
  badgeIcon: true,
  features: [
    'Solo para testing interno',
    'NO usar en producción',
    'Activa 30 días',
  ],
}

export default function PlanPage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="La gestion de plan requiere conexion" descripcion="Los pagos y cambios de plan necesitan red." volverHref="/configuracion" volverLabel="Volver a Configuracion" />
  return <PlanPageInner />
}

function PlanPageInner() {
  const { session, loading: authLoading } = useAuth()
  const esSuperadmin = session?.user?.rol === 'superadmin'

  const [estado,       setEstado]       = useState(null)
  const [cargando,     setCargando]     = useState('')
  const [loadEstado,   setLoadEstado]   = useState(true)
  const [periodo,      setPeriodo]      = useState('mensual')
  const [modoPago,     setModoPago]     = useState('suscripcion') // 'suscripcion' | 'pago_unico'
  const [descuentoOrg, setDescuentoOrg] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/pagos/estado')
        if (res.ok) {
          const data = await res.json()
          setEstado(data)
          setDescuentoOrg(data.descuento ?? 0)
        }
      } catch { /* ignore */ } finally {
        setLoadEstado(false)
      }
    }
    if (!authLoading) load()
  }, [authLoading])

  const planActual = estado?.plan ?? session?.user?.plan ?? 'starter'
  const tieneRecurrente = estado?.tieneRecurrenteActiva
  const subCancelada = !!estado?.canceladaAt && estado?.tipo === 'recurrente'

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

  // Pago único (flujo existente)
  const elegirPlan = async (plan) => {
    if (plan === planActual && periodo === 'mensual') return
    setCargando(plan + '-unico')
    try {
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, periodo }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Error al crear el pago'
        if (confirm(`${msg}\n\n¿Quieres contactar a soporte por WhatsApp?`)) {
          window.open(whatsappLink(`Hola, tuve un problema al pagar el plan ${plan} (${periodo}). Error: ${msg}`), '_blank')
        }
        return
      }
      window.location.href = data.initPoint
    } catch {
      if (confirm('Error de conexión.\n\n¿Quieres contactar a soporte por WhatsApp?')) {
        window.open(whatsappLink(`Hola, tuve un error de conexión al pagar el plan ${plan}.`), '_blank')
      }
    } finally {
      setCargando('')
    }
  }

  // Suscripción recurrente
  const crearSuscripcion = async (plan) => {
    setCargando(plan + '-sub')
    try {
      const res = await fetch('/api/pagos/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, periodo }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Error al crear la suscripción'
        if (confirm(`${msg}\n\n¿Quieres contactar a soporte por WhatsApp?`)) {
          window.open(whatsappLink(`Hola, tuve un problema al crear la suscripción del plan ${plan}. Error: ${msg}`), '_blank')
        }
        return
      }
      window.location.href = data.initPoint
    } catch {
      if (confirm('Error de conexión.\n\n¿Quieres contactar a soporte por WhatsApp?')) {
        window.open(whatsappLink(`Hola, tuve un error de conexión al crear la suscripción del plan ${plan}.`), '_blank')
      }
    } finally {
      setCargando('')
    }
  }

  // Cancelar suscripción
  const cancelarSuscripcion = async () => {
    if (!confirm('Se cancelarán los cobros automáticos. Mantendrás acceso hasta la fecha de vencimiento.')) return
    setCargando('cancelando')
    try {
      const res = await fetch('/api/pagos/cancelar-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Error al cancelar')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setCargando('')
    }
  }

  if (authLoading || loadEstado) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 px-2 sm:px-4 lg:px-6">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  const formatFecha = (fecha) => {
    if (!fecha) return ''
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-2 sm:px-4 lg:px-6">
      <div className="text-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Elige tu plan</h1>
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-2 max-w-2xl mx-auto">
          {estado?.estado === 'activa'
            ? `Tu plan actual: ${[planTest, ...planes].find(p => p.key === planActual)?.nombre || planActual}. Cambia cuando quieras.`
            : 'Selecciona el plan que mejor se adapte a tu negocio.'}
        </p>
        {estado?.diasRestantes != null && estado.estado === 'activa' && (
          <p className="text-xs sm:text-sm text-[var(--color-success)] mt-2">
            {estado.diasRestantes} días restantes en tu suscripción
            {tieneRecurrente && ' (renovación automática)'}
            {subCancelada && ' (cancelada, no se renovará)'}
          </p>
        )}
        {tieneRecurrente && estado?.proximoCobroAt && !subCancelada && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Próximo cobro: {formatFecha(estado.proximoCobroAt)}
          </p>
        )}
      </div>

      {/* Toggle Suscripción / Pago único */}
      <div className="flex justify-center px-1">
        <div className="inline-flex bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[14px] p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
          <button
            onClick={() => setModoPago('suscripcion')}
            className={[
              'px-4 sm:px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all flex items-center gap-1.5',
              modoPago === 'suscripcion'
                ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            Suscripción
            <span className={[
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              modoPago === 'suscripcion'
                ? 'bg-[var(--color-bg-base)] text-[var(--color-accent)]'
                : 'bg-[var(--color-success)] text-[var(--color-text-primary)]',
            ].join(' ')}>
              Recomendado
            </span>
          </button>
          <button
            onClick={() => setModoPago('pago_unico')}
            className={[
              'px-4 sm:px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all',
              modoPago === 'pago_unico'
                ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            Pago único
          </button>
        </div>
      </div>

      {/* Periodo toggle — solo para pago único */}
      {modoPago === 'pago_unico' && (
        <div className="flex justify-center px-1">
          <div className="inline-flex bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[14px] p-1.5 overflow-x-auto max-w-full">
            {[
              { key: 'mensual',    label: 'Mensual',    badge: null },
              { key: 'trimestral', label: 'Trimestral', badge: '-10%' },
              { key: 'anual',      label: 'Anual',      badge: '2 meses gratis' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={[
                  'px-3 sm:px-4 py-2.5 rounded-[10px] text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
                  periodo === p.key
                    ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                ].join(' ')}
              >
                {p.label}
                {p.badge && (
                  <span className={[
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono-display',
                    periodo === p.key
                      ? 'bg-[var(--color-bg-base)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-success)] text-[var(--color-text-primary)]',
                  ].join(' ')}>
                    {p.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info suscripción */}
      {modoPago === 'suscripcion' && (
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            Se cobra automáticamente cada mes. Puedes cancelar en cualquier momento.
          </p>
        </div>
      )}

      {descuentoOrg > 0 && modoPago === 'pago_unico' && (
        <div className="text-center">
          <Badge variant="green">Descuento especial: {descuentoOrg}%</Badge>
        </div>
      )}

      {esSuperadmin && (
        <div className="border border-dashed border-[var(--color-border-hover)] rounded-[12px] p-3 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">Modo superadmin — plan de prueba disponible</p>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-5 ${esSuperadmin ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6' : 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5'}`}>
        {(esSuperadmin ? [planTest, ...planes] : planes).map((p) => {
          const esPlanActual = p.key === planActual
          const esPopular    = p.badge === 'Más popular'
          const esTest       = p.key === 'test'
          const esRecurrenteActiva = tieneRecurrente && esPlanActual && !subCancelada

          // Para suscripción: precio mensual del plan
          // Para pago único: precio con descuento según periodo
          const esSub = modoPago === 'suscripcion'
          const { total, conDescuento, descuentoFinal, meses, ahorro } = calcularPrecio(p.precio)
          const tieneDescuento = !esSub && descuentoFinal > 0

          const glowColor = esRecurrenteActiva ? 'var(--color-success)' : esPopular ? 'var(--color-success)' : esPlanActual ? 'var(--color-accent)' : esTest ? 'var(--color-info)' : null

          return (
            <div
              key={p.key}
              className={[
                'relative border rounded-[18px] p-6 flex flex-col transition-all min-h-[520px]',
                esRecurrenteActiva
                  ? 'border-[#22c55e] ring-1 ring-[rgba(34,197,94,0.3)]'
                  : esPopular
                  ? 'border-[#f5c518] ring-1 ring-[rgba(245,197,24,0.3)]'
                  : esTest
                  ? 'border-dashed border-[var(--color-border-hover)]'
                  : 'border-[var(--color-border)]',
              ].join(' ')}
              style={glowColor ? {
                background: `linear-gradient(135deg, ${glowColor}0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, ${glowColor}05 100%)`,
                boxShadow: `0 0 30px ${glowColor}08, 0 1px 2px rgba(0,0,0,0.3)`,
              } : { background: 'var(--color-bg-card)' }}
            >
              {esRecurrenteActiva && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-base)] text-[var(--color-success)] border border-[#22c55e]">
                    Suscripción activa
                  </span>
                </div>
              )}
              {!esRecurrenteActiva && esPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-base)] text-[var(--color-accent)] border border-[#f5c518]">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-4 mt-1">
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  {esTest && <BeakerIcon />}
                  {p.nombre}
                </p>
                {esTest && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Solo superadmin · no usar en producción</p>
                )}

                {esSub ? (
                  // Suscripción: precio mensual simple
                  <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-2 leading-none">
                    <span className="font-mono-display">{formatCOP(p.precio)}</span>
                    <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">/mes</span>
                  </p>
                ) : tieneDescuento ? (
                  <div className="mt-2">
                    <p className="text-sm text-[var(--color-text-muted)] line-through font-mono-display">{formatCOP(total)}</p>
                    <p className="text-3xl font-bold text-[var(--color-text-primary)] leading-none">
                      <span className="font-mono-display">{formatCOP(conDescuento)}</span>
                      <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
                        /{meses === 12 ? 'año' : meses === 3 ? '3 meses' : 'mes'}
                      </span>
                    </p>
                    {ahorro > 0 && (
                      <p className="text-[10px] text-[var(--color-success)] font-medium mt-0.5">
                        Ahorras <span className="font-mono-display">{formatCOP(ahorro)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-2 leading-none">
                    <span className="font-mono-display">{formatCOP(esSub ? p.precio : conDescuento)}</span>
                    <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
                      /{esSub ? 'mes' : meses === 12 ? 'año' : meses === 3 ? '3 meses' : 'mes'}
                    </span>
                  </p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm leading-snug text-[var(--color-text-secondary)]">
                    <svg className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Botones según modo y estado */}
              <div className="space-y-2">
                {esRecurrenteActiva ? (
                  // Suscripción activa en este plan
                  <>
                    <div className="w-full h-10 rounded-[12px] bg-[var(--color-bg-hover)] text-[var(--color-success)] text-sm font-semibold flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Plan actual
                    </div>
                    <button
                      onClick={cancelarSuscripcion}
                      disabled={!!cargando}
                      className="w-full h-9 rounded-[10px] text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                      {cargando === 'cancelando' ? <><Spinner /> Cancelando...</> : 'Cancelar suscripción'}
                    </button>
                  </>
                ) : subCancelada && esPlanActual ? (
                  // Suscripción cancelada pero aún activa
                  <>
                    <div className="w-full h-10 rounded-[12px] bg-[var(--color-bg-hover)] text-[var(--color-warning)] text-sm font-semibold flex items-center justify-center text-center px-2">
                      Cancelada — acceso hasta {formatFecha(estado?.fechaVencimiento)}
                    </div>
                    <button
                      onClick={() => esSub ? crearSuscripcion(p.key) : elegirPlan(p.key)}
                      disabled={!!cargando}
                      className="w-full h-9 rounded-[10px] text-xs font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#0a0a0a] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                      {cargando ? <><Spinner /> Procesando...</> : 'Renovar'}
                    </button>
                  </>
                ) : esSub && !esTest ? (
                  // Modo suscripción — botón principal (no disponible para plan test)
                  <button
                    onClick={() => crearSuscripcion(p.key)}
                    disabled={!!cargando}
                    className={[
                      'w-full h-11 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#0a0a0a] cursor-pointer disabled:opacity-60',
                    ].join(' ')}
                  >
                    {cargando === p.key + '-sub' ? (
                      <><Spinner /> Procesando...</>
                    ) : tieneRecurrente ? 'Cambiar a este plan' : 'Suscribirse'}
                  </button>
                ) : (
                  // Modo pago único
                  <button
                    onClick={() => elegirPlan(p.key)}
                    disabled={(esPlanActual && periodo === 'mensual') || !!cargando}
                    className={[
                      'w-full h-11 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      esPlanActual && periodo === 'mensual'
                        ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] cursor-default'
                        : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#0a0a0a] cursor-pointer disabled:opacity-60',
                    ].join(' ')}
                  >
                    {cargando === p.key + '-unico' ? (
                      <><Spinner /> Procesando...</>
                    ) : esPlanActual && periodo === 'mensual'
                      ? 'Plan actual'
                      : periodo === 'anual' ? 'Pagar año' : periodo === 'trimestral' ? 'Pagar trimestre' : 'Pagar mes'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Soporte por WhatsApp */}
      <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            ¿Problemas con el pago o prefieres otro medio?
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Escríbenos por WhatsApp y te ayudamos a activar tu plan (Nequi, transferencia y más).
          </p>
        </div>
        <a
          href={whatsappLink('Hola, necesito ayuda con el pago de mi plan en Control Finanzas.')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[12px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-semibold transition-all whitespace-nowrap"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Contactar soporte
        </a>
      </div>
    </div>
  )
}
