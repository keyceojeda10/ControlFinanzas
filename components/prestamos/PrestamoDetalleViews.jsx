'use client'
// components/prestamos/PrestamoDetalleViews.jsx
// Componentes visuales premium para la pagina de detalle de prestamo.
// Inspirados en Mercury / Revolut, alineados con el dashboard rediseñado.

import { useState, useEffect, useRef, useId } from 'react'
import Link from 'next/link'
import { formatCOP, formatFechaCobroRelativa } from '@/lib/calculos'
import OfflineBadge from '@/components/offline/OfflineBadge'

// ─── Helpers de fecha ────────────────────────────────────────────
const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

const fmtFechaCorta = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  : '—'

// ─── Mood color (igual que cards rediseñadas) ────────────────────
export function moodColorFromPrestamo(p) {
  if (!p) return 'var(--color-accent)'
  if (p.estado === 'completado') return 'var(--color-success)'
  if (p.estado === 'cancelado') return '#64748b'
  if ((p.diasMora ?? 0) > 7) return 'var(--color-danger)'
  if ((p.diasMora ?? 0) > 0) return '#f97316'
  return 'var(--color-accent)'
}

// ─── Hook count-up ───────────────────────────────────────────────
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) { setValue(target); return }
    fromRef.current = value
    startRef.current = null
    let raf
    const step = (ts) => {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = fromRef.current + (target - fromRef.current) * eased
      setValue(current)
      if (progress < 1) raf = requestAnimationFrame(step)
      else setValue(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return value
}

// ─── Sparkline pequeño para historial de pagos ───────────────────
function MiniSparkline({ data, color = 'var(--color-success)', height = 32 }) {
  const reactId = useId()
  if (!data || data.length === 0) return null
  const w = 120
  const h = height
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return [x, y]
  })
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`
  const gradId = `mini-spark-${reactId.replace(/:/g, '')}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Donut grande de % pagado (usado dentro del HeroCard) ────────
function DonutPagado({ pct, color, size = 76 }) {
  const animPct = useCountUp(pct, 900)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const len = (animPct / 100) * circ
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-hover)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${len} ${circ}`}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 50%, transparent))`, transition: 'stroke-dasharray 0.05s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="font-mono-display font-bold leading-none" style={{ color, fontSize: size * 0.24 }}>
          {Math.round(animPct)}<span style={{ fontSize: size * 0.14 }}>%</span>
        </p>
      </div>
    </div>
  )
}

// ─── 1. HeroCard de Saldo Pendiente ──────────────────────────────
export function PrestamoHeroCard({ prestamo, narrativa, sparklineData }) {
  const color = moodColorFromPrestamo(prestamo)
  const accent = color
  const saldo = Number(prestamo?.saldoPendiente ?? 0)
  const animSaldo = useCountUp(saldo, 900)
  const totalAPagar = prestamo?.totalAPagar ?? 0
  const totalPagado = totalAPagar - saldo
  const pctPagado = totalAPagar > 0 ? Math.round((totalPagado / totalAPagar) * 100) : 0

  return (
    <div
      className="relative rounded-[20px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${accent} 8%, var(--color-bg-card)) 100%)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, var(--color-border))`,
        boxShadow: `0 8px 32px color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      {/* Orb pulsante decorativo */}
      <div
        className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }}
      />
      {/* Patron de puntos sutil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color }}
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>
            Saldo pendiente
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="font-mono-display font-bold leading-none tracking-tight truncate"
              style={{
                color,
                fontSize: 'clamp(36px, 11vw, 56px)',
                textShadow: `0 0 40px color-mix(in srgb, ${color} 25%, transparent)`,
              }}
            >
              {formatCOP(Math.round(animSaldo))}
            </p>
            <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              de {formatCOP(totalAPagar)} totales
            </p>
            {narrativa && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)` }}
              >
                {typeof narrativa === 'object' && narrativa.icon && (
                  <span className="w-3.5 h-3.5 inline-flex items-center justify-center">{narrativa.icon}</span>
                )}
                <span>{typeof narrativa === 'object' ? narrativa.text : narrativa}</span>
              </div>
            )}
          </div>

          {/* Donut de % pagado a la derecha */}
          <div className="hidden sm:block">
            <DonutPagado pct={pctPagado} color={color} size={84} />
          </div>
        </div>

        {/* Donut version movil */}
        <div className="sm:hidden mt-4 flex items-center gap-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
          <DonutPagado pct={pctPagado} color={color} size={64} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Ha pagado</p>
            <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatCOP(totalPagado)}</p>
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4">
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Pagos últimos 14 días</p>
            <MiniSparkline data={sparklineData} color={color} height={36} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. Header del cliente con contexto rico ─────────────────────
