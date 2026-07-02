'use client'
// components/ui/ModalWhatsAppTemplates.jsx
// Modal selector de plantillas de WhatsApp con preview editable.
// Se abre desde el swipe action o el boton WA del cliente/prestamo.

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import {
  formatearTelefono,
  abrirWhatsApp,
  generarTextoPrestamo,
  generarTextoRecordatorio,
  generarTextoFelicitacion,
  generarTextoRenovacion,
  generarTextoVisita,
  generarTextoComprobantePedido,
  generarCronogramaCobros,
} from '@/lib/whatsapp'

function firma(orgNombre) {
  return orgNombre ? `_${orgNombre}_` : '_Control Finanzas_'
}

// Definicion de plantillas: filtrables segun estado del prestamo/cliente
const TEMPLATES = [
  {
    id: 'credito_aprobado',
    label: 'Crédito aprobado',
    desc: 'Datos del nuevo crédito',
    icon: '✅',
    color: '#10b981',
    aplica: ({ prestamo }) => !!prestamo,
    generar: ({ cliente, prestamo, orgNombre, cronograma }) =>
      generarTextoPrestamo(cliente, prestamo, { orgNombre, cronograma }),
  },
  {
    id: 'recordatorio',
    label: 'Recordatorio amable',
    desc: 'Para clientes al día',
    icon: '🔔',
    color: '#22c55e',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.diasMora ?? 0) === 0,
    generar: ({ cliente, prestamo, orgNombre, ocultarSaldo }) => generarTextoRecordatorio(cliente, prestamo, { orgNombre, ocultarSaldo }),
  },
  {
    id: 'mora_suave',
    label: 'Vencimiento cercano',
    desc: 'Aviso suave de pago',
    icon: '⏰',
    color: '#f59e0b',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 0 && (prestamo.diasMora ?? 0) <= 3,
    generar: ({ cliente, prestamo, orgNombre, ocultarSaldo }) => {
      const dias = prestamo.diasMora ?? 0
      const saldoLine = ocultarSaldo ? '' : `\n💰 Saldo pendiente: ${formatMoney(prestamo.saldoPendiente || 0)}\n`
      return `Hola ${cliente.nombre} 👋

Notamos que tu cuota de ${formatMoney(prestamo.cuotaDiaria || 0)} lleva ${dias} día${dias === 1 ? '' : 's'} pendiente.

¿Podemos pasar hoy a cobrar? También puedes ponerte al día por transferencia.
${saldoLine}
¡Gracias!

${firma(orgNombre)} 💼`
    },
  },
  {
    id: 'mora_firme',
    label: 'Aviso de mora',
    desc: 'Cliente atrasado +3 días',
    icon: '⚠️',
    color: '#f97316',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 3 && (prestamo.diasMora ?? 0) <= 15,
    generar: ({ cliente, prestamo, orgNombre, ocultarSaldo }) => {
      const dias = prestamo.diasMora ?? 0
      const estadoLines = []
      if (!ocultarSaldo) estadoLines.push(`💰 Saldo pendiente: ${formatMoney(prestamo.saldoPendiente || 0)}`)
      estadoLines.push(`📅 Cuota diaria: ${formatMoney(prestamo.cuotaDiaria || 0)}`)
      return `Hola ${cliente.nombre} 👋

⚠️ *Aviso de mora*

Llevamos ${dias} días sin recibir tu pago. Por favor comunícate con nosotros lo antes posible.

📊 *Estado:*
${estadoLines.join('\n')}

Estamos disponibles para acordar una solución. No dejes que se acumule más.

${firma(orgNombre)} 💼`
    },
  },
  {
    id: 'mora_critica',
    label: 'Mora crítica',
    desc: 'Más de 15 días',
    icon: '🚨',
    color: '#ef4444',
    aplica: ({ prestamo }) => prestamo && (prestamo.diasMora ?? 0) > 15,
    generar: ({ cliente, prestamo, orgNombre, ocultarSaldo }) => {
      const dias = prestamo.diasMora ?? 0
      const saldoLine = ocultarSaldo ? '' : `\n📊 Saldo total pendiente: ${formatMoney(prestamo.saldoPendiente || 0)}\n`
      return `${cliente.nombre},

🚨 *Última oportunidad antes de cobro jurídico*

Tu crédito tiene ${dias} días sin pago. Hemos intentado contactarte sin respuesta.
${saldoLine}
Para evitar acciones legales, comunícate HOY mismo. Aún puedes acordar un plan de pago.

Es la última vez que te escribimos por este medio antes de proceder.

${firma(orgNombre)}`
    },
  },
  {
    id: 'felicitacion',
    label: 'Felicitación',
    desc: 'Cliente cumplido',
    icon: '🎉',
    color: '#a855f7',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo' && (prestamo.porcentajePagado ?? 0) >= 50 && (prestamo.diasMora ?? 0) === 0,
    generar: ({ cliente, prestamo, orgNombre }) => generarTextoFelicitacion(cliente, prestamo, { orgNombre }),
  },
  {
    id: 'renovacion',
    label: 'Ofrecer renovación',
    desc: 'Cerca de terminar',
    icon: '🔄',
    color: '#06b6d4',
    aplica: ({ prestamo }) => prestamo && (prestamo.estado === 'completado' || (prestamo.porcentajePagado ?? 0) >= 80),
    generar: ({ cliente, orgNombre }) => generarTextoRenovacion(cliente, { orgNombre }),
  },
  {
    id: 'gracias_corto',
    label: 'Gracias por tu pago',
    desc: 'Confirmacion corta sin saldo',
    icon: '👍',
    color: '#22c55e',
    aplica: ({ prestamo }) => prestamo && prestamo.estado === 'activo',
    generar: ({ cliente, prestamo, orgNombre }) => {
      const ultimoPago = prestamo?.pagos?.length > 0
        ? prestamo.pagos.reduce((a, b) => new Date(a.fechaPago) > new Date(b.fechaPago) ? a : b)
        : null
      const monto = ultimoPago?.montoPagado || prestamo?.cuotaDiaria || 0
      return `Hola ${cliente.nombre} 👋

✅ Tu pago de ${formatMoney(monto)} fue registrado correctamente.

¡Gracias por tu puntualidad!

${firma(orgNombre)} 💼`
    },
  },
  {
    id: 'oferta_credito',
    label: 'Oferta de credito',
    desc: 'Cliente sin prestamo activo',
    icon: '💰',
    color: '#10b981',
    aplica: ({ prestamo }) => !prestamo || prestamo.estado === 'completado',
    generar: ({ cliente, orgNombre }) => `Hola ${cliente.nombre} 👋

Tenemos credito disponible para ti con aprobacion inmediata.

Si necesitas financiamiento, escribenos por aqui y te explicamos las condiciones. Sin compromiso.

${firma(orgNombre)} 💼`,
  },
  {
    id: 'visita',
    label: 'Confirmar visita',
    desc: 'Coordinar cobro hoy',
    icon: '🚶',
    color: '#3b82f6',
    aplica: () => true,
    generar: ({ cliente, orgNombre }) => generarTextoVisita(cliente, { orgNombre }),
  },
  {
    id: 'comprobante',
    label: 'Pedir comprobante',
    desc: 'Solicitar foto de pago',
    icon: '📸',
    color: '#8b5cf6',
    aplica: () => true,
    generar: ({ cliente, orgNombre }) => generarTextoComprobantePedido(cliente, { orgNombre }),
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

export default function ModalWhatsAppTemplates({ open, onClose, cliente, prestamo, orgNombre, ocultarSaldo }) {
  const [selectedId, setSelectedId] = useState(null)
  const [textoEditable, setTextoEditable] = useState('')
  const [incluirCronograma, setIncluirCronograma] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const tel = formatearTelefono(cliente?.telefono)

  const tieneCronograma = useMemo(() => {
    return !!generarCronogramaCobros(prestamo)
  }, [prestamo])

  // Templates aplicables al contexto actual (filtra segun mora, %pagado, etc.)
  const aplicables = useMemo(() => {
    return TEMPLATES.filter(t => {
      try { return t.aplica({ cliente, prestamo }) } catch { return false }
    })
  }, [cliente, prestamo])

  const generarTexto = (template, conCronograma) => {
    try {
      return template.generar({
        cliente,
        prestamo,
        orgNombre,
        ocultarSaldo,
        cronograma: conCronograma,
      })
    } catch {
      return ''
    }
  }

  // Reset solo al ABRIR el modal (open pasa de false a true).
  // No incluir aplicables/cliente/prestamo/orgNombre como deps:
  // eso regeneraba el texto en cada render del padre y pisaba
  // las ediciones del usuario y el toggle de cronograma.
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setTextoEditable('')
      setIncluirCronograma(false)
      setCopiado(false)
      return
    }
    const sugerido = aplicables.find(t => t.id !== 'libre') || aplicables[0]
    if (sugerido) {
      setSelectedId(sugerido.id)
      setTextoEditable(generarTexto(sugerido, false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSelect = (template) => {
    setSelectedId(template.id)
    const usarCrono = template.id === 'credito_aprobado' && incluirCronograma
    setTextoEditable(generarTexto(template, usarCrono))
  }

  const handleToggleCronograma = () => {
    const next = !incluirCronograma
    setIncluirCronograma(next)
    const template = TEMPLATES.find(t => t.id === selectedId)
    if (template) {
      setTextoEditable(generarTexto(template, next))
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
            Este cliente no tiene un teléfono válido registrado.
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

        {/* Toggle: cronograma de cobros (solo para credito aprobado) */}
        {tieneCronograma && selectedId === 'credito_aprobado' && (
          <div className="rounded-[10px] px-3 py-2.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <Toggle
              size="sm"
              checked={incluirCronograma}
              onChange={handleToggleCronograma}
              label="Incluir calendario de cobros"
              description="Muestra las fechas y montos de cada cuota"
            />
          </div>
        )}

        {/* Preview editable */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Mensaje (puedes editarlo)
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                {textoEditable.length} caracteres
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(textoEditable)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  } catch {}
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all"
                style={{
                  background: copiado ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg-card)',
                  color: copiado ? 'var(--color-success)' : 'var(--color-text-muted)',
                  border: `1px solid ${copiado ? 'var(--color-success)' : 'var(--color-border)'}`,
                }}
              >
                {copiado ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
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
