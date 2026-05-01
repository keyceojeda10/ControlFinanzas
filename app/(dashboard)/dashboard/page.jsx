'use client'
import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'
import { useAuth } from '@/hooks/useAuth'
import { guardarEnCache, leerDeCache, obtenerDashboardOffline } from '@/lib/offline'
import { useOffline } from '@/components/providers/OfflineProvider'
import { useOnboarding } from '@/components/onboarding/useOnboarding'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import SpotlightOverlay from '@/components/onboarding/SpotlightOverlay'
import CobradorOnboarding from '@/components/onboarding/CobradorOnboarding'
import CacheAge from '@/components/offline/CacheAge'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[12px] ${className}`} style={{ background: 'var(--color-bg-hover)' }} />
}

// Skeleton con forma de KpiCard real para que la carga no parezca un bloque vacio
function KpiCardSkeleton() {
  const shimmerStyle = {
    background: 'linear-gradient(90deg, var(--color-bg-hover) 0%, color-mix(in srgb, var(--color-text-muted) 18%, var(--color-bg-hover)) 50%, var(--color-bg-hover) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  }
  return (
    <div
      className="rounded-[16px] px-4 py-4"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="h-3 w-20 rounded" style={shimmerStyle} />
        <div className="w-7 h-7 rounded-[8px] shrink-0" style={shimmerStyle} />
      </div>
      <div className="h-5 w-28 rounded mb-2" style={shimmerStyle} />
      <div className="h-2.5 w-20 rounded" style={shimmerStyle} />
    </div>
  )
}

function KpiGroupSkeleton({ kpis = 2 }) {
  return (
    <div
      className="rounded-[16px]"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] animate-pulse" style={{ background: 'var(--color-bg-hover)' }} />
        <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--color-bg-hover)' }} />
      </div>
      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(kpis)].map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}

// Hook count-up: anima un numero desde 0 hasta el valor final con easing suave
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) {
      setValue(target)
      return
    }
    fromRef.current = value
    startRef.current = null
    let raf
    const step = (ts) => {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(1, elapsed / duration)
      // easeOutCubic — arranque rapido, frenado suave
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

// Sparkline minimalista con SVG. Recibe array de numeros y dibuja una linea
// con gradiente, mostrando el ultimo punto destacado.
function Sparkline({ data, color = 'var(--color-success)', height = 28, ariaLabel }) {
  const reactId = useId()
  if (!data || data.length === 0) return null
  const w = 100
  const h = height
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return [x, y]
  })
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`
  const lastPoint = points[points.length - 1]
  const gradId = `spark-${reactId.replace(/:/g, '')}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height, display: 'block' }} aria-label={ariaLabel}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {lastPoint && (
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.2" fill={color} />
      )}
    </svg>
  )
}

// Hero card: KPI principal en grande con gradiente, glow pulsante, narrativa
// y donut de meta integrado a la derecha. Inspirado en Mercury / Revolut.
function HeroCard({ label, value, valueRaw, sub, color = '#10b981', accent = '#34d399', narrativa, sparklineData, metaDiaria, info }) {
  const animatedNum = useCountUp(typeof valueRaw === 'number' ? valueRaw : 0, 900)
  const [showInfo, setShowInfo] = useState(false)
  const hasInfo = Boolean(info)
  const display = typeof valueRaw === 'number' ? formatCOP(Math.round(animatedNum)) : value

  return (
    <div
      className="relative rounded-[20px] overflow-hidden kpi-lift"
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
        {/* Header con label + boton info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
          {hasInfo && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!showInfo) setShowInfo(true) }}
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ml-auto cursor-pointer transition-transform hover:scale-110"
              style={{ background: `color-mix(in srgb, ${color} 25%, transparent)`, color }}
              aria-label="Ver información"
            >
              i
            </button>
          )}
        </div>

        {/* Layout responsive: numero + donut */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="font-mono-display font-bold leading-none tracking-tight truncate"
              style={{
                color,
                fontSize: 'clamp(32px, 9vw, 52px)',
                textShadow: `0 0 40px color-mix(in srgb, ${color} 25%, transparent)`,
              }}
            >
              {display}
            </p>
            {sub && (
              <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>{sub}</p>
            )}
            {narrativa && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)` }}>
                <span>{narrativa}</span>
              </div>
            )}
          </div>

          {/* Donut meta diaria a la derecha (si hay meta) */}
          {metaDiaria && metaDiaria > 0 && (
            <div className="shrink-0 hidden sm:block">
              <DonutProgress
                value={typeof valueRaw === 'number' ? valueRaw : 0}
                max={metaDiaria}
                color={color}
                size={84}
                strokeWidth={8}
                label="Meta hoy"
              />
            </div>
          )}
        </div>

        {/* Donut version movil (debajo del numero) */}
        {metaDiaria && metaDiaria > 0 && (
          <div className="sm:hidden mt-4 flex items-center gap-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
            <DonutProgress
              value={typeof valueRaw === 'number' ? valueRaw : 0}
              max={metaDiaria}
              color={color}
              size={64}
              strokeWidth={6}
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Meta diaria</p>
              <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatCOP(metaDiaria)}</p>
            </div>
          </div>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4 -mx-1">
            <Sparkline data={sparklineData} color={color} height={36} ariaLabel="Tendencia 7 dias" />
            <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--color-text-muted)' }}>Últimos 7 días</p>
          </div>
        )}

        {hasInfo && showInfo && (
          <KpiInfoPopover info={info} color={color} onClose={() => setShowInfo(false)} />
        )}
      </div>
    </div>
  )
}

