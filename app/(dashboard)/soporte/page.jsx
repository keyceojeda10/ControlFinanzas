'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Soporte</h1>
          <p className="text-xs text-[#888888]">Crea un ticket o revisa el estado de tus solicitudes</p>
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

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 text-[#2a2a2a] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm text-[#888888] mb-1">No tienes tickets de soporte</p>
          <p className="text-xs text-[#555555]">Crea uno si necesitas ayuda con algo</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const estado = ESTADO_BADGE[t.estado] || ESTADO_BADGE.abierto
            const mensajesNuevos = t._count?.mensajes || 0
            return (
              <Link key={t.id} href={`/soporte/${t.id}`}>
                <Card className="hover:border-[#f5c518]/30 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="gray">{TIPO_LABEL[t.tipo] || t.tipo}</Badge>
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                        {mensajesNuevos > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#f5c518] text-[#0a0a0a] text-[10px] font-bold flex items-center justify-center">
                            {mensajesNuevos}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{t.asunto}</p>
                      <p className="text-xs text-[#555555] mt-1 line-clamp-1">{t.descripcion}</p>
                    </div>
                    <span className="text-[10px] text-[#555555] shrink-0">
                      {new Date(t.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
