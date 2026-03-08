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

const planTest = {
  key: 'test',
  nombre: 'Test ($1.500)',
  precio: 1500,
  badge: '🧪 Solo pruebas',
  features: [
    'Solo para testing interno',
    'NO usar en producción',
    'Activa 30 días',
  ],
}

export default function PlanPage() {
  const { session, loading: authLoading } = useAuth()
  const esSuperadmin = session?.user?.rol === 'superadmin'

  const [estado,     setEstado]     = useState(null)
  const [cargando,   setCargando]   = useState('')
  const [loadEstado, setLoadEstado] = useState(true)
  const [periodo,    setPeriodo]    = useState('mensual')
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

  // Plan actual desde la API (DB real), no del JWT
  const planActual = estado?.plan ?? session?.user?.plan ?? 'basic'
  const todosPlanes = [planTest, ...planes]

  const calcularPrecio = (precioBase) => {
    const meses = periodo === 'trimestral' ? 3 : 1
    const descuentoTrimestral = periodo === 'trimestral' ? 10 : 0
    const descuentoFinal = Math.max(descuentoOrg, descuentoTrimestral)
    const total = precioBase * meses
    const conDescuento = Math.round(total * (1 - descuentoFinal / 100))
    return { total, conDescuento, descuentoFinal, meses }
  }

  const elegirPlan = async (plan) => {
    if (plan === planActual && periodo === 'mensual') return
    setCargando(plan)
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

  if (authLoading || loadEstado) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Elige tu plan</h1>
        <p className="text-sm text-[#555555] mt-1">
          {estado?.estado === 'activa'
            ? `Tu plan actual: ${todosPlanes.find(p => p.key === planActual)?.nombre || planActual}. Cambia cuando quieras.`
            : 'Selecciona el plan que mejor se adapte a tu negocio.'}
        </p>
        {estado?.diasRestantes != null && estado.estado === 'activa' && (
          <p className="text-xs text-[#22c55e] mt-1">
            {estado.diasRestantes} días restantes en tu suscripción
          </p>
        )}
      </div>

      {/* Toggle Mensual / Trimestral */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-1">
          <button
            onClick={() => setPeriodo('mensual')}
            className={[
              'px-4 py-2 rounded-[10px] text-sm font-medium transition-all',
              periodo === 'mensual'
                ? 'bg-[#f5c518] text-[#0a0a0a]'
                : 'text-[#888888] hover:text-white',
            ].join(' ')}
          >
            Mensual
          </button>
          <button
            onClick={() => setPeriodo('trimestral')}
            className={[
              'px-4 py-2 rounded-[10px] text-sm font-medium transition-all flex items-center gap-1.5',
              periodo === 'trimestral'
                ? 'bg-[#f5c518] text-[#0a0a0a]'
                : 'text-[#888888] hover:text-white',
            ].join(' ')}
          >
            Trimestral
            <span className={[
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              periodo === 'trimestral'
                ? 'bg-[#0a0a0a] text-[#f5c518]'
                : 'bg-[#22c55e] text-white',
            ].join(' ')}>
              -10%
            </span>
          </button>
        </div>
      </div>

      {descuentoOrg > 0 && (
        <div className="text-center">
          <Badge variant="green">Descuento especial: {descuentoOrg}%</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[planTest, ...planes].map((p) => {
          const esPlanActual = p.key === planActual && periodo === 'mensual'
          const esPopular    = p.badge === 'Más popular'
          const esTest       = p.key === 'test'
          const { total, conDescuento, descuentoFinal, meses } = calcularPrecio(p.precio)
          const tieneDescuento = descuentoFinal > 0

          return (
            <div
              key={p.key}
              className={[
                'relative bg-[#1a1a1a] border rounded-[16px] p-5 flex flex-col transition-all',
                esPopular
                  ? 'border-[#f5c518] ring-1 ring-[rgba(245,197,24,0.3)] mt-3'
                  : esTest
                  ? 'border-dashed border-[#3a3a3a]'
                  : 'border-[#2a2a2a]',
              ].join(' ')}
            >
              {esPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                  <Badge variant="yellow">Más popular</Badge>
                </div>
              )}

              <div className="mb-4 mt-1">
                <p className="text-sm font-semibold text-white">{p.nombre}</p>
                {esTest && (
                  <p className="text-[10px] text-[#555555] mt-0.5">Solo superadmin · no usar en producción</p>
                )}
                {tieneDescuento ? (
                  <div className="mt-1">
                    <p className="text-sm text-[#555555] line-through">{formatCOP(total)}</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCOP(conDescuento)}
                      <span className="text-xs text-[#555555] font-normal">
                        /{meses === 3 ? '3 meses' : 'mes'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatCOP(p.precio)}
                    <span className="text-xs text-[#555555] font-normal">/mes</span>
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

              <button
                onClick={() => elegirPlan(p.key)}
                disabled={esPlanActual || !!cargando}
                className={[
                  'w-full h-10 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  esPlanActual
                    ? 'bg-[#2a2a2a] text-[#555555] cursor-default'
                    : 'bg-[#f5c518] hover:bg-[#f0b800] text-white cursor-pointer disabled:opacity-60',
                ].join(' ')}
              >
                {cargando === p.key ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Procesando...
                  </>
                ) : esPlanActual ? 'Plan actual' : periodo === 'trimestral' ? 'Pagar trimestre' : 'Elegir plan'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
