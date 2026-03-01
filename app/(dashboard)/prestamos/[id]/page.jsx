'use client'
// app/(dashboard)/prestamos/[id]/page.jsx - Detalle del préstamo (página central del sistema)

import { useState, useEffect, use } from 'react'
import { useRouter }                  from 'next/navigation'
import Link                           from 'next/link'
import { useAuth }                    from '@/hooks/useAuth'
import { Badge }                      from '@/components/ui/Badge'
import { Button }                     from '@/components/ui/Button'
import { Card }                       from '@/components/ui/Card'
import { SkeletonCard }               from '@/components/ui/Skeleton'
import RegistrarPago                  from '@/components/prestamos/RegistrarPago'
import { formatCOP }                  from '@/lib/calculos'

// ─── Helpers de formato ──────────────────────────────────────────
const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

const estadoBadge = {
  activo:     { variant: 'blue',  label: 'Activo'     },
  completado: { variant: 'green', label: 'Completado' },
  cancelado:  { variant: 'gray',  label: 'Cancelado'  },
}

const tipoPagoBadge = {
  completo: { variant: 'green',  label: 'Completo' },
  parcial:  { variant: 'yellow', label: 'Parcial'  },
}

export default function PrestamoDetallePage({ params }) {
  const { id }             = use(params)
  const router             = useRouter()
  const { session }        = useAuth()

  const [prestamo,     setPrestamo]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [modalPago,    setModalPago]    = useState(false)
  const [exito,        setExito]        = useState(false)   // animación de éxito
  const [completado,   setCompletado]   = useState(false)   // celebración

  const fetchPrestamo = async () => {
    try {
      const res  = await fetch(`/api/prestamos/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPrestamo(data)
    } catch {
      setError('No se pudo cargar el préstamo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrestamo() }, [id])

  const handlePagoExito = (prestamoActualizado) => {
    setPrestamo(prestamoActualizado)
    setExito(true)
    if (prestamoActualizado.estado === 'completado') setCompletado(true)
    setTimeout(() => setExito(false), 3000)
  }

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────────────────────
  if (error || !prestamo) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">Préstamo no encontrado</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const {
    cliente, estado, montoPrestado, totalAPagar, cuotaDiaria,
    tasaInteres, diasPlazo, fechaInicio, fechaFin,
    totalPagado, saldoPendiente, porcentajePagado, diasMora,
    pagoHoy: yaPagoHoy, pagos = [],
  } = prestamo

  const badge      = estadoBadge[estado] ?? estadoBadge.activo
  const estaActivo = estado === 'activo'
  const enMora     = diasMora > 3

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#555555] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Préstamos
      </button>

      {/* ── CELEBRACIÓN ──────────────────────────────────────────── */}
      {completado && (
        <div className="bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] p-4 text-center animate-pulse">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-[#22c55e] font-bold">¡Préstamo completado!</p>
          <p className="text-xs text-[#555555] mt-0.5">El cliente terminó de pagar</p>
        </div>
      )}

      {/* ── ALERTA MORA ──────────────────────────────────────────── */}
      {enMora && estaActivo && !completado && (
        <div className="flex items-center gap-3 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[16px] px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse shrink-0" />
          <p className="text-sm text-[#ef4444] font-semibold">
            {diasMora} días en mora — requiere atención inmediata
          </p>
        </div>
      )}

      {/* ── ANIMACIÓN ÉXITO PAGO ────────────────────────────────── */}
      {exito && !completado && (
        <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] px-4 py-3">
          <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-[#22c55e] font-medium">Pago registrado exitosamente</p>
        </div>
      )}

      {/* ── HEADER CLIENTE ───────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/clientes/${cliente.id}`} className="hover:text-[#3b82f6] transition-colors">
              <h1 className="text-lg font-bold text-[white]">{cliente.nombre}</h1>
            </Link>
            <p className="text-sm text-[#555555]">CC {cliente.cedula}</p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </Card>

      {/* ── BOTÓN PRINCIPAL DE PAGO ──────────────────────────────── */}
      {estaActivo && !yaPagoHoy && !completado && (
        <button
          onClick={() => setModalPago(true)}
          className="w-full h-14 rounded-[16px] font-bold text-base text-white transition-all duration-200 active:scale-[0.98] shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 4px 24px rgba(16,185,129,0.35)',
          }}
        >
          <span className="flex items-center justify-center gap-2.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Registrar pago de hoy — {formatCOP(cuotaDiaria)}
          </span>
        </button>
      )}

      {/* ── PAGÓ HOY ─────────────────────────────────────────────── */}
      {estaActivo && yaPagoHoy && !completado && (
        <div
          className="w-full h-14 rounded-[16px] flex items-center justify-center gap-2.5"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          <svg className="w-5 h-5 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[#22c55e] font-bold">Pagó hoy — {formatCOP(cuotaDiaria)}</span>
        </div>
      )}

      {/* ── RESUMEN FINANCIERO ───────────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">
          Resumen financiero
        </p>

        {/* Saldo pendiente — número grande */}
        <div className="text-center mb-4">
          <p className="text-xs text-[#555555] mb-1">Saldo pendiente</p>
          <p
            className="text-4xl font-bold leading-none"
            style={{ color: saldoPendiente === 0 ? '#22c55e' : diasMora > 0 ? '#ef4444' : 'white' }}
          >
            {formatCOP(saldoPendiente)}
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#555555] mb-1.5">
            <span>{porcentajePagado}% pagado</span>
            <span>{formatCOP(totalPagado)} de {formatCOP(totalAPagar)}</span>
          </div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${porcentajePagado}%`,
                background: porcentajePagado === 100 ? '#22c55e'
                  : diasMora > 0 ? '#ef4444'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
        </div>

        {/* Grilla de datos */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Prestado',     value: formatCOP(montoPrestado) },
            { label: 'Total a pagar', value: formatCOP(totalAPagar)  },
            { label: 'Cuota diaria', value: formatCOP(cuotaDiaria)   },
            { label: 'Tasa diaria',  value: `${tasaInteres}%`        },
            { label: 'Plazo',        value: `${diasPlazo} días`      },
            { label: 'Inicio',       value: fmtFecha(fechaInicio)    },
            { label: 'Vencimiento',  value: fmtFecha(fechaFin)       },
            {
              label: diasMora > 0 ? 'Días en mora' : 'Estado',
              value: diasMora > 0 ? `${diasMora} días` : 'Al día',
              color: diasMora > 0 ? '#ef4444' : '#22c55e',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111111] rounded-[12px] px-3 py-2.5">
              <p className="text-[10px] text-[#555555]">{label}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: color ?? 'white' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── HISTORIAL DE PAGOS ───────────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">
          Historial de pagos ({pagos.length})
        </p>

        {pagos.length === 0 ? (
          <p className="text-sm text-[#555555] text-center py-4">Sin pagos registrados</p>
        ) : (
          <div className="space-y-2.5">
            {pagos.map((pago) => {
              const tipoBadge = tipoPagoBadge[pago.tipo] ?? tipoPagoBadge.parcial
              return (
                <div
                  key={pago.id}
                  className="flex items-center gap-3 py-2.5 border-b border-[#2a2a2a] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[white]">{formatCOP(pago.montoPagado)}</p>
                    <p className="text-[10px] text-[#555555] mt-0.5">
                      {fmtFecha(pago.fechaPago)}
                      {pago.cobrador && ` · ${pago.cobrador.nombre}`}
                    </p>
                    {pago.nota && <p className="text-[10px] text-[#888888] mt-0.5">{pago.nota}</p>}
                  </div>
                  <Badge variant={tipoBadge.variant}>{tipoBadge.label}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Modal de pago */}
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalPago}
        onClose={() => setModalPago(false)}
        onSuccess={handlePagoExito}
      />
    </div>
  )
}
