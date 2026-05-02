'use client'
// components/ui/ModalWhatsAppTemplates.jsx
// Modal selector de plantillas de WhatsApp con preview editable.
// Se abre desde el swipe action o el boton WA del cliente/prestamo.

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  formatearTelefono,
  abrirWhatsApp,
  generarTextoRecordatorio,
  generarTextoFelicitacion,
  generarTextoRenovacion,
  generarTextoVisita,
  generarTextoComprobantePedido,
} from '@/lib/whatsapp'
import { formatCOP } from '@/lib/calculos'

// Definicion de plantillas: filtrables segun estado del prestamo/cliente
const TEMPLATES = [
  {
    id: 'recordatorio',
    label: 'Recordatorio amable',
    desc: 'Para clientes al día',
    icon: '🔔',
    color: '#22c55e',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.diasMora ?? 0) === 0,
    generar: ({ cliente, prestamo }) => generarTextoRecordatorio(cliente, prestamo),
  },
  {
    id: 'mora_suave',
    label: 'Vencimiento cercano',
    desc: 'Aviso suave de pago',
    icon: '⏰',
    color: '#f59e0b',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 0 && (prestamo.diasMora ?? 0) <= 3,
    generar: ({ cliente, prestamo }) => {
      const dias = prestamo.diasMora ?? 0
      return `Hola ${cliente.nombre} 👋

Notamos que tu cuota de ${formatCOP(prestamo.cuotaDiaria || 0)} lleva ${dias} día${dias === 1 ? '' : 's'} pendiente.

¿Podemos pasar hoy a cobrar? También puedes ponerte al día por transferencia.

💰 Saldo pendiente: ${formatCOP(prestamo.saldoPendiente || 0)}

¡Gracias!

_Control Finanzas_ 💼`
    },
  },
  {
    id: 'mora_firme',
    label: 'Aviso de mora',
    desc: 'Cliente atrasado +3 días',
    icon: '⚠️',
    color: '#f97316',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 3 && (prestamo.diasMora ?? 0) <= 15,
    generar: ({ cliente, prestamo }) => {
      const dias = prestamo.diasMora ?? 0
      return `Hola ${cliente.nombre} 👋

⚠️ *Aviso de mora*

Llevamos ${dias} días sin recibir tu pago. Por favor comunícate con nosotros lo antes posible.

📊 *Estado:*
💰 Saldo pendiente: ${formatCOP(prestamo.saldoPendiente || 0)}
📅 Cuota diaria: ${formatCOP(prestamo.cuotaDiaria || 0)}

Estamos disponibles para acordar una solución. No dejes que se acumule más.

_Control Finanzas_ 💼`
    },
  },
  {
    id: 'mora_critica',
    label: 'Mora crítica',
    desc: 'Más de 15 días',
    icon: '🚨',
    color: '#ef4444',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 15,
    generar: ({ cliente, prestamo }) => {
      const dias = prestamo.diasMora ?? 0
      return `${cliente.nombre},

🚨 *Última oportunidad antes de cobro jurídico*

Tu crédito tiene ${dias} días sin pago. Hemos intentado contactarte sin respuesta.

📊 Saldo total pendiente: ${formatCOP(prestamo.saldoPendiente || 0)}

Para evitar acciones legales, comunícate HOY mismo. Aún puedes acordar un plan de pago.

Es la última vez que te escribimos por este medio antes de proceder.

_Control Finanzas_`
    },
  },
  {
    id: 'felicitacion',
    label: 'Felicitación',
    desc: 'Cliente cumplido',
    icon: '🎉',
    color: '#a855f7',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.porcentajePagado ?? 0) >= 50 && (prestamo.diasMora ?? 0) === 0,
    generar: ({ cliente, prestamo }) => generarTextoFelicitacion(cliente, prestamo),
  },
  {
    id: 'renovacion',
    label: 'Ofrecer renovación',
    desc: 'Cerca de terminar',
    icon: '🔄',
    color: '#06b6d4',
    aplica: ({ prestamo }) => prestamo && (prestamo.estado === 'completado' || (prestamo.porcentajePagado ?? 0) >= 80),
    generar: ({ cliente }) => generarTextoRenovacion(cliente),
  },
  {
    id: 'visita',
    label: 'Confirmar visita',
    desc: 'Coordinar cobro hoy',
    icon: '🚶',
    color: '#3b82f6',
    aplica: () => true,
    generar: ({ cliente }) => generarTextoVisita(cliente),
  },
  {
    id: 'comprobante',
    label: 'Pedir comprobante',
    desc: 'Solicitar foto de pago',
    icon: '📸',
    color: '#8b5cf6',
    aplica: () => true,
    generar: ({ cliente }) => generarTextoComprobantePedido(cliente),
  },
  {
    id: 'libre',
    label: 'Mensaje libre',
    desc: 'Escribir desde cero',
    icon: '✏️',
    color: '#94a3b8',
    aplica: () => true,
    generar: ({ cliente }) => `Hola ${cliente.nombre} 👋\n\n`,
  },
]