export function HeaderClienteContexto({ cliente, prestamo, statsCliente, onWhatsApp }) {
  const color = moodColorFromPrestamo(prestamo)
  const inicial = cliente?.nombre?.[0]?.toUpperCase() ?? '?'
  const tieneFoto = !!cliente?.fotoUrl

  return (
    <div
      className="rounded-[16px] px-4 py-3.5"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar con anillo del color del prestamo */}
        <div className="shrink-0">
          {tieneFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cliente.fotoUrl}
              alt={cliente.nombre}
              className="w-12 h-12 rounded-full object-cover"
              style={{ border: `2px solid ${color}` }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold"
              style={{
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
                color,
                border: `2px solid color-mix(in srgb, ${color} 40%, transparent)`,
              }}
            >
              {inicial}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={cliente?.id ? `/clientes/${cliente.id}` : '#'}
            className="text-base font-bold leading-tight truncate block hover:text-[var(--color-accent)] transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {cliente?.nombre || 'Cliente'}
          </Link>
          {cliente?.cedula && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>CC {cliente.cedula}</p>
          )}
          {statsCliente && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>{statsCliente}</p>
          )}
        </div>

        {/* Botones circulares */}
        <div className="flex items-center gap-1.5 shrink-0">
          {cliente?.telefono && onWhatsApp && (
            <button
              onClick={onWhatsApp}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)' }}
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
            </button>
          )}
          <Link
            href={cliente?.id ? `/clientes/${cliente.id}` : '#'}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            title="Ver perfil"
            aria-label="Ver perfil"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <OfflineBadge id={prestamo?.id} />
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
            border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {prestamo?.estado === 'completado' ? 'Completado' :
           prestamo?.estado === 'cancelado' ? 'Cancelado' :
           (prestamo?.diasMora ?? 0) > 7 ? `${prestamo.diasMora}d en mora` :
           (prestamo?.diasMora ?? 0) > 0 ? `${prestamo.diasMora}d vencido` :
           'Al día'}
        </span>
      </div>
    </div>
  )
}

// ─── 3. Botón principal de pago con personalidad ─────────────────
export function BotonPagoPersonalidad({ enMora, frecuenciaLabel, monto, onClick }) {
  const isUrgente = enMora
  return (
    <button
      onClick={onClick}
      className="w-full h-14 rounded-[16px] font-bold text-base text-white transition-all duration-200 active:scale-[0.98] shadow-lg relative overflow-hidden group"
      style={{
        background: isUrgente
          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
          : 'linear-gradient(135deg, #22c55e, #16a34a)',
        boxShadow: isUrgente
          ? '0 4px 24px rgba(239, 68, 68, 0.35)'
          : '0 4px 24px rgba(16, 185, 129, 0.35)',
      }}
    >
      {/* Shimmer overlay on hover */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <span className="relative flex items-center justify-center gap-2.5">
        {isUrgente ? (
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {isUrgente
          ? `URGENTE: Registrar pago ${frecuenciaLabel} — ${formatCOP(monto)}`
          : `Registrar pago ${frecuenciaLabel} — ${formatCOP(monto)}`}
      </span>
    </button>
  )
}

// ─── 4. Stats inteligentes contextuales (chips) ──────────────────
export function StatsContextuales({ stats }) {
  if (!stats || stats.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {stats.map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
            color: s.color,
            border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
          }}
        >
          <span className="w-3.5 h-3.5 inline-flex items-center">{s.icon}</span>
          <span>{s.text}</span>
        </span>
      ))}
    </div>
  )
}

// Generar stats basado en el prestamo
export function generarStatsContextuales({ prestamo, totalPagado, cuotasPagadas, fechaInicio, fechaFin, diasMora, porcentajePagado, prestamoNumeroCliente, totalPrestamosCliente }) {
  const stats = []

  // Cuotas pagadas
  if (cuotasPagadas > 0) {
    stats.push({
      color: 'var(--color-success)',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
      text: `${cuotasPagadas} cuota${cuotasPagadas === 1 ? '' : 's'} pagada${cuotasPagadas === 1 ? '' : 's'}`,
    })
  }

  // Termina el [fecha]
  if (prestamo?.estado === 'activo' && fechaFin) {
    const fin = new Date(fechaFin)
    const hoy = new Date()
    const diasRestantes = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    if (diasRestantes > 0 && diasRestantes <= 30) {
      stats.push({
        color: 'var(--color-accent)',
        icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        text: `Termina en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`,
      })
    }
  }

  // Mora
  if (diasMora > 0) {
    stats.push({
      color: diasMora > 7 ? 'var(--color-danger)' : '#f97316',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      text: `${diasMora} día${diasMora === 1 ? '' : 's'} en mora`,
    })
  }

  // Casi terminado
  if (porcentajePagado >= 90 && porcentajePagado < 100) {
    stats.push({
      color: '#a855f7',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
      text: '¡Casi terminado!',
    })
  }

  // Cliente recurrente
  if (prestamoNumeroCliente && prestamoNumeroCliente > 1) {
    stats.push({
      color: '#06b6d4',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      text: `Préstamo #${prestamoNumeroCliente} con este cliente`,
    })
  }

  return stats
}