// Donut de progreso animado: anillo SVG con porcentaje en el centro.
function DonutProgress({ value = 0, max = 100, color = 'var(--color-success)', size = 90, strokeWidth = 9, label, sublabel }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const animatedPct = useCountUp(pct, 1000)
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const len = (animatedPct / 100) * circ

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Anillo de fondo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-bg-hover)"
            strokeWidth={strokeWidth}
          />
          {/* Anillo de progreso */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${len} ${circ}`}
            style={{
              transition: 'stroke-dasharray 0.05s linear',
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 50%, transparent))`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono-display font-bold leading-none" style={{ color, fontSize: size * 0.26 }}>
            {Math.round(animatedPct)}<span style={{ fontSize: size * 0.16 }}>%</span>
          </p>
        </div>
      </div>
      {label && (
        <p className="text-[11px] mt-2 font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      )}
      {sublabel && (
        <p className="text-[10px] mt-0.5 text-center" style={{ color: 'var(--color-text-muted)' }}>{sublabel}</p>
      )}
    </div>
  )
}

// Heatmap calendario tipo GitHub para los ultimos 30 dias.
function Heatmap30d({ data, color = '#34d399', label = 'Cobros últimos 30 días' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const cols = 10  // 10 columnas x 3 filas = 30 dias
  const cells = []
  for (let i = 0; i < 30; i++) {
    const v = data[i] || 0
    const intensity = max > 0 ? v / max : 0
    const opacity = v === 0 ? 0.06 : 0.18 + intensity * 0.82
    cells.push({ idx: i, valor: v, opacity, esHoy: i === 29 })
  }
  // Calcular max para tooltip context
  const totalMes = data.reduce((a, b) => a + b, 0)
  const promedio = totalMes / 30

  return (
    <div className="rounded-[16px] px-4 py-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
        <p className="text-[10px] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
          Promedio diario · <span style={{ color: 'var(--color-text-primary)' }}>{formatCOP(Math.round(promedio))}</span>
        </p>
      </div>
      <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cells.map((c) => (
          <div
            key={c.idx}
            className="heatmap-cell relative rounded-[4px] aspect-square"
            style={{
              background: c.esHoy
                ? `color-mix(in srgb, ${color} ${Math.max(40, c.opacity * 100)}%, transparent)`
                : `color-mix(in srgb, ${color} ${c.opacity * 100}%, transparent)`,
              border: c.esHoy ? `1.5px solid ${color}` : '1px solid color-mix(in srgb, var(--color-text-muted) 8%, transparent)',
              animationDelay: `${c.idx * 12}ms`,
            }}
            title={`Hace ${29 - c.idx} día${29 - c.idx === 1 ? '' : 's'}: ${formatCOP(c.valor)}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
        <span>Hace 30 días</span>
        <div className="flex items-center gap-1">
          <span>menos</span>
          {[0.1, 0.3, 0.55, 0.8, 1].map((op) => (
            <div key={op} className="w-2.5 h-2.5 rounded-[2px]" style={{ background: `color-mix(in srgb, ${color} ${op * 100}%, transparent)` }} />
          ))}
          <span>más</span>
        </div>
        <span>Hoy</span>
      </div>
    </div>
  )
}

// Genera narrativa contextual basada en datos. Da personalidad al dashboard.
function generarNarrativa({ recaudadoHoy, recaudadoAyer, cuotaDiaria, sparkline7d }) {
  if (!recaudadoHoy && !recaudadoAyer) return null

  // Comparativo vs ayer
  if (recaudadoAyer > 0) {
    const diff = recaudadoHoy - recaudadoAyer
    const pct = Math.round((diff / recaudadoAyer) * 100)
    if (pct > 15) return `Vas a buen ritmo: ${pct}% más que ayer`
    if (pct < -15) return `${Math.abs(pct)}% menos que ayer — toca empujar`
  }

  // Progreso vs cuota diaria
  if (cuotaDiaria > 0) {
    const pctMeta = (recaudadoHoy / cuotaDiaria) * 100
    if (pctMeta >= 100) return '¡Meta diaria cumplida!'
    if (pctMeta >= 75) return `Falta poco: $${formatCOP(cuotaDiaria - recaudadoHoy).replace('$', '')} para tu meta`
    if (pctMeta >= 40) return `Vas en ${Math.round(pctMeta)}% de tu meta del día`
  }

  // Mejor dia de la semana
  if (sparkline7d && sparkline7d.length === 7) {
    const maxIdx = sparkline7d.indexOf(Math.max(...sparkline7d))
    if (maxIdx === 6 && sparkline7d[6] > 0) return 'Tu mejor día de la semana'
  }

  return null
}

function KpiCard({ label, value, valueRaw, format = 'cop', sub, color = 'var(--color-text-primary)', icon, info }) {
  const [showInfo, setShowInfo] = useState(false)
  const hasInfo = Boolean(info)
  const openInfo = (e) => {
    if (!hasInfo) return
    e?.preventDefault?.()
    e?.stopPropagation?.()
    // Solo abrir, no toggle. Cerrar se maneja desde el modal (boton X, ESC, backdrop).
    if (!showInfo) setShowInfo(true)
  }
  // info puede ser string (legacy) o objeto { que, comoSeCalcula, cuandoCambia, ejemplo }
  const infoObj = typeof info === 'string' ? { que: info } : (info || {})

  // Count-up: si recibimos valueRaw numerico, animamos. Si no, mostramos value tal cual.
  const animatedNum = useCountUp(typeof valueRaw === 'number' ? valueRaw : (typeof value === 'number' ? value : 0), 700)
  const displayValue = (() => {
    if (valueRaw === undefined && typeof value !== 'number') return value
    const n = typeof valueRaw === 'number' ? animatedNum : animatedNum
    if (format === 'cop') return formatCOP(Math.round(n))
    return Math.round(n).toLocaleString('es-CO')
  })()
  return (
    <div
      onClick={openInfo}
      role={hasInfo ? 'button' : undefined}
      tabIndex={hasInfo ? 0 : undefined}
      onKeyDown={hasInfo ? (e) => { if (e.key === 'Enter' || e.key === ' ') openInfo(e) } : undefined}
      className={`rounded-[16px] px-4 py-4 relative group kpi-lift ${hasInfo ? 'cursor-pointer' : ''}`}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 10%, var(--color-bg-card)) 0%, var(--color-bg-card) 45%, var(--color-bg-card) 75%, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 100%)`,
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
          {hasInfo && (
            <span
              aria-hidden
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold pointer-events-none"
              style={{ background: `color-mix(in srgb, ${color} 25%, transparent)`, color }}
            >
              i
            </span>
          )}
        </div>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      <p className="text-xl font-bold leading-tight font-mono-display truncate" style={{ color }}>{displayValue}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      {hasInfo && showInfo && (
        <KpiInfoPopover info={infoObj} color={color} onClose={() => setShowInfo(false)} />
      )}
    </div>
  )
}

// Modal centrado renderizado via PORTAL al body — completamente independiente
// del card que lo abrio. Evita cascadas de eventos, parpadeos y problemas con
// overflow/transform de contenedores padre.
function KpiInfoPopover({ info, color, onClose }) {
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!portalReady || typeof document === 'undefined') return null

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Solo cerrar si el click fue en el backdrop, no en el contenido
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="relative w-full max-w-[640px] max-h-[85vh] overflow-y-auto rounded-[16px]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-base)',
          border: `1px solid color-mix(in srgb, ${color} 35%, var(--color-border))`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 80px color-mix(in srgb, ${color} 15%, transparent)`,
          animation: 'cardFadeUp 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Header con color del KPI */}
        <div
          className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
          style={{ background: `color-mix(in srgb, ${color} 12%, var(--color-bg-base))`, borderBottom: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
            <p className="text-[12px] font-bold uppercase tracking-wider truncate" style={{ color }}>{info.titulo || '¿Qué es?'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[18px] leading-none w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-hover)] shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Contenido en 2 columnas (desktop) o 1 (movil) */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-[12px] leading-relaxed">
          {info.que && (
            <div className="sm:col-span-2 rounded-[10px] px-3 py-2.5" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>¿Qué es?</p>
              <p style={{ color: 'var(--color-text-primary)' }}>{info.que}</p>
            </div>
          )}

          {info.comoSeCalcula && (
            <div className="rounded-[10px] px-3 py-2.5" style={{ background: 'var(--color-bg-hover)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Cómo se calcula</p>
              <p style={{ color: 'var(--color-text-secondary)' }}>{info.comoSeCalcula}</p>
            </div>
          )}

          {info.ejemplo && (
            <div className="rounded-[10px] px-3 py-2.5" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>Tu número ahora</p>
              <p style={{ color: 'var(--color-text-primary)' }}>{info.ejemplo}</p>
            </div>
          )}

          {info.cuandoCambia && (
            <div className="rounded-[10px] px-3 py-2.5 flex items-start gap-2" style={{ background: 'var(--color-bg-hover)' }}>
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--color-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Cuándo cambia</p>
                <p style={{ color: 'var(--color-text-secondary)' }}>{info.cuandoCambia}</p>
              </div>
            </div>
          )}

          {info.tip && (
            <div className="sm:col-span-2 rounded-[10px] px-3 py-2.5 flex items-start gap-2" style={{ background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)' }}>
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--color-warning)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-warning)' }}>Tip</p>
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{info.tip}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function RecaudoCard({ label, color, colorHex, monto, cantidad, cuotaDiaria, extraSub, info, montoAyer, sparklineData }) {
  const [showInfo, setShowInfo] = useState(false)
  const hasInfo = Boolean(info)
  const pct = cuotaDiaria > 0 ? Math.min(100, Math.round((monto / cuotaDiaria) * 100)) : null
  const animMonto = useCountUp(monto, 700)
  const openInfo = (e) => {
    if (!hasInfo) return
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!showInfo) setShowInfo(true)
  }
  return (
    <div
      onClick={openInfo}
      role={hasInfo ? 'button' : undefined}
      tabIndex={hasInfo ? 0 : undefined}
      onKeyDown={hasInfo ? (e) => { if (e.key === 'Enter' || e.key === ' ') openInfo(e) } : undefined}
      className={`rounded-[16px] px-4 py-4 relative kpi-lift ${hasInfo ? 'cursor-pointer' : ''}`}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 10%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 100%)`,
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
        {hasInfo && (
          <span
            aria-hidden
            className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold pointer-events-none"
            style={{ background: `color-mix(in srgb, ${colorHex} 25%, transparent)`, color: colorHex }}
          >
            i
          </span>
        )}
      </div>
      <p className="text-xl font-bold font-mono-display truncate" style={{ color }}>{formatCOP(Math.round(animMonto))}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cantidad} pagos {label.toLowerCase().includes('mes') ? 'en el mes' : 'registrados'}</p>
        {montoAyer !== undefined && montoAyer !== null && (
          <ComparativoChip actual={monto} anterior={montoAyer} />
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-2.5">
          <Sparkline data={sparklineData} color={colorHex} height={26} ariaLabel="Tendencia 7 dias" />
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Últimos 7 días</p>
        </div>
      )}
      {pct !== null && !sparklineData && (
        <>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
            <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{cuotaDiaria > 0 ? `${pct}% de la cuota diaria` : 'Sin cuotas esperadas'}</p>
        </>
      )}
      {pct !== null && sparklineData && (
        <>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
            <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{pct}% de la cuota diaria</p>
        </>
      )}
      {extraSub && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-danger)' }} />
          <p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>{extraSub}</p>
        </div>
      )}
      {hasInfo && showInfo && (
        <KpiInfoPopover info={info} color={colorHex} onClose={() => setShowInfo(false)} />
      )}
    </div>
  )
}

