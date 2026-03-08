'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

const pasos = [
  {
    icon: '🏦',
    titulo: 'Bienvenido a Control Finanzas',
    descripcion:
      'Tu plataforma para gestionar préstamos, clientes, cobros y rutas. Todo en un solo lugar, desde cualquier dispositivo.',
    accion: null,
  },
  {
    icon: '👤',
    titulo: 'Registra tu primer cliente',
    descripcion:
      'Agrega clientes con su nombre, cédula, teléfono y dirección. Asígnalos a una ruta para organizar tus cobros.',
    accion: { label: 'Nuevo Cliente', href: '/clientes/nuevo' },
  },
  {
    icon: '💰',
    titulo: 'Crea tu primer préstamo',
    descripcion:
      'Define el monto, tasa de interés, plazo y frecuencia de pago. El sistema calcula automáticamente las cuotas.',
    accion: { label: 'Crear Préstamo', href: '/prestamos/nuevo' },
  },
  {
    icon: '🗺️',
    titulo: 'Organiza tu equipo',
    descripcion:
      'Crea rutas de cobro y asigna cobradores. Cada cobrador ve solo sus clientes y puede registrar pagos desde su celular.',
    accion: { label: 'Ver Rutas', href: '/rutas' },
  },
  {
    icon: '🎁',
    titulo: 'Invita y gana',
    descripcion:
      'Comparte tu link de referido. Por cada persona que se registre con tu código, recibes 1 mes gratis en tu suscripción.',
    accion: { label: 'Ver mi link', href: '/configuracion?tab=referidos' },
  },
]

const TOTAL = pasos.length

async function marcarCompletado() {
  try {
    await fetch('/api/configuracion/onboarding', { method: 'PATCH' })
  } catch {
    // silenciar error de red; el onboarding no debe bloquear al usuario
  }
}

export default function Onboarding({ onComplete }) {
  const [paso, setPaso] = useState(0)
  const [saliendo, setSaliendo] = useState(false)
  const router = useRouter()

  const actual = pasos[paso]
  const esUltimo = paso === TOTAL - 1

  async function handleFinalizar() {
    setSaliendo(true)
    await marcarCompletado()
    onComplete?.()
  }

  async function handleOmitir() {
    setSaliendo(true)
    await marcarCompletado()
    onComplete?.()
  }

  function handleSiguiente() {
    if (esUltimo) {
      handleFinalizar()
    } else {
      setPaso((p) => p + 1)
    }
  }

  function handleAccion() {
    // Navegar sin cerrar el onboarding — el usuario puede seguir después
    router.push(actual.accion.href)
    handleFinalizar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="onboarding-titulo"
    >
      <div
        className="relative w-full max-w-md flex flex-col"
        style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '24px',
          padding: '32px',
          minHeight: '420px',
        }}
      >
        {/* Puntos de progreso */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {pasos.map((_, i) => (
            <button
              key={i}
              onClick={() => setPaso(i)}
              aria-label={`Ir al paso ${i + 1}`}
              style={{
                width: i === paso ? '24px' : '8px',
                height: '8px',
                borderRadius: '99px',
                background: i === paso ? '#f5c518' : '#2a2a2a',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Icono del paso */}
        <div className="flex justify-center mb-5">
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(245,197,24,0.1)',
              border: '1px solid rgba(245,197,24,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              lineHeight: 1,
            }}
          >
            {actual.icon}
          </div>
        </div>

        {/* Texto */}
        <div className="flex-1 text-center mb-6">
          <h2
            id="onboarding-titulo"
            className="text-xl font-bold text-white mb-3 leading-snug"
          >
            {actual.titulo}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#888888' }}>
            {actual.descripcion}
          </p>
        </div>

        {/* Botón de acción secundario (opcional) */}
        {actual.accion && (
          <button
            onClick={handleAccion}
            className="w-full mb-3 text-sm font-medium rounded-[12px] border transition-all duration-200"
            style={{
              height: '44px',
              background: 'transparent',
              borderColor: '#2a2a2a',
              color: '#f5c518',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f5c518'
              e.currentTarget.style.background = 'rgba(245,197,24,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {actual.accion.label} →
          </button>
        )}

        {/* Botones principales */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={handleOmitir}
            disabled={saliendo}
            className="flex-1"
            style={{ color: '#555555' }}
          >
            Omitir
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleSiguiente}
            loading={saliendo && esUltimo}
            disabled={saliendo}
            className="flex-1"
          >
            {esUltimo ? 'Finalizar' : 'Siguiente'}
          </Button>
        </div>

        {/* Contador de pasos */}
        <p
          className="text-center mt-4 text-[11px]"
          style={{ color: '#555555' }}
        >
          {paso + 1} de {TOTAL}
        </p>
      </div>
    </div>
  )
}
