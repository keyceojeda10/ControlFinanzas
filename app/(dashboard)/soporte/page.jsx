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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Soporte</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Crea un ticket o revisa el estado de tus solicitudes</p>
        </div>
        <Link href="/soporte/nuevo">
          <Button size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo ticket
          </Button>
        </Link>
      </div>

      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 mb-5 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-start gap-3 text-center sm:text-left">
          <div className="hidden sm:flex h-10 w-10 rounded-full bg-[#25D366]/15 text-[#25D366] items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">¿Necesitas respuesta rápida?</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Escríbenos por WhatsApp y te atendemos directamente.</p>
          </div>
        </div>
        <a
          href={whatsappLink('Hola, necesito ayuda con Control Finanzas.')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[12px] bg-[#25D366] hover:bg-[#1ebe5b] text-white text-sm font-semibold transition-all whitespace-nowrap"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 text-[#2a2a2a] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm text-[var(--color-text-muted)] mb-1">No tienes tickets de soporte</p>
          <p className="text-xs text-[var(--color-text-muted)]">Crea uno si necesitas ayuda con algo</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const estado = ESTADO_BADGE[t.estado] || ESTADO_BADGE.abierto
            const mensajesNuevos = t._count?.mensajes || 0
            return (
              <Link key={t.id} href={`/soporte/${t.id}`}>
                <Card className="hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="gray">{TIPO_LABEL[t.tipo] || t.tipo}</Badge>
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                        {mensajesNuevos > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-[#1a1a2e] text-[10px] font-bold flex items-center justify-center">
                            {mensajesNuevos}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{t.asunto}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">{t.descripcion}</p>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                      {new Date(t.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <FloatingWhatsApp mensaje="Hola, necesito soporte con Control Finanzas." label="Soporte por WhatsApp" />
    </div>
  )
}
