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
import BotonWhatsApp                  from '@/components/ui/BotonWhatsApp'
import BotonCompartir                 from '@/components/ui/BotonCompartir'
import BotonImprimirRecibo            from '@/components/ui/BotonImprimirRecibo'
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
  completo: { variant: 'green',  label: 'Completo'  },
  parcial:  { variant: 'yellow', label: 'Parcial'   },
  capital:  { variant: 'purple', label: 'A Capital' },
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
  const [ultimoPago,   setUltimoPago]   = useState(null)    // para botón WA pago
  const [cancelando,   setCancelando]   = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [anulando,     setAnulando]     = useState(null)   // pagoId que se está anulando
  const [rutaNav,      setRutaNav]     = useState(null)

  // Leer contexto de ruta activa
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cf-ruta-nav')
      if (saved) setRutaNav(JSON.parse(saved))
    } catch {}
  }, [])

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

  const handlePagoExito = (prestamoActualizado, pagoRegistrado) => {
    setPrestamo(prestamoActualizado)
    setUltimoPago(pagoRegistrado ?? null)
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
    cliente, estado, montoPrestado, totalAPagar, cuotaDiaria, frecuencia,
    tasaInteres, diasPlazo, fechaInicio, fechaFin,
    totalPagado, saldoPendiente, porcentajePagado, diasMora,
    pagoHoy: yaPagoHoy, pagos = [],
  } = prestamo

  const frecuenciaLabel = {
    diario: 'diario',
    semanal: 'semanal',
    quincenal: 'quincenal',
    mensual: 'mensual',
  }[frecuencia] || 'diario'

  const badge      = estadoBadge[estado] ?? estadoBadge.activo
  const estaActivo = estado === 'activo'
  const enMora     = diasMora > 3

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors"
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
          <p className="text-xs text-[#888888] mt-0.5">El cliente terminó de pagar</p>
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
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] px-4 py-3">
            <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#22c55e] font-medium">Pago registrado exitosamente</p>
          </div>
          {ultimoPago && cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          {ultimoPago && (
            <div className="flex gap-2">
              <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
              <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            </div>
          )}
        </div>
      )}

      {/* ── WA PAGO (persiste después de cerrar animación) ───────── */}
      {!exito && ultimoPago && !completado && (
        <>
          {cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          </div>
        </>
      )}

      {/* ── WA PRÉSTAMO COMPLETADO ───────────────────────────────── */}
      {completado && ultimoPago && (
        <>
          {cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
            <BotonImprimirRecibo cliente={cliente} prestamo={prestamo} pago={ultimoPago} />
          </div>
        </>
      )}

      {/* ── SIGUIENTE EN RUTA (después de pago) ──────────────────── */}
      {rutaNav && (exito || yaPagoHoy) && (() => {
        const idx = rutaNav.clientes.findIndex(c => c.id === cliente?.id)
        const isLast = idx >= rutaNav.clientes.length - 1
        const nextCliente = !isLast && idx >= 0 ? rutaNav.clientes[idx + 1] : null

        const navigateNext = () => {
          if (!nextCliente) return
          const newNav = { ...rutaNav, currentIndex: idx + 1 }
          sessionStorage.setItem('cf-ruta-nav', JSON.stringify(newNav))
          const getDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
          localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
            clienteId: nextCliente.id, clienteNombre: nextCliente.nombre, index: idx + 1, date: getDate(),
          }))
          router.push(`/clientes/${nextCliente.id}`)
        }

        return isLast ? (
          <button
            onClick={() => { sessionStorage.removeItem('cf-ruta-nav'); router.push(`/rutas/${rutaNav.rutaId}`) }}
            className="w-full py-3.5 rounded-[14px] bg-[#22c55e] text-white text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Ruta finalizada · Volver a {rutaNav.rutaNombre}
          </button>
        ) : (
          <button
            onClick={navigateNext}
            className="w-full py-3.5 rounded-[14px] text-sm font-semibold active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #f5c518, #f0b800)', color: '#0a0a0a' }}
          >
            Siguiente → {nextCliente.nombre}
          </button>
        )
      })()}

      {/* ── HEADER CLIENTE ───────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/clientes/${cliente.id}`} className="hover:text-[#f5c518] transition-colors">
              <h1 className="text-lg font-bold text-[white]">{cliente.nombre}</h1>
            </Link>
            <p className="text-sm text-[#888888]">CC {cliente.cedula}</p>
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
              Registrar pago {frecuenciaLabel} — {formatCOP(cuotaDiaria)}
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
          <span className="text-[#22c55e] font-bold">Pagó {frecuenciaLabel} — {formatCOP(cuotaDiaria)}</span>
        </div>
      )}

      {/* ── BOTÓN DE ABONO EXTRAORDINARIO ────────────────────────────── */}
      {estaActivo && !completado && saldoPendiente > 0 && (
        <button
          onClick={() => setModalPago(true)}
          className="w-full h-12 rounded-[16px] font-semibold text-base text-[#f5c518] bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.3)] hover:bg-[rgba(245,197,24,0.2)] transition-all"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Hacer abono extraordinario
          </span>
        </button>
      )}

      {/* ── RESUMEN FINANCIERO ───────────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Resumen financiero
        </p>

        {/* Saldo pendiente — número grande */}
        <div className="text-center mb-4">
          <p className="text-xs text-[#888888] mb-1">Saldo pendiente</p>
          <p
            className="text-4xl font-bold leading-none"
            style={{ color: saldoPendiente === 0 ? '#22c55e' : diasMora > 0 ? '#ef4444' : 'white' }}
          >
            {formatCOP(saldoPendiente)}
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#888888] mb-1.5">
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
                  : 'linear-gradient(90deg, #f5c518, #f0b800)',
              }}
            />
          </div>
        </div>

        {/* Grilla de datos */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Prestado',     value: formatCOP(montoPrestado) },
            { label: 'Total a pagar', value: formatCOP(totalAPagar)  },
            { label: `Cuota ${frecuenciaLabel}`, value: formatCOP(cuotaDiaria)   },
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
              <p className="text-[10px] text-[#888888]">{label}</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: color ?? 'white' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── BOTONES WHATSAPP ─────────────────────────────────────── */}
      {cliente?.telefono && estaActivo && enMora && !completado && (
        <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={prestamo} />
      )}
      {cliente?.telefono && estaActivo && !enMora && !ultimoPago && (
        <BotonWhatsApp tipo="prestamo" cliente={cliente} prestamo={prestamo} />
      )}

      {/* ── HISTORIAL DE PAGOS ───────────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Historial de pagos ({pagos.length})
        </p>

        {pagos.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">Sin pagos registrados</p>
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
                    <p className="text-[10px] text-[#888888] mt-0.5">
                      {fmtFecha(pago.fechaPago)}
                      {pago.cobrador && ` · ${pago.cobrador.nombre}`}
                    </p>
                    {pago.nota && <p className="text-[10px] text-[#888888] mt-0.5">{pago.nota}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Badge variant={tipoBadge.variant}>{tipoBadge.label}</Badge>
                    {pago.tipo === 'capital' && tasaInteres > 0 && (
                      <span className="text-[10px] text-[#a855f7]">
                        -{formatCOP(Math.round(pago.montoPagado * tasaInteres / 100))} int.
                      </span>
                    )}
                  </div>
                  {session?.user?.rol === 'owner' && (
                    <button
                      onClick={async () => {
                        if (anulando) return
                        if (!confirm(`¿Anular pago de ${formatCOP(pago.montoPagado)}?`)) return
                        setAnulando(pago.id)
                        try {
                          const res = await fetch(`/api/pagos/${pago.id}`, { method: 'DELETE' })
                          if (!res.ok) throw new Error()
                          await fetchPrestamo()
                        } catch {
                          setError('No se pudo anular el pago.')
                        } finally {
                          setAnulando(null)
                        }
                      }}
                      disabled={anulando === pago.id}
                      className="shrink-0 p-1.5 rounded-lg text-[#888888] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors disabled:opacity-50"
                      title="Anular pago"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── CANCELAR PRÉSTAMO (solo owner, solo activo) ──────────── */}
      {estaActivo && session?.user?.rol === 'owner' && !completado && (
        <div className="pt-2">
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] text-sm font-medium text-[#888888] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] border border-[#2a2a2a] hover:border-[rgba(239,68,68,0.3)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Cancelar préstamo
            </button>
          ) : (
            <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-[14px] p-4 space-y-3">
              <p className="text-sm text-[#ef4444] font-semibold">¿Cancelar este préstamo?</p>
              <p className="text-xs text-[#888888]">
                Se marcará como cancelado. El saldo pendiente de {formatCOP(saldoPendiente)} quedará sin cobrar.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 h-10 rounded-[10px] text-sm font-medium text-[#888888] border border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors"
                >
                  No, volver
                </button>
                <button
                  onClick={async () => {
                    setCancelando(true)
                    try {
                      const res = await fetch(`/api/prestamos/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'cancelado' }),
                      })
                      if (!res.ok) throw new Error()
                      await fetchPrestamo()
                      setConfirmCancel(false)
                    } catch {
                      setError('No se pudo cancelar el préstamo.')
                    } finally {
                      setCancelando(false)
                    }
                  }}
                  disabled={cancelando}
                  className="flex-1 h-10 rounded-[10px] text-sm font-bold text-white bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 transition-colors"
                >
                  {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de pago */}
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalPago}
        onClose={() => setModalPago(false)}
        onSuccess={handlePagoExito}
        cliente={cliente}
        prestamo={prestamo}
      />
    </div>
  )
}