export default function ModalWhatsAppTemplates({ open, onClose, cliente, prestamo }) {
  const [selectedId, setSelectedId] = useState(null)
  const [textoEditable, setTextoEditable] = useState('')

  const tel = formatearTelefono(cliente?.telefono)

  // Templates aplicables al contexto actual (filtra segun mora, %pagado, etc.)
  const aplicables = useMemo(() => {
    return TEMPLATES.filter(t => {
      try { return t.aplica({ cliente, prestamo }) } catch { return false }
    })
  }, [cliente, prestamo])

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setTextoEditable('')
      return
    }
    // Auto-seleccionar el mas relevante: la primera plantilla aplicable que no sea "libre"
    const sugerido = aplicables.find(t => t.id !== 'libre') || aplicables[0]
    if (sugerido) {
      setSelectedId(sugerido.id)
      try {
        setTextoEditable(sugerido.generar({ cliente, prestamo }))
      } catch {
        setTextoEditable('')
      }
    }
  }, [open, aplicables, cliente, prestamo])

  const handleSelect = (template) => {
    setSelectedId(template.id)
    try {
      setTextoEditable(template.generar({ cliente, prestamo }))
    } catch {
      setTextoEditable('')
    }
  }

  const handleEnviar = () => {
    if (!tel || !textoEditable.trim()) return
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(textoEditable)}`
    abrirWhatsApp(url)
    onClose?.()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enviar WhatsApp a ${cliente?.nombre || 'cliente'}`}
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" onClick={onClose} className="flex-shrink-0">
            Cancelar
          </Button>
          <button
            onClick={handleEnviar}
            disabled={!tel || !textoEditable.trim()}
            className="flex-1 h-10 rounded-[12px] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: '#25D366',
              color: '#fff',
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/>
            </svg>
            Enviar por WhatsApp
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!tel && (
          <div className="rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--color-warning-dim)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
            ⚠️ Este cliente no tiene un teléfono válido registrado.
          </div>
        )}

        {/* Selector de plantillas */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Elige una plantilla
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {aplicables.map(t => {
              const active = selectedId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t)}
                  className="rounded-[10px] px-2.5 py-2 text-left transition-all"
                  style={{
                    background: active ? `color-mix(in srgb, ${t.color} 18%, transparent)` : 'var(--color-bg-card)',
                    border: `1px solid ${active ? t.color : 'var(--color-border)'}`,
                    boxShadow: active ? `0 0 0 1px ${t.color}, 0 4px 12px color-mix(in srgb, ${t.color} 20%, transparent)` : 'none',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[14px]">{t.icon}</span>
                    <span className="text-[11px] font-semibold truncate" style={{ color: active ? t.color : 'var(--color-text-primary)' }}>{t.label}</span>
                  </div>
                  <p className="text-[9px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview editable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Mensaje (puedes editarlo)
            </p>
            <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
              {textoEditable.length} caracteres
            </p>
          </div>
          <textarea
            value={textoEditable}
            onChange={(e) => setTextoEditable(e.target.value)}
            rows={10}
            className="w-full rounded-[10px] px-3 py-2.5 text-[13px] font-mono resize-y focus:outline-none focus:ring-2"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              minHeight: '180px',
            }}
            placeholder="Escribe tu mensaje..."
          />
        </div>
      </div>
    </Modal>
  )
}