// ─── 5. Acciones secundarias como chips ──────────────────────────
export function ChipsAccionesSecundarias({ acciones }) {
  if (!acciones || acciones.length === 0) return null
  // Grid de columnas iguales para que se vean alineadas (no flex-wrap suelto)
  const cols = acciones.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
  return (
    <div className={`grid ${cols} gap-2`}>
      {acciones.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          className="group relative h-12 px-3 rounded-[12px] flex items-center gap-2 transition-all active:scale-[0.98] overflow-hidden"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${a.color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
            border: `1px solid color-mix(in srgb, ${a.color} 22%, var(--color-border))`,
          }}
        >
          {/* Icono con fondo cuadrado del color */}
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
            style={{
              background: `color-mix(in srgb, ${a.color} 18%, transparent)`,
              color: a.color,
            }}
          >
            <span className="w-4 h-4">{a.icon}</span>
          </div>
          {/* Texto: label arriba (titulo), sublabel abajo (opcional) */}
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-[12px] font-semibold leading-tight truncate w-full text-left" style={{ color: a.color }}>
              {a.label}
            </span>
            {a.sublabel && (
              <span className="text-[10px] leading-tight truncate w-full text-left" style={{ color: 'var(--color-text-muted)' }}>
                {a.sublabel}
              </span>
            )}
          </div>
          {/* Chevron derecho */}
          <svg className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: a.color }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  )
}

