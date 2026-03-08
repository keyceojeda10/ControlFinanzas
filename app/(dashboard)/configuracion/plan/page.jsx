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

export default function PlanPage() {
  const { session, loading: authLoading } = useAuth()
  const planActual = session?.user?.plan ?? 'basic'

  const [estado,     setEstado]     = useState(null)
  const [cargando,   setCargando]   = useState('')
  const [loadEstado, setLoadEstado] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/pagos/estado')
        if (res.ok) setEstado(await res.json())
      } catch { /* ignore */ } finally {
        setLoadEstado(false)
      }
    }
    if (!authLoading) load()
  }, [authLoading])

  const elegirPlan = async (plan) => {
    if (plan === planActual) return
    setCargando(plan)
    try {
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Error al crear el pago')
        return
      }
      window.location.href = data.initPoint
    } catch {
      alert('Error de conexion')
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
            ? `Tu plan actual: ${planes.find(p => p.key === planActual)?.nombre || planActual}. Cambia cuando quieras.`
            : 'Selecciona el plan que mejor se adapte a tu negocio.'}
        </p>
        {estado?.diasRestantes != null && estado.estado === 'activa' && (
          <p className="text-xs text-[#22c55e] mt-1">
            {estado.diasRestantes} dias restantes en tu suscripcion
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {planes.map((p) => {
          const esPlanActual = p.key === planActual
          const esPopular    = p.badge === 'Más popular'

          return (
            <div
              key={p.key}
              className={[
                'relative bg-[#1a1a1a] border rounded-[16px] p-5 flex flex-col transition-all',
                esPopular
                  ? 'border-[#f5c518] ring-1 ring-[rgba(245,197,24,0.3)] mt-3'
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
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCOP(p.precio)}
                  <span className="text-xs text-[#555555] font-normal">/mes</span>
                </p>
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
                ) : esPlanActual ? 'Plan actual' : 'Elegir plan'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
