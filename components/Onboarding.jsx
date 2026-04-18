'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export const LS_KEY = 'cf_onboarding_done'

const PASOS = [
  {
    step: 0,
    titulo: '¡Bienvenido a Control Finanzas!',
    descripcion: 'Te vamos a guiar paso a paso para configurar tu negocio. Toma menos de 3 minutos.',
    accion: { label: 'Empezar', href: '/clientes/nuevo' },
    paginas: ['/dashboard'],
  },
  {
    step: 1,
    titulo: 'Paso 1 de 4 — Crea tu primer cliente',
    descripcion: 'Llena los datos de tu primer cliente: nombre, cédula, teléfono y dirección. Luego guárdalo.',
    accion: null,
    paginas: ['/clientes/nuevo', '/clientes'],
  },
  {
    step: 2,
    titulo: 'Paso 2 de 4 — Crea tu primer préstamo',
    descripcion: 'Define el monto, tasa, plazo y frecuencia. El sistema calcula las cuotas automáticamente.',
    accion: { label: 'Crear préstamo', href: '/prestamos/nuevo' },
    paginas: ['/clientes', '/prestamos/nuevo', '/prestamos'],
  },
  {
    step: 3,
    titulo: 'Paso 3 de 4 — Tu panel principal',
    descripcion: 'Aquí ves el resumen en tiempo real: cartera, cobros del día, clientes en mora. Todo actualizado.',
    accion: { label: 'Siguiente', href: null },
    paginas: ['/dashboard'],
  },
  {
    step: 4,
    titulo: 'Paso 4 de 4 — Explora más funciones',
    descripcion: 'Crea rutas de cobro, agrega cobradores, envía recibos por WhatsApp. Revisa los Tutoriales en el menú.',
    accion: { label: '¡Listo, ya entendí!', href: null },
    paginas: ['/dashboard'],
  },
]

async function guardarPaso(step) {
  try {
    await fetch('/api/configuracion/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    })
  } catch {}
}

export default function Onboarding({ userId, initialStep = 0, totalClientes = 0, totalPrestamos = 0 }) {
  const router = useRouter()
  const pathname = usePathname()
  const [paso, setPaso] = useState(initialStep)
  const [visible, setVisible] = useState(true)

  // Auto-advance based on user actions
  useEffect(() => {
    if (paso === 1 && totalClientes > 0) {
      setPaso(2)
      guardarPaso(2)
    } else if (paso === 2 && totalPrestamos > 0) {
      setPaso(3)
      guardarPaso(3)
      router.push('/dashboard')
    }
  }, [totalClientes, totalPrestamos, paso, router])

  const actual = PASOS.find(p => p.step === paso) || PASOS[0]

  const handleOmitir = () => {
    if (userId) localStorage.setItem(`${LS_KEY}_${userId}`, '1')
    guardarPaso(99)
    setVisible(false)
  }

  const handleAccion = () => {
    if (paso === 3) {
      // "Siguiente" → go to step 4
      setPaso(4)
      guardarPaso(4)
    } else if (paso === 4) {
      // "¡Listo!" → complete
      handleOmitir()
    } else if (actual.accion?.href) {
      const nextStep = paso + 1
      setPaso(nextStep)
      guardarPaso(nextStep)
      router.push(actual.accion.href)
    }
  }

  if (!visible) return null
  if (paso >= 99) return null

  const progreso = Math.min(paso, 4)

  return (
    <div className="w-full bg-gradient-to-r from-[rgba(245,197,24,0.12)] to-[rgba(245,197,24,0.04)] border border-[rgba(245,197,24,0.2)] rounded-[14px] px-4 py-3 mb-4">
      {/* Progress bar */}
      <div className="flex items-center gap-1.5 mb-2">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= progreso ? 'var(--color-accent)' : 'rgba(245,197,24,0.15)',
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--color-accent)] mb-0.5">{actual.titulo}</p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{actual.descripcion}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOmitir}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] transition-colors whitespace-nowrap"
          >
            Omitir guía
          </button>
          {actual.accion && (
            <Button size="sm" onClick={handleAccion}>
              {actual.accion.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