function RoutesCard({ value, sub }) {
  return (
    <KpiCard
      label="Rutas activas"
      value={value}
      valueRaw={value}
      format="int"
      sub={sub}
      color="#8b5cf6"
      info={{
        titulo: 'Rutas activas',
        que: 'Zonas o sectores de cobro que tienes habilitados. Cada ruta puede tener un cobrador asignado y sus propios clientes.',
        comoSeCalcula: 'Cuento las rutas marcadas como activas en tu organización.',
        ejemplo: `Tienes ${value} ${value === 1 ? 'ruta activa' : 'rutas activas'}. Los cobradores ven solo los clientes de las rutas que tienen asignadas.`,
        cuandoCambia: 'Sube cuando creas una ruta nueva. Baja si desactivas una ruta.',
        tip: 'Si tienes clientes "Sin ruta", asígnalos a una ruta para que el cobrador los pueda visitar.',
      }}
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" /></svg>}
    />
  )
}

function QuickLink({ href, label, desc, color, dataTour }) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className="rounded-[16px] px-4 py-4 transition-all duration-200 group flex items-center gap-3 hover:scale-[1.01]"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)`,
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 14px color-mix(in srgb, ${color} 18%, transparent)`; e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 25%, var(--color-border))` }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
    </Link>
  )
}

function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function saludoPorHora() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// Diferencia entre dos numeros para mostrar comparativo vs ayer
function ComparativoChip({ actual, anterior }) {
  if (anterior === undefined || anterior === null) return null
  const diff = actual - anterior
  if (Math.abs(diff) < 1) return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
      = vs ayer
    </span>
  )
  const positivo = diff > 0
  const color = positivo ? 'var(--color-success)' : 'var(--color-danger)'
  const arrow = positivo ? '↑' : '↓'
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-0.5" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
      <span>{arrow}</span>
      <span>{formatCOP(Math.abs(diff))}</span>
      <span style={{ opacity: 0.7 }}>vs ayer</span>
    </span>
  )
}

// Contenedor para agrupar KPIs por categoria (con titulo, opcion de colapsar)
function KpiGroup({ title, icon, children, defaultOpen = true, storageKey }) {
  // Persistir estado abierto/cerrado por grupo. La key se deriva del titulo si
  // no se pasa storageKey explicito. Asi recuerda la preferencia del usuario
  // entre recargas y entre dispositivos del mismo navegador.
  const key = storageKey || `cf-kpigroup:${title}`
  const [open, setOpen] = useState(defaultOpen)
  const [hydrated, setHydrated] = useState(false)

  // Hidratar desde localStorage despues del primer render (evita hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) setOpen(stored === '1')
    } catch {}
    setHydrated(true)
  }, [key])

  const toggle = () => {
    setOpen(v => {
      const next = !v
      try { localStorage.setItem(key, next ? '1' : '0') } catch {}
      return next
    })
  }

  // Hasta hidratar, usar defaultOpen para evitar flash visual
  const isOpen = hydrated ? open : defaultOpen

  return (
    <div
      className="rounded-[16px]"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        onClick={toggle}
        className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 transition-colors hover:bg-[var(--color-bg-hover)] rounded-t-[16px] ${isOpen ? '' : 'rounded-b-[16px]'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)', color: 'var(--color-text-secondary)' }}>
            {icon}
          </div>
          <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{title}</h2>
        </div>
        <svg className={`w-4 h-4 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--color-text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

