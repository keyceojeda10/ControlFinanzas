'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

const TIPO_LABEL = {
  bug: 'Error', pregunta: 'Pregunta', solicitud: 'Solicitud',
  problema_pago: 'Pago', otro: 'Otro',
}

const ESTADO_BADGE = {
  abierto: { label: 'Abierto', variant: 'yellow' },
  en_progreso: { label: 'En progreso', variant: 'blue' },
  resuelto: { label: 'Resuelto', variant: 'green' },
  cerrado: { label: 'Cerrado', variant: 'gray' },
}

const FILTROS_ESTADO = ['todos', 'abierto', 'en_progreso', 'resuelto', 'cerrado']

export default function AdminSoportePage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    setLoading(true)
    const params = filtro !== 'todos' ? `?estado=${filtro}` : ''
    fetch(`/api/soporte${params}`)
      .then(r => r.json())
      .then(data => setTickets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filtro])

  const contactosPendientes = tickets.filter(t => t.solicitaContacto && !t.contactoAtendido)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Soporte</h1>
          <p className="text-xs text-[#888888]">{tickets.length} tickets</p>
        </div>
        {contactosPendientes.length > 0 && (
          <Badge variant="yellow">
            {contactosPendientes.length} contacto{contactosPendientes.length > 1 ? 's' : ''} pendiente{contactosPendientes.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {FILTROS_ESTADO.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
              filtro === f
                ? 'bg-[#f5c518] text-[#0a0a0a]'
                : 'bg-[#1a1a1a] text-[#888888] hover:text-white border border-[#2a2a2a]'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADO_BADGE[f]?.label || f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : tickets.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-[#888888]">No hay tickets {filtro !== 'todos' ? `con estado "${ESTADO_BADGE[filtro]?.label}"` : ''}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const estado = ESTADO_BADGE[t.estado] || ESTADO_BADGE.abierto
            const mensajesNuevos = t._count?.mensajes || 0
            return (
              <Link key={t.id} href={`/admin/soporte/${t.id}`}>
                <Card className="hover:border-[#f5c518]/30 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="gray">{TIPO_LABEL[t.tipo] || t.tipo}</Badge>
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                        {t.solicitaContacto && !t.contactoAtendido && (
                          <Badge variant="yellow">Contactar</Badge>
                        )}
                        {mensajesNuevos > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#f5c518] text-[#0a0a0a] text-[10px] font-bold flex items-center justify-center">
                            {mensajesNuevos}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{t.asunto}</p>
                      <p className="text-xs text-[#555555] mt-1">
                        {t.organization?.nombre} — {t.user?.nombre}
                        {t.solicitaContacto && t.telefonoContacto && (
                          <span className="ml-2 text-[#f59e0b]">Tel: {t.telefonoContacto}</span>
                        )}
                      </p>
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