// ─── 6. Grilla de datos en 3 secciones ───────────────────────────
export function GrillaDatosSecciones({ secciones }) {
  return (
    <div className="space-y-3">
      {secciones.map((sec) => (
        <div
          key={sec.titulo}
          className="rounded-[14px] p-3"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${sec.color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
            border: `1px solid color-mix(in srgb, ${sec.color} 18%, var(--color-border))`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div
              className="w-5 h-5 rounded-[5px] flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${sec.color} 18%, transparent)`, color: sec.color }}
            >
              {sec.icon}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sec.color }}>
              {sec.titulo}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sec.items.map((it) => (
              <div key={it.label} className="rounded-[8px] px-2.5 py-1.5" style={{ background: 'var(--color-bg-base)' }}>
                <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{it.label}</p>
                <p className="text-[12px] font-semibold mt-0.5 font-mono-display" style={{ color: it.color || 'var(--color-text-primary)' }}>
                  {it.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 7. Línea de tiempo del préstamo ─────────────────────────────
export function TimelinePrestamo({ fechaInicio, fechaFin, porcentajePagado, color = 'var(--color-accent)' }) {
  // Calcular pcts de forma segura (sin useHooks dentro de condicionales)
  const inicio = fechaInicio ? new Date(fechaInicio) : null
  const fin = fechaFin ? new Date(fechaFin) : null
  const hoy = new Date()
  const totalMs = inicio && fin ? fin - inicio : 0
  const transcurridoMs = inicio ? Math.min(totalMs, Math.max(0, hoy - inicio)) : 0
  const pctTiempo = totalMs > 0 ? Math.min(100, Math.max(0, (transcurridoMs / totalMs) * 100)) : 0
  const diasRestantes = fin ? Math.max(0, Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))) : 0
  // Hooks SIEMPRE en el mismo orden (no dentro de condicional)
  const animTiempo = useCountUp(pctTiempo, 1000)
  const animPago = useCountUp(porcentajePagado || 0, 1000)
  // Early return DESPUES de los hooks
  if (!fechaInicio || !fechaFin) return null

  // Si el progreso de pago va por delante del tiempo → buena señal
  const adelantado = animPago > animTiempo + 5
  const atrasado = animPago < animTiempo - 5

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Línea de tiempo
        </p>
        {diasRestantes > 0 && (
          <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            Faltan <span className="font-mono-display font-semibold" style={{ color: 'var(--color-text-primary)' }}>{diasRestantes}</span> día{diasRestantes === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Track con dos barras superpuestas: tiempo (gris) + pagos (color) */}
      <div className="relative h-6 mb-1">
        {/* Track de fondo */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ background: 'var(--color-bg-hover)' }} />
        {/* Tiempo transcurrido (gris claro) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{ width: `${animTiempo}%`, background: 'color-mix(in srgb, var(--color-text-muted) 40%, transparent)' }}
        />
        {/* Pagos (color del estado) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            width: `${animPago}%`,
            background: color,
            boxShadow: animPago > 5 ? `0 0 8px color-mix(in srgb, ${color} 50%, transparent)` : 'none',
          }}
        />
        {/* Marker de "Hoy" */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
          style={{
            left: `${animTiempo}%`,
            background: 'var(--color-bg-card)',
            border: `2px solid ${color}`,
            boxShadow: `0 0 8px color-mix(in srgb, ${color} 50%, transparent)`,
          }}
          title="Hoy"
        />
        {/* Etiqueta "Hoy" */}
        <div
          className="absolute top-full mt-0.5 -translate-x-1/2 text-[8px] font-semibold whitespace-nowrap"
          style={{ left: `${animTiempo}%`, color }}
        >
          Hoy
        </div>
      </div>

      {/* Etiquetas de inicio/fin */}
      <div className="flex items-center justify-between text-[10px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-wider">Inicio</p>
          <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{fmtFechaCorta(fechaInicio)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider">Vencimiento</p>
          <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{fmtFechaCorta(fechaFin)}</p>
        </div>
      </div>

      {/* Mensaje de estado de progreso */}
      {adelantado && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
          </svg>
          <span>Va adelantado en pagos</span>
        </div>
      )}
      {atrasado && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Atrasado vs el tiempo del préstamo</span>
        </div>
      )}
    </div>
  )
}

// ─── 8. Mini card de un pago en el historial ─────────────────────
export function PagoMiniCard({ pago, onAnular, anulando, isOffline, children }) {
  const tipoColors = {
    completo:  { bg: 'var(--color-success)', label: 'Completo' },
    parcial:   { bg: '#f5c518',              label: 'Parcial' },
    capital:   { bg: '#a855f7',              label: 'A Capital' },
    recargo:   { bg: 'var(--color-danger)',  label: 'Recargo' },
    descuento: { bg: '#3b82f6',              label: 'Descuento' },
  }
  const tipoInfo = tipoColors[pago.tipo] || tipoColors.parcial

  return (
    <div
      className="rounded-[14px] p-3 transition-all hover:scale-[1.005]"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${tipoInfo.bg} 5%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
        border: `1px solid color-mix(in srgb, ${tipoInfo.bg} 15%, var(--color-border))`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icono circular del tipo */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${tipoInfo.bg} 18%, transparent)`,
            color: tipoInfo.bg,
            border: `1px solid color-mix(in srgb, ${tipoInfo.bg} 30%, transparent)`,
          }}
        >
          {pago.tipo === 'recargo' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          ) : pago.tipo === 'descuento' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: `color-mix(in srgb, ${tipoInfo.bg} 15%, transparent)`,
                color: tipoInfo.bg,
              }}
            >
              {tipoInfo.label}
            </span>
            {isOffline && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--color-warning)' }}>
                offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{fmtFecha(pago.fechaPago)}</span>
            {pago.metodoPago && (
              <>
                <span>·</span>
                <span className="capitalize">{pago.metodoPago}</span>
              </>
            )}
          </div>
          {pago.nota && (
            <p className="text-[10px] mt-1 italic truncate" style={{ color: 'var(--color-text-secondary)' }} title={pago.nota}>
              {pago.nota}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p
            className="text-[15px] font-bold font-mono-display leading-none"
            style={{ color: pago.tipo === 'descuento' ? '#3b82f6' : tipoInfo.bg }}
          >
            {pago.tipo === 'descuento' ? '-' : pago.tipo === 'recargo' ? '+' : ''}{formatCOP(pago.montoPagado)}
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}

// ─── 9. Mini-resumen comparativo "vs último préstamo" ────────────
export function ComparativoPrestamosCliente({ totalPrestamosCliente, prestamoNumeroCliente, prestamosCompletadosCliente }) {
  if (!totalPrestamosCliente || totalPrestamosCliente <= 1) return null
  const items = [
    `Préstamo #${prestamoNumeroCliente || 1} con este cliente`,
  ]
  if (prestamosCompletadosCliente > 0) {
    items.push(`${prestamosCompletadosCliente} ${prestamosCompletadosCliente === 1 ? 'préstamo completado' : 'préstamos completados'} antes`)
  }
  return (
    <div
      className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #06b6d4 15%, transparent)', color: '#06b6d4' }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cliente recurrente</p>
        {items.map((it, i) => (
          <p key={i} className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{it}</p>
        ))}
      </div>
    </div>
  )
}
