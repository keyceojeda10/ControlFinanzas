'use client'
// app/(dashboard)/clientes/[id]/historial/page.jsx - Historial de pagos del cliente

import { formatMoney } from '@/lib/i18n'
import { compararPagos } from '@/lib/dinero/orden-de-pagos'
import { useCabecera } from '@/components/armazon/Armazon'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { obtenerClienteOffline } from '@/lib/offline'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import ListadoPagos from '@/components/pagos/ListadoPagos'
import { CabeceraDetalle } from '@/components/armazon/CabeceraInicio'
import { PastillaProfe } from '@/components/tutoriales/PiezasProfe'

/* El día de Bogotá de un pago (la misma cuenta que ya usaba el filtro). */
const diaDe = (f) => new Date(new Date(f).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
const tituloDia = (dia) => {
  const d = new Date(`${dia}T12:00:00-05:00`)
  const otroAno = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', ...(otroAno ? { year: 'numeric' } : {}), timeZone: 'America/Bogota' })
    .replace(/^./, (c) => c.toUpperCase())
}

export default function HistorialPage() {
  useCabecera({ titulo: 'Historial de pagos', subtitulo: 'Todos los pagos de todos los préstamos' })

  const params = useParams()
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()

  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => {
    if (authLoading) return
    fetch(`/api/clientes/${params.id}/historial`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        setHistorial(Array.isArray(data) ? data : [])
      })
      .catch(async () => {
        // Offline fallback: extract pagos from cached client data
        try {
          const cliente = await obtenerClienteOffline(params.id)
          if (cliente?.prestamos) {
            const allPagos = cliente.prestamos.flatMap((p) =>
              (p.pagos || []).map((pago) => ({
                ...pago,
                prestamoMonto: p.montoPrestado,
              }))
            )
            allPagos.sort((a, b) => compararPagos(a, b, { reciente: true }))
            setHistorial(allPagos)
          }
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false))
  }, [authLoading, params.id])

  /* La franja negra propia (lib/franja.js, 19 nov 2026): también cargando. */
  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <CabeceraDetalle titulo="Historial de pagos" profe={<PastillaProfe />} />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const historialFiltrado = filtroFecha
    ? historial.filter((h) => diaDe(h.fechaPago) === filtroFecha)
    : historial

  const totalPagado = historialFiltrado.reduce((a, h) => a + h.montoPagado, 0)
  const totalPagos = historialFiltrado.length
  /* ── POR DÍA (19 nov 2026) ──
     Era una lista de tarjetas DENTRO de otra tarjeta, con la fecha repetida en
     cada pago y el nombre del cobrador partido en dos renglones. Ahora, como el
     Historial: el día con su total y debajo sus pagos en filas. El orden de
     dentro es el que trae el servidor (`compararPagos`, lo reciente primero). */
  const dias = []
  for (const h of historialFiltrado) {
    const dia = diaDe(h.fechaPago)
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.pagos.push(h)
    else dias.push({ dia, pagos: [h] })
  }

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4">

      {/* En el teléfono, lo pagado va en la banda negra; en el PC, en las dos
          tarjetas de abajo, como siempre. */}
      <CabeceraDetalle
        titulo="Historial de pagos"
        subtitulo="Todos los pagos de este cliente"
        profe={<PastillaProfe />}
        enLaBanda={
          <div style={{ paddingTop: 18 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: 'rgba(255,255,255,.55)' }}>
              {filtroFecha ? 'PAGADO ESE DÍA' : 'TOTAL PAGADO'}
            </p>
            <p className="cf-num" style={{
              margin: '4px 0 0', fontFamily: "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif",
              fontSize: 40, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1.05, color: '#fff',
            }}>{formatMoney(totalPagado)}</p>
            <p className="cf-num" style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,.62)' }}>
              {totalPagos} {totalPagos === 1 ? 'pago' : 'pagos'}
            </p>
          </div>
        }
      />

      {/* Filtro por fecha + export */}
      <div className="flex items-center gap-2">
        <label
          className="relative flex-1 h-9 flex items-center gap-2 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 cursor-pointer hover:border-[var(--cf-ink-2)] transition-colors"
        >
          <svg className="w-4 h-4 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-[var(--cf-ink)]">
            {filtroFecha || 'Filtrar por fecha'}
          </span>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        {filtroFecha && (
          <button
            type="button"
            onClick={() => setFiltroFecha('')}
            className="px-3 h-9 text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] border border-[var(--cf-border)] rounded-[12px]"
          >
            Limpiar
          </button>
        )}
        {historial.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const qs = new URLSearchParams({ cliente: params.id })
              if (filtroFecha) {
                qs.set('desde', filtroFecha)
                qs.set('hasta', filtroFecha)
              }
              window.location.href = `/api/pagos/export?${qs.toString()}`
            }}
            title="Descargar CSV"
            aria-label="Descargar CSV"
            className="h-9 w-9 flex items-center justify-center rounded-[12px] border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Resumen (en el teléfono va en la banda) */}
      <div className="hidden lg:grid grid-cols-2 gap-3">
        {/* Plana, como su vecina: llevaba degradado verde y un halo de 30px. */}
        <Card>
          <p className="text-[13px] text-[var(--cf-ink-3)]">Total pagado</p>
          <p className="text-xl font-bold text-[var(--cf-ink)] mt-1 font-mono-display">{formatMoney(totalPagado)}</p>
        </Card>
        <Card>
          <p className="text-[13px] text-[var(--cf-ink-3)]">Cantidad de pagos</p>
          <p className="text-xl font-bold text-[var(--cf-ink)] mt-1 font-mono-display">{totalPagos}</p>
        </Card>
      </div>

      {/* Los pagos, por día */}
      {dias.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">{filtroFecha ? 'Sin pagos en esta fecha' : 'No hay pagos registrados'}</p>
        </Card>
      ) : dias.map(({ dia, pagos }) => (
        <section key={dia} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '4px 2px 0' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-3)' }}>{tituloDia(dia)}</span>
            <span className="cf-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
              {formatMoney(pagos.reduce((a, p) => a + (['recargo', 'descuento'].includes(p.tipo) ? 0 : p.montoPagado), 0))}
            </span>
          </div>
          <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)', overflow: 'hidden' }}>
            <ListadoPagos pagos={pagos} filas sinFecha mostrarCliente={false} mostrarCobrador mostrarLinkPrestamo />
          </div>
        </section>
      ))}
    </div>
  )
}
