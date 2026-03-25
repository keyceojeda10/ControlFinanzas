'use client'

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planes = [
  {
    key: 'basic',
    nombre: 'Básico',
    precio: 59000,
    badge: null,
    features: [
      '1 usuario (administrador)',
      'Hasta 50 clientes',
      'Gestión de préstamos',
      'Dashboard básico',
    ],
  },
  {
    key: 'standard',
    nombre: 'Profesional',
    precio: 119000,
    badge: 'Más popular',
    features: [
      'Hasta 3 usuarios',
      'Hasta 300 clientes',
      'Rutas y cobradores',
      'Cierre de caja diario',
      'Reportes completos',
      'Cobrador extra: $29.000/mes',
    ],
  },
  {
    key: 'professional',
    nombre: 'Empresarial',
    precio: 199000,
    badge: null,
    features: [
      'Hasta 7 usuarios',
      'Clientes ilimitados',
      'Reportes avanzados',
      'Exportar a Excel',
      'Cobrador extra: $29.000/mes',
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

  const planActual = estado?.plan ?? session?.user?.plan ?? 'basic'
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
        alert(data.error ?? 'Error al crear el pago')
        return
      }
      window.location.href = data.initPoint
    } catch {
      alert('Error de conexión')
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
        alert(data.error ?? 'Error al crear la suscripción')
        return
      }
      window.location.href = data.initPoint
    } catch {
      alert('Error de conexión')
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
      <div className="max-w-3xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  const formatFecha = (fecha) => {
    if (!fecha) return ''
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Elige tu plan</h1>
        <p className="text-sm text-[#555555] mt-1">
          {estado?.estado === 'activa'
            ? `Tu plan actual: ${[planTest, ...planes].find(p => p.key === planActual)?.nombre || planActual}. Cambia cuando quieras.`
            : 'Selecciona el plan que mejor se adapte a tu negocio.'}
        </p>
        {estado?.diasRestantes != null && estado.estado === 'activa' && (
          <p className="text-xs text-[#22c55e] mt-1">
            {estado.diasRestantes} días restantes en tu suscripción
            {tieneRecurrente && ' (renovación automática)'}
            {subCancelada && ' (cancelada, no se renovará)'}
          </p>
        )}
        {tieneRecurrente && estado?.proximoCobroAt && !subCancelada && (
          <p className="text-[10px] text-[#888888] mt-0.5">
            Próximo cobro: {formatFecha(estado.proximoCobroAt)}
          </p>
        )}
      </div>

      {/* Toggle Suscripción / Pago único */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-1">
          <button
            onClick={() => setModoPago('suscripcion')}
            className={[
              'px-4 py-2 rounded-[10px] text-sm font-medium transition-all flex items-center gap-1.5',
              modoPago === 'suscripcion'
                ? 'bg-[#f5c518] text-[#0a0a0a]'
                : 'text-[#888888] hover:text-white',
            ].join(' ')}
          >
            Suscripción
            <span className={[
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              modoPago === 'suscripcion'
                ? 'bg-[#0a0a0a] text-[#f5c518]'
                : 'bg-[#22c55e] text-white',
            ].join(' ')}>
              Recomendado
            </span>
          </button>
          <button
            onClick={() => setModoPago('pago_unico')}
            className={[
              'px-4 py-2 rounded-[10px] text-sm font-medium transition-all',
              modoPago === 'pago_unico'
                ? 'bg-[#f5c518] text-[#0a0a0a]'
                : 'text-[#888888] hover:text-white',
            ].join(' ')}
          >
            Pago único
          </button>
        </div>
      </div>

      {/* Periodo toggle — solo para pago único */}
      {modoPago === 'pago_unico' && (
        <div className="flex justify-center">
          <div className="inline-flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-1">
            {[
              { key: 'mensual',    label: 'Mensual',    badge: null },
              { key: 'trimestral', label: 'Trimestral', badge: '-10%' },
              { key: 'anual',      label: 'Anual',      badge: '2 meses gratis' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={[
                  'px-3 sm:px-4 py-2 rounded-[10px] text-sm font-medium transition-all flex items-center gap-1.5',
                  periodo === p.key
                    ? 'bg-[#f5c518] text-[#0a0a0a]'
                    : 'text-[#888888] hover:text-white',
                ].join(' ')}
              >
                {p.label}
                {p.badge && (
                  <span className={[
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono-display',
                    periodo === p.key
                      ? 'bg-[#0a0a0a] text-[#f5c518]'
                      : 'bg-[#22c55e] text-white',
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
          <p className="text-xs text-[#888888]">
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
        <div className="border border-dashed border-[#3a3a3a] rounded-[12px] p-3 text-center">
          <p className="text-xs text-[#555555]">Modo superadmin — plan de prueba disponible</p>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${esSuperadmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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

          const glowColor = esRecurrenteActiva ? '#22c55e' : esPopular ? '#22c55e' : esPlanActual ? '#f5c518' : esTest ? '#06b6d4' : null

          return (
            <div
              key={p.key}
              className={[
                'relative border rounded-[16px] p-5 flex flex-col transition-all',
                esRecurrenteActiva
                  ? 'border-[#22c55e] ring-1 ring-[rgba(34,197,94,0.3)]'
                  : esPopular
                  ? 'border-[#f5c518] ring-1 ring-[rgba(245,197,24,0.3)] mt-3'
                  : esTest
                  ? 'border-dashed border-[#3a3a3a]'
                  : 'border-[#2a2a2a]',
              ].join(' ')}
              style={glowColor ? {
                background: `linear-gradient(135deg, ${glowColor}0A 0%, #1a1a1a 40%, #1a1a1a 70%, ${glowColor}05 100%)`,
                boxShadow: `0 0 30px ${glowColor}08, 0 1px 2px rgba(0,0,0,0.3)`,
              } : { background: '#1a1a1a' }}
            >
              {esRecurrenteActiva && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0a0a0a] text-[#22c55e] border border-[#22c55e]">
                    Suscripción activa
                  </span>
                </div>
              )}
              {!esRecurrenteActiva && esPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#0a0a0a] text-[#f5c518] border border-[#f5c518]">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-4 mt-1">
                <p className="text-sm font-semibold text-white">
                  {esTest && <BeakerIcon />}
                  {p.nombre}
                </p>
                {esTest && (
                  <p className="text-[10px] text-[#555555] mt-0.5">Solo superadmin · no usar en producción</p>
                )}

                {esSub ? (
                  // Suscripción: precio mensual simple
                  <p className="text-2xl font-bold text-white mt-1">
                    <span className="font-mono-display">{formatCOP(p.precio)}</span>
                    <span className="text-xs text-[#555555] font-normal">/mes</span>
                  </p>
                ) : tieneDescuento ? (
                  <div className="mt-1">
                    <p className="text-sm text-[#555555] line-through font-mono-display">{formatCOP(total)}</p>
                    <p className="text-2xl font-bold text-white">
                      <span className="font-mono-display">{formatCOP(conDescuento)}</span>
                      <span className="text-xs text-[#555555] font-normal">
                        /{meses === 12 ? 'año' : meses === 3 ? '3 meses' : 'mes'}
                      </span>
                    </p>
                    {ahorro > 0 && (
                      <p className="text-[10px] text-[#22c55e] font-medium mt-0.5">
                        Ahorras <span className="font-mono-display">{formatCOP(ahorro)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">
                    <span className="font-mono-display">{formatCOP(esSub ? p.precio : conDescuento)}</span>
                    <span className="text-xs text-[#555555] font-normal">
                      /{esSub ? 'mes' : meses === 12 ? 'año' : meses === 3 ? '3 meses' : 'mes'}
                    </span>
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#888888]">
                    <svg className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="w-full h-10 rounded-[12px] bg-[#2a2a2a] text-[#22c55e] text-sm font-semibold flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Plan actual
                    </div>
                    <button
                      onClick={cancelarSuscripcion}
                      disabled={!!cargando}
                      className="w-full h-8 rounded-[10px] text-xs font-medium text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                      {cargando === 'cancelando' ? <><Spinner /> Cancelando...</> : 'Cancelar suscripción'}
                    </button>
                  </>
                ) : subCancelada && esPlanActual ? (
                  // Suscripción cancelada pero aún activa
                  <>
                    <div className="w-full h-10 rounded-[12px] bg-[#2a2a2a] text-[#f59e0b] text-sm font-semibold flex items-center justify-center text-center px-2">
                      Cancelada — acceso hasta {formatFecha(estado?.fechaVencimiento)}
                    </div>
                    <button
                      onClick={() => esSub ? crearSuscripcion(p.key) : elegirPlan(p.key)}
                      disabled={!!cargando}
                      className="w-full h-8 rounded-[10px] text-xs font-medium bg-[#f5c518] hover:bg-[#f0b800] text-[#0a0a0a] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1"
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
                      'w-full h-10 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      'bg-[#f5c518] hover:bg-[#f0b800] text-[#0a0a0a] cursor-pointer disabled:opacity-60',
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
                      'w-full h-10 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                      esPlanActual && periodo === 'mensual'
                        ? 'bg-[#2a2a2a] text-[#555555] cursor-default'
                        : 'bg-[#f5c518] hover:bg-[#f0b800] text-[#0a0a0a] cursor-pointer disabled:opacity-60',
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
    </div>
  )
}
