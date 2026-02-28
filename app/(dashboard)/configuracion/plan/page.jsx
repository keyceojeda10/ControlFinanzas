'use client'

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planes = [
  {
    key: 'basic',
    nombre: 'Basic',
    precio: 80000,
    badge: null,
    features: [
      '1 usuario',
      'Hasta 50 clientes',
      'Gestión de préstamos',
      'Dashboard básico',
    ],
  },
  {
    key: 'standard',
    nombre: 'Standard',
    precio: 150000,
    badge: 'Más popular',
    features: [
      'Hasta 3 usuarios',
      'Hasta 200 clientes',
      'Rutas y cobradores',
      'Cierre de caja',
      'Todo lo del plan Basic',
    ],
  },
  {
    key: 'professional',
    nombre: 'Professional',
    precio: 250000,
    badge: null,
    features: [
      'Usuarios ilimitados',
      'Clientes ilimitados',
      'Reportes avanzados',
      'Exportar a Excel',
      'Todo lo del plan Standard',
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
      // Redirigir a MercadoPago
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
        <h1 className="text-xl font-bold text-[#f1f5f9]">Elige tu plan</h1>
        <p className="text-sm text-[#64748b] mt-1">
          {estado?.estado === 'activa'
            ? `Tu plan actual: ${planActual}. Cambia cuando quieras.`
            : 'Selecciona el plan que mejor se adapte a tu negocio.'}
        </p>
        {estado?.diasRestantes != null && estado.estado === 'activa' && (
          <p className="text-xs text-[#10b981] mt-1">
            {estado.diasRestantes} días restantes en tu suscripción
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
                'relative bg-[#1c2333] border rounded-[14px] p-5 flex flex-col transition-all',
                esPopular
                  ? 'border-[#3b82f6] ring-1 ring-[rgba(59,130,246,0.3)]'
                  : 'border-[#2a3245]',
              ].join(' ')}
            >
              {esPopular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge variant="blue">Más popular</Badge>
                </div>
              )}

              <div className="mb-4 mt-1">
                <p className="text-sm font-semibold text-[#f1f5f9]">{p.nombre}</p>
                <p className="text-2xl font-bold text-[#f1f5f9] mt-1">
                  {formatCOP(p.precio)}
                  <span className="text-xs text-[#64748b] font-normal">/mes</span>
                </p>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#94a3b8]">
                    <svg className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  'w-full h-10 rounded-[10px] text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  esPlanActual
                    ? 'bg-[#2a3245] text-[#64748b] cursor-default'
                    : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white cursor-pointer disabled:opacity-60',
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