// Iconos para grupos
const Icons = {
  dinero: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cartera: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  clientes: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  operacion: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  cobros: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  actividad: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alerta: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  prestamoOut: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
    </svg>
  ),
  pagoIn: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m-6 6l3-3m0 0l3 3m-3-3v6.75" />
    </svg>
  ),
  retiro: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19.5V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v13.5m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 19.5m-18 0V12m18 7.5V12m0 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0V9.75A2.25 2.25 0 0018.75 7.5H5.25A2.25 2.25 0 003 9.75V12" />
    </svg>
  ),
  gasto: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
}

// Tarjeta resumen "Lo que paso hoy" con desglose por cobrador
function ResumenDelDia({ actividad, esOwner }) {
  if (!actividad) return null
  const { pagos, prestamos, gastos, retiros, inyecciones, desgloseCobradores } = actividad
  const items = []
  if (pagos.cantidad > 0) items.push({
    icon: Icons.pagoIn,
    color: 'var(--color-success)',
    text: `${pagos.cantidad} ${pagos.cantidad === 1 ? 'pago' : 'pagos'}`,
    monto: formatCOP(pagos.monto),
  })
  if (prestamos.cantidad > 0) items.push({
    icon: Icons.prestamoOut,
    color: '#f59e0b',
    text: `${prestamos.cantidad} ${prestamos.cantidad === 1 ? 'préstamo entregado' : 'préstamos entregados'}`,
    monto: formatCOP(prestamos.monto),
  })
  if (esOwner && gastos && gastos.cantidad > 0) items.push({
    icon: Icons.gasto,
    color: 'var(--color-warning)',
    text: `${gastos.cantidad} ${gastos.cantidad === 1 ? 'gasto' : 'gastos'}`,
    monto: formatCOP(gastos.monto),
  })
  if (esOwner && retiros && retiros.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--color-danger)',
    text: 'Retiro de caja',
    monto: formatCOP(retiros.monto),
  })
  if (esOwner && inyecciones && inyecciones.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--color-success)',
    text: 'Inyección de capital',
    monto: formatCOP(inyecciones.monto),
  })

  const sinMovimientos = items.length === 0 && (!desgloseCobradores || desgloseCobradores.length === 0)

  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
          {Icons.actividad}
        </div>
        <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Movimientos de hoy</h2>
      </div>
      <div className="px-4 py-3">
        {sinMovimientos && (
          <p className="text-[12px] text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
            Aún no hay movimientos registrados hoy
          </p>
        )}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${it.color} 15%, transparent)`, color: it.color }}>
                    {it.icon}
                  </div>
                  <span className="text-[13px] truncate" style={{ color: 'var(--color-text-primary)' }}>{it.text}</span>
                </div>
                <span className="text-[13px] font-bold font-mono-display shrink-0" style={{ color: it.color }}>{it.monto}</span>
              </div>
            ))}
          </div>
        )}
        {esOwner && desgloseCobradores && desgloseCobradores.length > 0 && (
          <div className={`${items.length > 0 ? 'mt-3 pt-3 border-t' : ''}`} style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{Icons.clientes}</span>
              Por cobrador
            </p>
            <div className="space-y-1.5">
              {desgloseCobradores.map((c) => (
                <div key={c.cobradorId || 'sin'} className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{c.nombre}</span>
                  <span className="font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{c.pagos} pagos</span>
                    <span className="mx-1.5" style={{ color: 'var(--color-text-muted)' }}>·</span>
                    <span style={{ color: 'var(--color-success)' }}>{formatCOP(c.monto)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Sección "Necesita tu atención" con alertas accionables
function NecesitaAtencion({ alertas, moraData }) {
  if (!alertas) return null
  const items = []
  const mora30 = moraData?.agrupado?.mora31plus?.length ?? 0
  if (mora30 > 0) items.push({
    color: 'var(--color-danger)',
    text: `${mora30} ${mora30 === 1 ? 'cliente con más de 30 días de mora' : 'clientes con más de 30 días de mora'}`,
    href: '/clientes?filtro=mora',
  })
  if (alertas.clientesSinRuta > 0) items.push({
    color: 'var(--color-warning)',
    text: `${alertas.clientesSinRuta} ${alertas.clientesSinRuta === 1 ? 'cliente sin ruta asignada' : 'clientes sin ruta asignada'}`,
    href: '/clientes',
  })
  if (alertas.prestamosSinPagosLargo > 0) items.push({
    color: 'var(--color-warning)',
    text: `${alertas.prestamosSinPagosLargo} ${alertas.prestamosSinPagosLargo === 1 ? 'préstamo sin pagos hace más de 7 días' : 'préstamos sin pagos hace más de 7 días'}`,
    href: '/prestamos',
  })

  if (items.length === 0) return null

  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-border))',
      }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)' }}>
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-warning) 18%, transparent)', color: 'var(--color-warning)' }}>
          {Icons.alerta}
        </div>
        <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-warning)' }}>Necesita tu atención</h2>
      </div>
      <div className="px-2 py-1">
        {items.map((it, i) => (
          <Link key={i} href={it.href} className="flex items-center justify-between gap-2 py-2 px-2 rounded-[8px] transition-colors hover:bg-[var(--color-bg-hover)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: it.color }} />
              <span className="text-[12px] truncate" style={{ color: 'var(--color-text-primary)' }}>{it.text}</span>
            </div>
            <span className="text-[11px] shrink-0 font-medium" style={{ color: it.color }}>Ver →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { session, loading: authLoading, esOwner, puedeCrearClientes, puedeCrearPrestamos } = useAuth()

  const [data, setData] = useState(null)
  const [moraData, setMoraData] = useState(undefined)
  const [capitalData, setCapitalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [fechaActual, setFechaActual] = useState('')
  const [horaActual, setHoraActual] = useState('')
  const [actualizadoEn, setActualizadoEn] = useState(null)
  // Vista simple = solo lo esencial (Cobros + Tu dinero). Vista pro = todo.
  const [vistaSimple, setVistaSimple] = useState(false)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cf-dashboard-vista')
      if (stored === 'simple') setVistaSimple(true)
    } catch {}
  }, [])
  const toggleVista = () => {
    setVistaSimple(v => {
      const next = !v
      try { localStorage.setItem('cf-dashboard-vista', next ? 'simple' : 'pro') } catch {}
      return next
    })
  }

  const { syncMeta, startBulkSync, bulkSyncing, bulkProgress, lastSyncedAt } = useOffline()
  const onboarding = useOnboarding(authLoading ? null : esOwner)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setFechaActual(now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }))
      setHoraActual(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = useCallback(async () => {
    setIsOffline(false)
    // Offline real: leer de IndexedDB directamente
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache('dashboard:resumen')
        if (!cached) cached = await obtenerDashboardOffline()
        if (cached) { setData(cached); setIsOffline(true); setLoading(false); return }
      } catch {}
    }
    try {
      // Cache-buster: evita que el navegador o cualquier intermediario reuse
      // una respuesta vieja. Combinado con Cache-Control: no-store en la API,
      // garantiza que cada carga del dashboard sea fresca.
      const r = await fetch(`/api/dashboard/resumen?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const d = await r.json()
      if (d.error) setError(d.error)
      else if (d.offline) throw new Error('offline')
      else {
        setData(d)
        setActualizadoEn(d.generatedAt || new Date().toISOString())
        setError('')
        guardarEnCache('dashboard:resumen', d).catch(() => {})
      }
    } catch {
      try {
        let cached = await leerDeCache('dashboard:resumen')
        if (!cached) cached = await obtenerDashboardOffline()
        if (cached) { setData(cached); setIsOffline(true); return }
      } catch {}
      setError('No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMora = useCallback(async () => {
    try {
      const r = await fetch(`/api/mora?t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      setMoraData(d)
      guardarEnCache('dashboard:mora', d).catch(() => {})
    } catch {
      try {
        const cached = await leerDeCache('dashboard:mora')
        if (cached) { setMoraData(cached); return }
      } catch {}
      setMoraData({ total: 0, agrupado: {} })
    }
  }, [])

  const loadCapital = useCallback(async () => {
    try {
      const r = await fetch(`/api/capital/resumen?t=${Date.now()}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.configurado) {
        setCapitalData(d)
        guardarEnCache('dashboard:capital', d).catch(() => {})
      }
    } catch {
      try {
        const cached = await leerDeCache('dashboard:capital')
        if (cached) setCapitalData(cached)
      } catch {}
    }
  }, [])

  // Refrescar cuando el usuario vuelve a la pestaña/app despues de tenerla en
  // segundo plano. Sin esto, KPIs se quedan congelados con el snapshot inicial.
  const refreshAll = useCallback(() => {
    loadDashboard()
    loadMora()
    if (esOwner) loadCapital()
  }, [loadDashboard, loadMora, loadCapital, esOwner])

  useEffect(() => { loadDashboard() }, [loadDashboard, lastSyncedAt])
  useEffect(() => { loadMora() }, [loadMora, lastSyncedAt])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll() }
    const onFocus = () => refreshAll()
    const onOnline = () => refreshAll()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [refreshAll])

  useEffect(() => {
    if (authLoading || !esOwner) return
    loadCapital()
  }, [authLoading, esOwner, loadCapital])

  const moraPct = data ? (data.clientes.total > 0 ? Math.round((data.clientes.enMora / data.clientes.total) * 100) : 0) : 0

  // Wizard: full-screen takeover for brand-new users
  if (onboarding.showWizard && esOwner) {
    return (
      <div className="max-w-3xl mx-auto">
        <OnboardingWizard
          nombre={session?.user?.nombre || session?.user?.name}
          initialStep={onboarding.wizardInitialStep}
          onComplete={() => {
            onboarding.dismiss()
            window.location.reload()
          }}
          onDismiss={() => {
            onboarding.dismiss()
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {onboarding.visible && (
        <OnboardingChecklist
          misiones={onboarding.misiones}
          completadas={onboarding.completadas}
          total={onboarding.total}
          progreso={onboarding.progreso}
          onDismiss={onboarding.dismiss}
          onSpotlight={onboarding.showSpotlight}
        />
      )}
      {!authLoading && !esOwner && session?.user?.id && (
        <CobradorOnboarding userId={session.user.id} />
      )}
      <SpotlightOverlay
        spotlight={onboarding.spotlight}
        onClose={onboarding.hideSpotlight}
      />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {saludoPorHora()}{session?.user?.nombre ? `, ${session.user.nombre.split(' ')[0]}` : ''}
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {fechaActual || 'Resumen de tu cartera hoy'}
              {horaActual && <span className="font-mono-display ml-1.5" style={{ color: 'var(--color-accent)' }}>{horaActual}</span>}
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={refreshAll}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              title="Actualizar datos"
              aria-label="Actualizar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>
        {actualizadoEn && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Actualizado {new Date(actualizadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
            </p>
            <CacheAge compact />
          </div>
        )}
      </div>
      {isOffline && (
        <div className="text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--color-warning-dim)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', color: 'var(--color-warning)' }}>
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--color-warning)' }} />
          Datos guardados — sin conexión
        </div>
      )}
      {error && <div className="text-sm rounded-[12px] px-4 py-3" style={{ background: 'var(--color-danger-dim)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>{error}</div>}

      {loading || !mounted ? (
        <div className="space-y-3">
          <KpiGroupSkeleton kpis={2} />
          <KpiGroupSkeleton kpis={2} />
          <KpiGroupSkeleton kpis={2} />
        </div>
      ) : data && (
        <>
          {/* HERO: Recaudado hoy en grande con narrativa + donut de meta integrado */}
          <HeroCard
            label="Recaudado hoy"
            valueRaw={data.cobros.hoy}
            value={formatCOP(data.cobros.hoy)}
            sub={`${data.cobros.cantidadHoy} ${data.cobros.cantidadHoy === 1 ? 'pago registrado' : 'pagos registrados'}${data.cobros.ayer ? ` · ayer ${formatCOP(data.cobros.ayer)}` : ''}`}
            color="#22c55e"
            accent="#10b981"
            narrativa={generarNarrativa({
              recaudadoHoy: data.cobros.hoy,
              recaudadoAyer: data.cobros.ayer,
              cuotaDiaria: data.prestamos.cuotaDiariaTotal,
              sparkline7d: data.cobros.sparkline7d,
            })}
            sparklineData={data.cobros.sparkline7d}
            metaDiaria={data.prestamos.cuotaDiariaTotal}
            info={{
              titulo: 'Recaudado hoy',
              que: 'Total de dinero que has cobrado HOY (en hora Colombia, desde la medianoche).',
              comoSeCalcula: 'Sumo todos los pagos registrados hoy de tipo "completo", "parcial" y "capital". No cuento recargos ni descuentos.',
              ejemplo: `Llevas ${formatCOP(data.cobros.hoy)} cobrados en ${data.cobros.cantidadHoy} pagos hoy. ${data.prestamos.cuotaDiariaTotal > 0 ? `Eso es el ${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de tu meta diaria de ${formatCOP(data.prestamos.cuotaDiariaTotal)}.` : ''}${data.cobros.ayer ? ` Ayer cobraste ${formatCOP(data.cobros.ayer)} en ${data.cobros.cantidadAyer} pagos.` : ''}`,
              cuandoCambia: 'Sube cada vez que se registra un pago. Se reinicia a $0 a la medianoche (hora Colombia).',
              tip: 'El sparkline muestra los últimos 7 días. La etiqueta "vs ayer" compara con el día anterior completo.',
            }}
          />

          {/* Recaudado del mes — card normal con datos enriquecidos */}
          <RecaudoCard
            label="Recaudado este mes"
            color="var(--color-accent)"
            colorHex="#f5c518"
            monto={data.cobros.mes}
            cantidad={data.cobros.cantidadMes}
            extraSub={data.clientes.enMora > 0 ? `${moraPct}% de clientes en mora` : null}
            info={{
              titulo: 'Recaudado este mes',
              que: 'Total cobrado en lo que va del mes actual (desde el día 1 hasta hoy).',
              comoSeCalcula: 'Sumo todos los pagos del mes en curso, excluyendo recargos y descuentos.',
              ejemplo: `Has cobrado ${formatCOP(data.cobros.mes)} en ${data.cobros.cantidadMes} pagos este mes. Promedio por día: ${formatCOP(Math.round(data.cobros.mes / Math.max(1, new Date().getDate())))}.`,
              cuandoCambia: 'Sube cada vez que se registra un pago. Se reinicia a $0 el día 1 de cada mes.',
              tip: 'Compara este número con el mes pasado para ver si tu cobro está creciendo.',
            }}
          />

          {/* Tu dinero — Saldo y Patrimonio (solo owner) */}
          {esOwner && (capitalData || data.finanzas) && (
            <KpiGroup title="Tu dinero" icon={Icons.dinero}>
              <div className="grid grid-cols-2 gap-3">
                {capitalData && (
                  <KpiCard
                    label="Saldo disponible"
                    value={formatCOP(capitalData.saldo)}
                    valueRaw={capitalData.saldo}
                    sub={capitalData.saldo < 0 ? 'Capital insuficiente' : 'Capital en caja'}
                    color={capitalData.saldo < 0 ? '#ef4444' : '#06b6d4'}
                    info={{
                      titulo: 'Saldo disponible',
                      que: 'El EFECTIVO que tienes en caja en este momento. Plata real disponible para prestar, retirar o cubrir gastos.',
                      comoSeCalcula: 'Capital inicial + cobros recibidos − desembolsos de préstamos − gastos − retiros + inyecciones.',
                      ejemplo: `Tienes ${formatCOP(capitalData.saldo)} en caja ahora mismo. ${capitalData.saldo < 0 ? '⚠️ Tu saldo está en negativo: revisa si registraste todos los movimientos correctamente.' : 'Con esto puedes desembolsar nuevos préstamos o retirar utilidades.'}`,
                      cuandoCambia: 'SUBE: cobros e inyecciones de capital. BAJA: desembolsos de préstamos nuevos, gastos, retiros.',
                      tip: 'Si vas a hacer un préstamo grande, verifica que tengas suficiente saldo aquí antes.',
                    }}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
                  />
                )}
                {data.finanzas && (
                  <KpiCard
                    label="Patrimonio"
                    value={formatCOP(data.finanzas.patrimonio)}
                    valueRaw={data.finanzas.patrimonio}
                    sub={`Caja + por cobrar - gastos`}
                    color="#10b981"
                    info={{
                      titulo: 'Patrimonio',
                      que: 'Tu foto financiera completa hoy. Cuánto vale tu negocio sumando todo lo que tienes y te deben, menos lo gastado este mes.',
                      comoSeCalcula: `Saldo en caja (${formatCOP(data.finanzas.cajaDisponible)}) + Por cobrar real (${formatCOP(data.prestamos.saldoPorCobrar)}) − Gastos del mes (${formatCOP(data.finanzas.gastosMes)}) = ${formatCOP(data.finanzas.patrimonio)}.`,
                      ejemplo: `Tu negocio vale ${formatCOP(data.finanzas.patrimonio)} hoy. Esto incluye lo que tienes en caja, lo que te deben los clientes, y descontando los gastos del mes en curso.`,
                      cuandoCambia: 'Se mueve con CADA acción: pagos recibidos, préstamos nuevos, gastos, retiros, todo.',
                      tip: 'Es el indicador más completo de cómo está tu negocio. Compáralo mes a mes para ver si estás creciendo.',
                    }}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>}
                  />
                )}
              </div>
            </KpiGroup>
          )}

          {/* Toggle "Mostrar mas / menos KPIs" — sutil, contextual */}
          <button
            onClick={toggleVista}
            className="w-full rounded-[12px] py-2.5 px-4 flex items-center justify-center gap-2 transition-colors hover:bg-[var(--color-bg-hover)]"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            title={vistaSimple ? 'Ver más métricas' : 'Mostrar solo lo esencial'}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${vistaSimple ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-[11px] font-medium">{vistaSimple ? 'Ver más métricas' : 'Mostrar solo lo esencial'}</span>
          </button>

          {/* Tu cartera — Cartera activa, Por cobrar */}
          {!vistaSimple && (
          <KpiGroup title="Tu cartera" icon={Icons.cartera}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Cartera activa"
                value={formatCOP(data.prestamos.carteraActiva)}
                valueRaw={data.prestamos.carteraActiva}
                sub={`Capital: ${formatCOP(data.prestamos.capitalPrestado)}`}
                color="#f59e0b"
                info={{
                  titulo: 'Cartera activa',
                  que: 'Todo el dinero que tus clientes te van a pagar EN TOTAL (capital + intereses) cuando terminen sus préstamos. Es como una "promesa de cobro" futura.',
                  comoSeCalcula: `Sumo el "Total a pagar" de todos los préstamos activos. Capital prestado: ${formatCOP(data.prestamos.capitalPrestado)} + Intereses por ganar: ${formatCOP(data.prestamos.carteraActiva - data.prestamos.capitalPrestado)} = ${formatCOP(data.prestamos.carteraActiva)}.`,
                  ejemplo: `Vas a recibir ${formatCOP(data.prestamos.carteraActiva)} cuando todos terminen de pagar. De eso, ${formatCOP(data.prestamos.capitalPrestado)} es lo que prestaste y ${formatCOP(data.prestamos.carteraActiva - data.prestamos.capitalPrestado)} es tu ganancia por intereses.`,
                  cuandoCambia: 'Solo cambia cuando creas un préstamo nuevo (sube) o un préstamo se completa/cancela (baja). NO baja con los pagos diarios.',
                  tip: '¿Quieres ver cuánto te falta cobrar? Mira "Por cobrar" — ese sí baja con cada pago.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
              />
              {data.prestamos.saldoPorCobrar !== undefined && (
                <KpiCard
                  label="Por cobrar"
                  value={formatCOP(data.prestamos.saldoPorCobrar)}
                  valueRaw={data.prestamos.saldoPorCobrar}
                  sub="Saldo pendiente real"
                  color="#0ea5e9"
                  info={{
                    titulo: 'Por cobrar',
                    que: 'Lo que REALMENTE te falta cobrar HOY de todos tus préstamos activos.',
                    comoSeCalcula: `Cartera activa (${formatCOP(data.prestamos.carteraActiva)}) MENOS lo que ya te han pagado tus clientes (${formatCOP(data.prestamos.carteraActiva - data.prestamos.saldoPorCobrar)}) = ${formatCOP(data.prestamos.saldoPorCobrar)}.`,
                    ejemplo: `Te faltan ${formatCOP(data.prestamos.saldoPorCobrar)} por cobrar. Ya has cobrado ${formatCOP(data.prestamos.carteraActiva - data.prestamos.saldoPorCobrar)} del total prometido.`,
                    cuandoCambia: 'Baja cada vez que un cliente te paga. Sube cuando creas un préstamo nuevo.',
                    tip: 'Este es el indicador real de "deuda pendiente". El más útil para saber cómo va tu cobro día a día.',
                  }}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>}
                />
              )}
            </div>
          </KpiGroup>
          )}

          {/* Tus clientes — Clientes activos, Préstamos activos */}
          {!vistaSimple && (
          <KpiGroup title="Tus clientes" icon={Icons.clientes}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Clientes activos"
                value={data.clientes.total}
                valueRaw={data.clientes.total}
                format="int"
                sub={data.clientes.enMora > 0 ? `${data.clientes.enMora} en mora` : 'Sin mora'}
                color="#f5c518"
                info={{
                  titulo: 'Clientes activos',
                  que: 'Personas que tienen al menos un préstamo vigente (sin terminar de pagar) en este momento.',
                  comoSeCalcula: 'Cuento cada cliente con préstamos en estado "activo". Los que tienen varios préstamos solo cuentan una vez.',
                  ejemplo: `Tienes ${data.clientes.total} clientes activos. ${data.clientes.enMora > 0 ? `De esos, ${data.clientes.enMora} están atrasados con sus pagos (en mora).` : 'Todos están al día con sus pagos.'}`,
                  cuandoCambia: 'Sube cuando creas un préstamo a un cliente nuevo. Baja cuando un cliente termina de pagar todos sus préstamos.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
              />
              <KpiCard
                label="Prestamos activos"
                value={data.prestamos.activos}
                valueRaw={data.prestamos.activos}
                format="int"
                sub={`${data.prestamos.completados} completados`}
                color="#22c55e"
                info={{
                  titulo: 'Préstamos activos',
                  que: 'Préstamos vigentes que aún no se han pagado completamente.',
                  comoSeCalcula: 'Cuento todos los préstamos en estado "activo". Un cliente puede tener varios préstamos al mismo tiempo.',
                  ejemplo: `Tienes ${data.prestamos.activos} préstamos en la calle. Históricamente has completado ${data.prestamos.completados} préstamos exitosos.`,
                  cuandoCambia: 'Sube cuando creas un préstamo nuevo. Baja cuando un préstamo se completa (saldo $0) o se cancela.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
              />
            </div>
          </KpiGroup>
          )}

          {/* Operación — Cuota diaria, Rutas (colapsado por defecto) */}
          {!vistaSimple && (
          <KpiGroup title="Operación" icon={Icons.operacion} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Cuota diaria total"
                value={formatCOP(data.prestamos.cuotaDiariaTotal)}
                valueRaw={data.prestamos.cuotaDiariaTotal}
                sub="Esperado por dia"
                color="#a855f7"
                info={{
                  titulo: 'Cuota diaria total',
                  que: 'Lo que DEBERÍAS cobrar en un día normal si todos tus clientes pagaran su cuota del día sin atrasos.',
                  comoSeCalcula: 'Sumo la cuota diaria pactada de cada préstamo activo (la cuota que cada cliente debe pagar todos los días según su frecuencia).',
                  ejemplo: `Tu meta diaria es ${formatCOP(data.prestamos.cuotaDiariaTotal)}. Si cobraste menos hoy, tienes mora acumulándose. Si cobraste más, hay clientes adelantando pagos.`,
                  cuandoCambia: 'Cambia cuando creas un préstamo nuevo, cuando uno se completa, o cuando ajustas la cuota de un préstamo.',
                  tip: 'Compara este número con "Recaudado hoy" para saber qué % de tu meta diaria cumpliste.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
              />
              <RoutesCard
                value={data.rutas?.activas ?? 0}
                sub={esOwner ? 'Rutas habilitadas en la organización' : 'Rutas activas asignadas al equipo'}
              />
            </div>
          </KpiGroup>
          )}

          {/* Movimientos de hoy: resumen narrativo + desglose por cobrador */}
          {data.actividadHoy && (
            <ResumenDelDia actividad={data.actividadHoy} esOwner={esOwner} />
          )}

          {/* Necesita tu atencion: alertas accionables al final (solo owner) */}
          {esOwner && data.alertas && (
            <NecesitaAtencion alertas={data.alertas} moraData={moraData} />
          )}
        </>
      )}
      {(loading || !mounted) ? <Skeleton className="h-44" /> : data && data.ultimosPagos.length > 0 && (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Últimos pagos</p>
            <Link href="/prestamos" className="text-[11px] hover:underline" style={{ color: 'var(--color-accent)' }}>Ver todos →</Link>
          </div>
          <div className="space-y-0 divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5" style={{ borderTopColor: 'var(--color-border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.cliente}</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold shrink-0 ml-3 font-mono-display" style={{ color: 'var(--color-success)' }}>+{formatCOP(p.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && mounted && moraData !== undefined && moraData.total > 0 && (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--color-danger) 12%, transparent)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Alertas de mora</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-danger)', color: 'var(--color-text-primary)' }}>{moraData.total} clientes</span>
          </div>
          <div className="space-y-2">
            {moraData.agrupado.mora31plus.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-danger) 18%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-danger)' }}>Más de 30 días ({moraData.agrupado.mora31plus.length})</p>
                {moraData.agrupado.mora31plus.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-danger)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora16a30.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-warning) 18%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-warning)' }}>16-30 días ({moraData.agrupado.mora16a30.length})</p>
                {moraData.agrupado.mora16a30.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora8a15.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-accent)' }}>8-15 días ({moraData.agrupado.mora8a15.length})</p>
                {moraData.agrupado.mora8a15.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-accent)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora1a7.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-success)' }}>1-7 días ({moraData.agrupado.mora1a7.length})</p>
                {moraData.agrupado.mora1a7.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-success)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-success)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Offline sync status indicator */}
      {syncMeta && !bulkSyncing && !bulkProgress && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Datos offline: {syncMeta.totalClientes} clientes, {syncMeta.totalPrestamos} prestamos
                <span> · </span>
                {new Date(syncMeta.syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
              </p>
            </div>
            <button onClick={startBulkSync} className="text-[10px] transition-colors shrink-0 hover:text-[var(--color-success)]" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {bulkSyncing && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)' }}>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[11px]" style={{ color: 'var(--color-success)' }}>{bulkProgress?.message || 'Sincronizando datos...'}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>Accesos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {puedeCrearClientes && <QuickLink href="/clientes/nuevo" label="Nuevo cliente" desc="Registrar cliente" color="#f5c518" dataTour="nuevo-cliente" />}
          {puedeCrearPrestamos && <QuickLink href="/prestamos/nuevo" label="Nuevo prestamo" desc="Crear prestamo" color="#22c55e" dataTour="nuevo-prestamo" />}
          <QuickLink href="/caja" label="Cierre de caja" desc="Registrar cierre del dia" color="#f59e0b" dataTour="caja" />
          <QuickLink href="/clientes" label="Clientes" desc="Ver cartera completa" color="#a855f7" dataTour="prestamos" />
          {esOwner && <QuickLink href="/capital" label="Capital" desc="Control de capital" color="#06b6d4" />}
          {esOwner && <QuickLink href="/rutas" label="Rutas" desc="Gestionar rutas" color="#8b5cf6" dataTour="rutas" />}
          {esOwner && <QuickLink href="/configuracion" label="Configuracion" desc="Perfil y organizacion" color="#555555" />}
        </div>
      </div>
    </div>
  )
}
