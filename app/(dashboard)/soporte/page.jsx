'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useOnline } from '@/hooks/useOnline'
import OfflineFallback from '@/components/offline/OfflineFallback'
import FloatingWhatsApp from '@/components/ui/FloatingWhatsApp'

const WHATSAPP_SOPORTE = '573011993001'
const whatsappLink = (mensaje) =>
  `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`

const TIPO_LABEL = {
  bug: 'Error',
  pregunta: 'Pregunta',
  solicitud: 'Solicitud',
  problema_pago: 'Pago',
  otro: 'Otro',
}

const ESTADO_BADGE = {
  abierto: { label: 'Abierto', variant: 'yellow' },
  en_progreso: { label: 'En progreso', variant: 'blue' },
  resuelto: { label: 'Resuelto', variant: 'green' },
  cerrado: { label: 'Cerrado', variant: 'gray' },
}

const ESTADO_COLOR = {
  abierto: '#f59e0b',
  en_progreso: '#3b82f6',
  resuelto: '#22c55e',
  cerrado: '#64748b',
}

export default function SoportePage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="Soporte no esta disponible sin conexion" />
  return <SoportePageInner />
}

function SoportePageInner() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/soporte')
      .then(r => r.json())
      .then(data => setTickets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header con icono + boton accion */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Soporte</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Crea un ticket o revisa el estado de tus solicitudes</p>
          </div>
        </div>
        <Link href="/soporte/nuevo">
          <Button size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo ticket
          </Button>
        </Link>
      </div>

      {/* Card WhatsApp soporte premium */}
      <div
        className="rounded-[16px] p-4 mb-5 flex flex-col sm:flex-row items-center gap-3 justify-between"
        style={{
          background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.10) 0%, var(--color-bg-card) 60%, var(--color-bg-card) 100%)',
          border: '1px solid color-mix(in srgb, #25D366 22%, var(--color-border))',
          boxShadow: '0 4px 16px color-mix(in srgb, #25D366 12%, transparent)',
        }}
      >
        <div className="flex items-start gap-3 text-center sm:text-left">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(37, 211, 102, 0.18)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>¿Necesitas respuesta rápida?</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Escríbenos por WhatsApp y te atendemos directamente.</p>
          </div>
        </div>
        <a
          href={whatsappLink('Hola, necesito ayuda con Control Finanzas.')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[12px] text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap"
          style={{
            background: 'linear-gradient(135deg, #25D366, #1ebe5b)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </div>

      {/* Lista tickets */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : tickets.length === 0 ? (
        <div
          className="rounded-[16px] py-12 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No tienes tickets de soporte</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Crea uno si necesitas ayuda con algo</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map(t => {
            const estado = ESTADO_BADGE[t.estado] || ESTADO_BADGE.abierto
            const eColor = ESTADO_COLOR[t.estado] || ESTADO_COLOR.abierto
            const mensajesNuevos = t._count?.mensajes || 0
            return (
              <Link key={t.id} href={`/soporte/${t.id}`}>
                <div
                  className="rounded-[14px] px-4 py-3 transition-all kpi-lift cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${eColor} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                    border: `1px solid color-mix(in srgb, ${eColor} 18%, var(--color-border))`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}
                        >
                          {TIPO_LABEL[t.tipo] || t.tipo}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `color-mix(in srgb, ${eColor} 15%, transparent)`,
                            color: eColor,
                            border: `1px solid color-mix(in srgb, ${eColor} 25%, transparent)`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: eColor }} />
                          {estado.label}
                        </span>
                        {mensajesNuevos > 0 && (
                          <span
                            className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                            style={{
                              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
                              color: '#1a1a2e',
                              boxShadow: '0 0 8px color-mix(in srgb, var(--color-accent) 40%, transparent)',
                            }}
                          >
                            {mensajesNuevos}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{t.asunto}</p>
                      <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>{t.descripcion}</p>
                    </div>
                    <span className="text-[10px] shrink-0 font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(t.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <FloatingWhatsApp
        mensaje="Hola, necesito soporte con Control Finanzas."
        label="Soporte por WhatsApp"
        texto="Soporte directo"
      />
    </div>
  )
}
