'use client'
import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { guardarEnCache, leerDeCache, obtenerDashboardOffline } from '@/lib/offline'
import { useOffline } from '@/components/providers/OfflineProvider'
import { useOnboarding } from '@/components/onboarding/useOnboarding'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import CacheAge from '@/components/offline/CacheAge'

// Carga diferida — solo se descargan si el usuario los necesita
const OnboardingWizard    = dynamic(() => import('@/components/onboarding/OnboardingWizard'),    { ssr: false })
const SpotlightOverlay    = dynamic(() => import('@/components/onboarding/SpotlightOverlay'),    { ssr: false })
const CobradorOnboarding  = dynamic(() => import('@/components/onboarding/CobradorOnboarding'),  { ssr: false })
const DashboardAiTip      = dynamic(() => import('@/components/dashboard/DashboardAiTip'),       { ssr: false })
const MonedaCF            = dynamic(() => import('@/components/ui/MonedaCF'),                    { ssr: false })

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

// Sparkline interactivo con SVG. Cada dia es un punto clickable/hoverable
// que muestra el monto y la fecha. El ultimo dia (hoy) se destaca con un
// anillo brillante. La linea NO usa preserveAspectRatio=none para no
// deformar el grosor del trazo.
function Sparkline({ data, color = 'var(--color-success)', ariaLabel, etiquetasDias, mutedColor, tooltipBg, tooltipText }) {
  const reactId = useId()
  // hovered = mouse desktop (se va al salir). pinned = touch movil (queda fijo).
  const [hovered, setHovered] = useState(null)
  const [pinned, setPinned] = useState(null)
  const containerRef = useRef(null)
  const [width, setWidth] = useState(300)

  // Medir ancho real del contenedor para que el SVG no se deforme
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Cerrar pinned al tocar fuera del sparkline
  useEffect(() => {
    if (pinned === null) return
    const closeOnOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPinned(null)
      }
    }
    // Esperamos un tick para que el evento que abrio el pin no lo cierre inmediato
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', closeOnOutside)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [pinned])

  if (!data || data.length === 0) return null

  const h = 56
  const w = width
  const padX = 12
  const padTop = 6
  const padBot = 14
  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min || 1
  const innerW = Math.max(1, w - padX * 2)
  const innerH = h - padTop - padBot

  const points = data.map((v, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * innerW
    const y = padTop + innerH - ((v - min) / range) * innerH
    return [x, y, v]
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1][0]},${h - padBot + 2} L${points[0][0]},${h - padBot + 2} Z`
  const gradId = `spark-${reactId.replace(/:/g, '')}`

  // Etiquetas por defecto: dia de la semana abreviado (lun, mar, mie...) terminando en hoy
  const dias = etiquetasDias || (() => {
    const out = []
    const hoy = new Date()
    for (let i = data.length - 1; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() - i)
      out.push(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'America/Bogota' }))
    }
    return out
  })()

  // pinned tiene prioridad sobre hovered (si esta fijo por touch, se queda)
  const activeIdx = pinned !== null ? pinned : hovered
  const activePoint = activeIdx !== null ? points[activeIdx] : null

  return (
    <div ref={containerRef} className="relative w-full select-none" aria-label={ariaLabel}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area + linea */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Linea vertical guia cuando hay hover */}
        {activePoint && (
          <line
            x1={activePoint[0]}
            x2={activePoint[0]}
            y1={padTop}
            y2={h - padBot + 2}
            stroke={color}
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        {/* Puntos por dia */}
        {points.map(([x, y, v], i) => {
          const esHoy = i === points.length - 1
          const esActive = i === activeIdx
          return (
            <g key={i}>
              {/* Halo del dia activo (siempre visible si es hoy) */}
              {(esHoy || esActive) && (
                <circle cx={x} cy={y} r={esActive ? 7 : 5} fill={color} fillOpacity={esActive ? 0.25 : 0.18} />
              )}
              {/* Punto */}
              <circle
                cx={x}
                cy={y}
                r={esActive ? 4 : (esHoy ? 3.2 : 2)}
                fill={esHoy || esActive ? color : (tooltipBg || 'var(--color-bg-card)')}
                stroke={color}
                strokeWidth={esHoy || esActive ? 1.5 : 1.2}
                style={{ transition: 'r 0.15s ease' }}
              />
              {/* Hit area invisible mas grande. Mouse usa hover, touch fija (pinned). */}
              <circle
                cx={x}
                cy={y}
                r={Math.max(14, innerW / data.length / 2)}
                fill="transparent"
                style={{ cursor: 'pointer', touchAction: 'manipulation' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onPointerDown={(e) => {
                  // Solo touch/pen fijan. Mouse ya esta cubierto por hover.
                  if (e.pointerType === 'mouse') return
                  e.stopPropagation()
                  // Toggle: si ya esta fijo en este punto, lo quita
                  setPinned(prev => prev === i ? null : i)
                }}
              />
            </g>
          )
        })}

        {/* Etiquetas debajo */}
        {points.map(([x], i) => {
          const esHoy = i === points.length - 1
          const esExt = i === 0 || esHoy
          if (!esExt) return null
          return (
            <text
              key={i}
              x={x}
              y={h - 2}
              fontSize="9"
              textAnchor={i === 0 ? 'start' : 'end'}
              fill={esHoy ? color : (mutedColor || 'var(--color-text-muted)')}
              style={{ fontWeight: esHoy ? 600 : 400 }}
            >
              {esHoy ? 'Hoy' : 'Hace 6d'}
            </text>
          )
        })}
      </svg>

      {/* Tooltip flotante con monto y dia */}
      {activePoint && (
        <div
          className="absolute pointer-events-none rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap"
          style={{
            left: `${activePoint[0]}px`,
            top: `${activePoint[1] - 8}px`,
            transform: 'translate(-50%, -100%)',
            background: tooltipBg || 'var(--color-bg-base)',
            border: `1px solid color-mix(in srgb, ${color} 35%, ${tooltipBg ? 'rgba(0,0,0,0.2)' : 'var(--color-border)'})`,
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
            zIndex: 10,
          }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: tooltipBg ? 'rgba(245, 197, 24, 0.6)' : (mutedColor || 'var(--color-text-muted)') }}>{dias[activeIdx]}</p>
          <p className="font-mono-display font-bold" style={{ color: tooltipText || color }}>{formatMoney(activePoint[2])}</p>
        </div>
      )}
    </div>
  )
}

// Hero card: la tarjeta dorada de marca (color-block). Numero grande en tinta
// oscura sobre dorado, donut de meta integrado. Sin skeuomorfismo.
const HERO_GRAD  = 'linear-gradient(135deg, #f9d64a 0%, #f5c518 55%, #eab308 100%)'
const HERO_INK   = '#231a04'
const HERO_SUB   = 'rgba(35, 26, 4, 0.62)'
const HERO_TRACK = 'rgba(35, 26, 4, 0.16)'
const HERO_GLOSS = 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 58%)'

function HeroCard({ label, value, valueRaw, sub, color = '#10b981', accent = '#34d399', narrativa, sparklineData, metaDiaria, info }) {
  const animatedNum = useCountUp(typeof valueRaw === 'number' ? valueRaw : 0, 900)
  const [showInfo, setShowInfo] = useState(false)
  const hasInfo = Boolean(info)
  const display = typeof valueRaw === 'number' ? formatMoney(Math.round(animatedNum)) : value

  return (
    <div
      className="cf-hero-card relative rounded-[20px] overflow-hidden kpi-lift elevation-2"
      style={{
        background: HERO_GRAD,
        border: '1px solid rgba(180, 140, 10, 0.35)',
        boxShadow: '0 14px 34px rgba(200, 160, 20, 0.30)',
      }}
    >
      {/* Gloss sutil */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: HERO_GLOSS }} />
      {/* Patron de puntos sutil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: HERO_INK }}
      />

      <div className="relative px-5 py-4 sm:px-6 sm:py-5">
        {/* Header con label + boton info */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: HERO_INK }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: HERO_SUB }}>{label}</p>
          {hasInfo && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!showInfo) setShowInfo(true) }}
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ml-auto cursor-pointer transition-transform hover:scale-110"
              style={{ background: `color-mix(in srgb, ${HERO_INK} 12%, transparent)`, color: HERO_INK }}
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
                color: HERO_INK,
                fontSize: 'clamp(32px, 9vw, 44px)',
              }}
            >
              {display}
            </p>
            {sub && (
              <p className="text-[12px] mt-1.5 font-medium" style={{ color: HERO_SUB }}>{sub}</p>
            )}
            {narrativa && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${HERO_INK} 10%, transparent)`, color: HERO_INK, border: `1px solid color-mix(in srgb, ${HERO_INK} 18%, transparent)` }}>
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
                color={HERO_INK}
                trackColor={HERO_TRACK}
                labelColor={HERO_SUB}
                size={76}
                strokeWidth={7}
                label="Meta hoy"
              />
            </div>
          )}
        </div>

        {/* Donut version movil (debajo del numero) */}
        {metaDiaria && metaDiaria > 0 && (
          <div className="sm:hidden mt-3 flex items-center gap-3 pt-3" style={{ borderTop: `1px solid ${HERO_TRACK}` }}>
            <DonutProgress
              value={typeof valueRaw === 'number' ? valueRaw : 0}
              max={metaDiaria}
              color={HERO_INK}
              trackColor={HERO_TRACK}
              labelColor={HERO_SUB}
              size={56}
              strokeWidth={5}
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: HERO_SUB }}>Meta diaria</p>
              <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: HERO_INK }}>{formatMoney(metaDiaria)}</p>
            </div>
          </div>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3">
            <Sparkline data={sparklineData} color={HERO_INK} mutedColor={HERO_SUB} tooltipBg="rgba(50, 40, 10, 0.92)" tooltipText="#f5c518" ariaLabel="Tendencia últimos 7 días" />
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
function DonutProgress({ value = 0, max = 100, color = 'var(--color-success)', size = 90, strokeWidth = 9, label, sublabel, trackColor = 'var(--color-bg-hover)', labelColor = 'var(--color-text-secondary)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const animatedPct = useCountUp(pct, 1000)
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const len = (animatedPct / 100) * circ

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* rotacion por atributo SVG (no CSS transform) — evita crear capa GPU */}
        <svg width={size} height={size}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {/* Anillo de fondo */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={trackColor}
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
              }}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono-display font-bold leading-none" style={{ color, fontSize: size * 0.26 }}>
            {Math.round(animatedPct)}<span style={{ fontSize: size * 0.16 }}>%</span>
          </p>
        </div>
      </div>
      {label && (
        <p className="text-[11px] mt-2 font-semibold uppercase tracking-wider text-center" style={{ color: labelColor }}>{label}</p>
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
          Promedio diario · <span style={{ color: 'var(--color-text-primary)' }}>{formatMoney(Math.round(promedio))}</span>
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
            title={`Hace ${29 - c.idx} día${29 - c.idx === 1 ? '' : 's'}: ${formatMoney(c.valor)}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
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
    if (pctMeta >= 75) return `Falta poco: $${formatMoney(cuotaDiaria - recaudadoHoy).replace('$', '')} para tu meta`
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
    if (format === 'cop') return formatMoney(Math.round(n))
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
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none"
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
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'cardFadeUp 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Header con color del KPI */}
        <div
          className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
          style={{ background: `color-mix(in srgb, ${color} 12%, var(--color-bg-base))`, borderBottom: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
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
            className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none"
            style={{ background: `color-mix(in srgb, ${colorHex} 25%, transparent)`, color: colorHex }}
          >
            i
          </span>
        )}
      </div>
      <p className="text-xl font-bold font-mono-display truncate" style={{ color }}>{formatMoney(Math.round(animMonto))}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cantidad} pagos {label.toLowerCase().includes('mes') ? 'en el mes' : 'registrados'}</p>
        {montoAyer !== undefined && montoAyer !== null && (
          <ComparativoChip actual={monto} anterior={montoAyer} />
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-2.5">
          <Sparkline data={sparklineData} color={colorHex} ariaLabel="Tendencia últimos 7 días" />
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
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{pct}% de la cuota diaria</p>
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
      className="relative overflow-hidden rounded-[16px] px-4 py-4 transition-all duration-200 group flex items-center gap-3 active:scale-[0.98]"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
        border: `1px solid color-mix(in srgb, ${color} 18%, var(--color-border))`,
      }}
    >
      <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-[0.05] pointer-events-none" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 relative z-10" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0 relative z-10">
        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
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
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
      = vs ayer
    </span>
  )
  const positivo = diff > 0
  const color = positivo ? 'var(--color-success)' : 'var(--color-danger)'
  const arrow = positivo ? '↑' : '↓'
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-0.5" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
      <span>{arrow}</span>
      <span>{formatMoney(Math.abs(diff))}</span>
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
    monto: formatMoney(pagos.monto),
  })
  if (prestamos.cantidad > 0) items.push({
    icon: Icons.prestamoOut,
    color: '#f59e0b',
    text: `${prestamos.cantidad} ${prestamos.cantidad === 1 ? 'préstamo entregado' : 'préstamos entregados'}`,
    monto: formatMoney(prestamos.monto),
  })
  if (esOwner && gastos && gastos.cantidad > 0) items.push({
    icon: Icons.gasto,
    color: 'var(--color-warning)',
    text: `${gastos.cantidad} ${gastos.cantidad === 1 ? 'gasto' : 'gastos'}`,
    monto: formatMoney(gastos.monto),
  })
  if (esOwner && retiros && retiros.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--color-danger)',
    text: 'Retiro de caja',
    monto: formatMoney(retiros.monto),
  })
  if (esOwner && inyecciones && inyecciones.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--color-success)',
    text: 'Inyección de capital',
    monto: formatMoney(inyecciones.monto),
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
                    <span style={{ color: 'var(--color-success)' }}>{formatMoney(c.monto)}</span>
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
  const proximos = alertas.proximosACompletar?.length ?? 0
  if (proximos > 0) items.push({
    color: 'var(--color-success)',
    text: `${proximos} ${proximos === 1 ? 'préstamo listo para renovar' : 'préstamos listos para renovar'} (80%+ pagado)`,
    href: '#renovar',
    scroll: true,
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

function ProximosARenovar({ alertas }) {
  const lista = alertas?.proximosACompletar
  if (!lista?.length) return null

  return (
    <div
      id="renovar"
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))',
      }}
    >
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-success) 6%, transparent)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 18%, transparent)', color: 'var(--color-success)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
            </svg>
          </div>
          <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>Listos para renovar</h2>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>
          {lista.length}
        </span>
      </div>
      <div className="px-2 py-1">
        {lista.map((p) => (
          <Link
            key={p.prestamoId}
            href={`/prestamos/${p.prestamoId}`}
            className="flex items-center justify-between gap-2 py-2.5 px-2 rounded-[8px] transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {p.clienteNombre}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}>
                  {p.porcentaje}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                <span>Faltan {formatMoney(p.saldoPendiente)}</span>
                {p.cuotasRestantes > 0 && <span>{p.cuotasRestantes} cuotas</span>}
                {p.rutaNombre && <span>{p.rutaNombre}</span>}
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full" style={{ width: `${p.porcentaje}%`, background: 'var(--color-success)' }} />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-success)' }}>Renovar</span>
              <svg className="w-3 h-3" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function BandaSuscripcion({ dias }) {
  if (dias === null || dias === undefined || dias > 30) return null
  const urgente = dias <= 7
  const pct = Math.max(4, Math.round((dias / 30) * 100))

  const mensaje = urgente
    ? 'Renueva para seguir creciendo'
    : dias <= 14
      ? 'Tu negocio va bien, asegura la continuidad'
      : 'Aprovecha al maximo tu plan'

  const accentColor = urgente ? '#ef4444' : 'var(--color-accent)'
  const gradientBg = urgente
    ? 'linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--color-bg-card)), color-mix(in srgb, #f59e0b 5%, var(--color-bg-card)))'
    : 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-card)), var(--color-bg-card))'

  return (
    <a href="/configuracion/plan"
      className="block rounded-[14px] px-4 py-3.5 transition-all hover:scale-[1.005] active:scale-[0.995] relative overflow-hidden"
      style={{ background: gradientBg, border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-11 h-11 shrink-0">
          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-bg-hover)" strokeWidth="3.5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={accentColor} strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${pct * 1.13} 113`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono-display" style={{ color: accentColor }}>
            {dias}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
            {dias} dias restantes
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{mensaje}</p>
        </div>
        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0 transition-all"
          style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, color: accentColor }}
        >
          Renovar
        </span>
      </div>
    </a>
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
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
  const [actualizadoEn, setActualizadoEn] = useState(null)
  const [susInfo, setSusInfo] = useState(null)
  const [equipoData, setEquipoData] = useState(null)
  const [equipoOpen, setEquipoOpen] = useState(false)

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

  const loadDashboard = useCallback(async () => {
    setIsOffline(false)
    // Cache-first: pintar al instante el ultimo resumen guardado y revalidar
    // en segundo plano. Evita el flash skeleton→datos al entrar al dashboard.
    try {
      const cached = await leerDeCache('dashboard:resumen')
      if (cached) {
        setData(cached)
        setLoading(false)
      }
    } catch {}
    // Offline real: leer de IndexedDB directamente
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache('dashboard:resumen')
        if (!cached) cached = await obtenerDashboardOffline()
        if (cached) { setData(cached); if (!navigator.onLine) setIsOffline(true); setLoading(false); return }
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
        if (cached) { setData(cached); if (!navigator.onLine) setIsOffline(true); return }
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
    if (esOwner) {
      loadCapital()
      fetch(`/api/equipo/resumen?t=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (d.cobradores) setEquipoData(d) })
        .catch(() => {})
    }
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
    fetch('/api/pagos/estado')
      .then(r => r.json())
      .then(d => { if (d.diasRestantes !== undefined) setSusInfo(d) })
      .catch(() => {})
  }, [authLoading, esOwner])

  useEffect(() => {
    if (authLoading || !esOwner) return
    loadCapital()
    fetch(`/api/equipo/resumen?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.cobradores) setEquipoData(d) })
      .catch(() => {})
  }, [authLoading, esOwner, loadCapital])

  const moraPct = data ? (data.clientes.total > 0 ? Math.round((data.clientes.enMora / data.clientes.total) * 100) : 0) : 0

  // Wizard: full-screen takeover for users in onboarding (step 0-98)
  // If minimized this session, show a banner instead
  if (onboarding.showWizard && esOwner && !onboarding.wizardMinimized) {
    return (
      <div className="max-w-3xl lg:max-w-6xl mx-auto">
        <OnboardingWizard
          nombre={session?.user?.nombre || session?.user?.name}
          initialStep={onboarding.wizardInitialStep}
          initialFlujo={onboarding.wizardFlujo}
          plan={onboarding.plan}
          onComplete={() => {
            onboarding.dismiss()
            window.location.reload()
          }}
          onMinimize={() => {
            onboarding.minimize()
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-5">
      {/* Banner: wizard minimizado — click to resume */}
      {onboarding.showWizard && onboarding.wizardMinimized && esOwner && (
        <button
          onClick={() => onboarding.unminimize()}
          className="w-full flex items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-all active:scale-[0.99] cursor-pointer"
          style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)' }}>
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,197,24,0.15)' }}>
            <svg className="w-4 h-4" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: '#f5c518' }}>Continuar configuración</p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Retoma el asistente donde lo dejaste</p>
          </div>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
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
              Resumen de tu cartera hoy
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
      {esOwner && susInfo && <BandaSuscripcion dias={susInfo.diasRestantes} />}
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
      ) : data && data.clientes?.total === 0 && data.prestamos?.activos === 0 && esOwner ? (
        <div className="flex flex-col items-center text-center py-8">
          <MonedaCF pose="guia" size={100} />
          <h2 className="text-lg font-bold mt-4 mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Tu cartera está lista
          </h2>
          <p className="text-[13px] max-w-[280px] mx-auto mb-6 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Ya configuraste el sistema. Ahora sube tus clientes para que el dashboard cobre vida.
          </p>
          <div className="w-full max-w-sm space-y-2.5">
            <Link href="/migrador" className="group flex items-center gap-3 w-full rounded-[14px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,197,24,0.15)', color: '#f5c518' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Sube tu cartera</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Foto de cartulina, Excel o manual</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/clientes/nuevo" className="group flex items-center gap-3 w-full rounded-[14px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Crear cliente manual</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Agrega uno a uno desde el formulario</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/prestamos/nuevo" className="group flex items-center gap-3 w-full rounded-[14px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Crear un prestamo</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>El sistema calcula cuota y saldo</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      ) : data && (
        <>
          {/* Desktop: grid de 2 columnas para hero + strip lateral */}
          <div className="lg:grid lg:grid-cols-5 lg:gap-5 lg:items-stretch">
          <div className="lg:col-span-3">
          {/* HERO: Recaudado hoy en grande con narrativa + donut de meta integrado */}
          <HeroCard
            label="Recaudado hoy"
            valueRaw={data.cobros.hoy}
            value={formatMoney(data.cobros.hoy)}
            sub={`${data.cobros.cantidadHoy} ${data.cobros.cantidadHoy === 1 ? 'pago registrado' : 'pagos registrados'}${data.cobros.ayer ? ` · ayer ${formatMoney(data.cobros.ayer)}` : ''}`}
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
              ejemplo: `Llevas ${formatMoney(data.cobros.hoy)} cobrados en ${data.cobros.cantidadHoy} pagos hoy. ${data.prestamos.cuotaDiariaTotal > 0 ? `Eso es el ${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de tu meta diaria de ${formatMoney(data.prestamos.cuotaDiariaTotal)}.` : ''}${data.cobros.ayer ? ` Ayer cobraste ${formatMoney(data.cobros.ayer)} en ${data.cobros.cantidadAyer} pagos.` : ''}`,
              cuandoCambia: 'Sube cada vez que se registra un pago. Se reinicia a $0 a la medianoche (hora Colombia).',
              tip: 'El sparkline muestra los últimos 7 días. La etiqueta "vs ayer" compara con el día anterior completo.',
            }}
          />

          </div>
          {/* Columna derecha desktop: KPIs rapidos */}
          <div className="lg:col-span-2 flex flex-col gap-3 mt-5 lg:mt-0">
          {/* Strip de KPIs — en desktop ocupa todo el alto del hero */}
          {esOwner && (
            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-3 lg:flex-1 lg:min-h-0">
              <Link href="/clientes?filtro=mora" className="rounded-[16px] px-4 py-4 transition-all hover:scale-[1.01] relative overflow-hidden group/stat lg:flex-1 lg:flex lg:flex-col lg:justify-center" style={{ background: data.clientes.enMora > 0 ? 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-card))' : 'color-mix(in srgb, var(--color-success) 6%, var(--color-bg-card))', border: `1px solid ${data.clientes.enMora > 0 ? 'color-mix(in srgb, var(--color-danger) 25%, var(--color-border))' : 'color-mix(in srgb, var(--color-success) 20%, var(--color-border))'}`, boxShadow: data.clientes.enMora > 0 ? '0 4px 16px color-mix(in srgb, var(--color-danger) 12%, transparent)' : '0 4px 16px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: data.clientes.enMora > 0 ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}>
                    <svg className="w-4 h-4" fill="none" stroke={data.clientes.enMora > 0 ? 'var(--color-danger)' : 'var(--color-success)'} strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Clientes en mora</p>
                </div>
                <p className="text-3xl font-bold font-mono-display leading-none" style={{ color: data.clientes.enMora > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{data.clientes.enMora}</p>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{data.clientes.enMora === 0 ? 'Todo al dia' : `de ${data.clientes.total} activos`}</p>
              </Link>
              {capitalData ? (
                <Link href="/caja" className="rounded-[16px] px-4 py-4 transition-all hover:scale-[1.01] relative overflow-hidden lg:flex-1 lg:flex lg:flex-col lg:justify-center" style={{ background: 'color-mix(in srgb, #06b6d4 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, #06b6d4 20%, var(--color-border))', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #06b6d4 12%, transparent)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="#06b6d4" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Saldo en caja</p>
                  </div>
                  <p className="text-2xl font-bold font-mono-display leading-none truncate" style={{ color: capitalData.saldo < 0 ? 'var(--color-danger)' : '#06b6d4' }}>{formatMoney(capitalData.saldo)}</p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>Para prestar ahora</p>
                </Link>
              ) : (
                <Link href="/caja" className="rounded-[16px] px-4 py-4 transition-all hover:scale-[1.01]" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>Saldo en caja</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Ver caja →</p>
                </Link>
              )}
            </div>
          )}

          {/* Tip IA sutil */}
          <DashboardAiTip data={data} />
          </div>
          </div>

          {/* Recaudado del mes + interes — en desktop side by side */}
          {!vistaSimple && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
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
              ejemplo: `Has cobrado ${formatMoney(data.cobros.mes)} en ${data.cobros.cantidadMes} pagos este mes. Promedio por día: ${formatMoney(Math.round(data.cobros.mes / Math.max(1, new Date().getDate())))}.`,
              cuandoCambia: 'Sube cada vez que se registra un pago. Se reinicia a $0 el día 1 de cada mes.',
              tip: 'Compara este número con el mes pasado para ver si tu cobro está creciendo.',
            }}
          />
          {esOwner && data.cobros.interesGanadoMes != null && (
            <RecaudoCard
              label="Interés ganado este mes"
              color="#10b981"
              colorHex="#10b981"
              monto={data.cobros.interesGanadoMes}
              cantidad={data.cobros.cantidadMes}
              info={{
                titulo: 'Interés ganado este mes',
                que: 'Tu GANANCIA real del mes: la parte de interés de cada pago cobrado, sin contar la recuperación del capital que prestaste.',
                comoSeCalcula: 'De cada pago se toma solo la fracción de interés del préstamo (lo que ganas, no lo que recuperas) y se suma en el mes. En mercancía, el interés es la ganancia (precio de venta − costo).',
                ejemplo: `Este mes llevas ${formatMoney(data.cobros.interesGanadoMes)} de ganancia en intereses. El resto de lo cobrado (${formatMoney(Math.max(0, data.cobros.mes - data.cobros.interesGanadoMes))}) es recuperación del capital que prestaste.`,
                cuandoCambia: 'Sube cada vez que un cliente paga. Se reinicia el día 1 de cada mes.',
                tip: 'Esta es tu utilidad bruta del mes, antes de gastos. Para ver cualquier mes anterior usa Reportes con el filtro de fechas.',
              }}
            />
          )}
          </div>
          )}

          {/* Tu dinero — Saldo y Patrimonio (solo owner, vista completa) */}
          {!vistaSimple && esOwner && (capitalData || data.finanzas) && (
            <KpiGroup title="Tu dinero" icon={Icons.dinero}>
              <div className="grid grid-cols-2 gap-3">
                {capitalData && (
                  <KpiCard
                    label="Saldo disponible"
                    value={formatMoney(capitalData.saldo)}
                    valueRaw={capitalData.saldo}
                    sub={capitalData.saldo < 0 ? 'Capital insuficiente' : 'Capital en caja'}
                    color={capitalData.saldo < 0 ? '#ef4444' : '#06b6d4'}
                    info={{
                      titulo: 'Saldo disponible',
                      que: 'El EFECTIVO que tienes en caja en este momento. Plata real disponible para prestar, retirar o cubrir gastos.',
                      comoSeCalcula: 'Capital inicial + cobros recibidos − desembolsos de préstamos − gastos − retiros + inyecciones.',
                      ejemplo: `Tienes ${formatMoney(capitalData.saldo)} en caja ahora mismo. ${capitalData.saldo < 0 ? '⚠️ Tu saldo está en negativo: revisa si registraste todos los movimientos correctamente.' : 'Con esto puedes desembolsar nuevos préstamos o retirar utilidades.'}`,
                      cuandoCambia: 'SUBE: cobros e inyecciones de capital. BAJA: desembolsos de préstamos nuevos, gastos, retiros.',
                      tip: 'Si vas a hacer un préstamo grande, verifica que tengas suficiente saldo aquí antes.',
                    }}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
                  />
                )}
                {data.finanzas && (
                  <KpiCard
                    label="Patrimonio"
                    value={formatMoney(data.finanzas.patrimonio)}
                    valueRaw={data.finanzas.patrimonio}
                    sub={`Caja + por cobrar - gastos`}
                    color="#10b981"
                    info={{
                      titulo: 'Patrimonio',
                      que: 'Tu foto financiera completa hoy. Cuánto vale tu negocio sumando todo lo que tienes y te deben, menos lo gastado este mes.',
                      comoSeCalcula: `Saldo en caja (${formatMoney(data.finanzas.cajaDisponible)}) + Por cobrar real (${formatMoney(data.prestamos.saldoPorCobrar)}) − Gastos del mes (${formatMoney(data.finanzas.gastosMes)}) = ${formatMoney(data.finanzas.patrimonio)}.`,
                      ejemplo: `Tu negocio vale ${formatMoney(data.finanzas.patrimonio)} hoy. Esto incluye lo que tienes en caja, lo que te deben los clientes, y descontando los gastos del mes en curso.`,
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

          {/* Desktop: KPI groups side by side */}
          {!vistaSimple && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
          {/* Tu cartera — Cartera activa, Por cobrar */}
          <KpiGroup title="Tu cartera" icon={Icons.cartera}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Cartera activa"
                value={formatMoney(data.prestamos.carteraActiva)}
                valueRaw={data.prestamos.carteraActiva}
                sub={`Capital: ${formatMoney(data.prestamos.capitalPrestado)}`}
                color="#f59e0b"
                info={{
                  titulo: 'Cartera activa',
                  que: 'Todo el dinero que tus clientes te van a pagar EN TOTAL (capital + intereses) cuando terminen sus préstamos. Es como una "promesa de cobro" futura.',
                  comoSeCalcula: `Sumo el "Total a pagar" de todos los préstamos activos. Capital prestado: ${formatMoney(data.prestamos.capitalPrestado)} + Intereses por ganar: ${formatMoney(data.prestamos.carteraActiva - data.prestamos.capitalPrestado)} = ${formatMoney(data.prestamos.carteraActiva)}.`,
                  ejemplo: `Vas a recibir ${formatMoney(data.prestamos.carteraActiva)} cuando todos terminen de pagar. De eso, ${formatMoney(data.prestamos.capitalPrestado)} es lo que prestaste y ${formatMoney(data.prestamos.carteraActiva - data.prestamos.capitalPrestado)} es tu ganancia por intereses.`,
                  cuandoCambia: 'Solo cambia cuando creas un préstamo nuevo (sube) o un préstamo se completa/cancela (baja). NO baja con los pagos diarios.',
                  tip: '¿Quieres ver cuánto te falta cobrar? Mira "Por cobrar" — ese sí baja con cada pago.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
              />
              {data.prestamos.saldoPorCobrar !== undefined && (
                <KpiCard
                  label="Por cobrar"
                  value={formatMoney(data.prestamos.saldoPorCobrar)}
                  valueRaw={data.prestamos.saldoPorCobrar}
                  sub="Saldo pendiente real"
                  color="#0ea5e9"
                  info={{
                    titulo: 'Por cobrar',
                    que: 'Lo que REALMENTE te falta cobrar HOY de todos tus préstamos activos.',
                    comoSeCalcula: `Cartera activa (${formatMoney(data.prestamos.carteraActiva)}) MENOS lo que ya te han pagado tus clientes (${formatMoney(data.prestamos.carteraActiva - data.prestamos.saldoPorCobrar)}) = ${formatMoney(data.prestamos.saldoPorCobrar)}.`,
                    ejemplo: `Te faltan ${formatMoney(data.prestamos.saldoPorCobrar)} por cobrar. Ya has cobrado ${formatMoney(data.prestamos.carteraActiva - data.prestamos.saldoPorCobrar)} del total prometido.`,
                    cuandoCambia: 'Baja cada vez que un cliente te paga. Sube cuando creas un préstamo nuevo.',
                    tip: 'Este es el indicador real de "deuda pendiente". El más útil para saber cómo va tu cobro día a día.',
                  }}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>}
                />
              )}
            </div>
          </KpiGroup>

          {/* Tus clientes — Clientes activos, Préstamos activos */}
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
                label="Préstamos activos"
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
          </div>
          )}

          {/* Operación — Cuota diaria, Rutas (colapsado por defecto) */}
          {!vistaSimple && (
          <KpiGroup title="Operación" icon={Icons.operacion} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Cuota diaria total"
                value={formatMoney(data.prestamos.cuotaDiariaTotal)}
                valueRaw={data.prestamos.cuotaDiariaTotal}
                sub="Esperado por día"
                color="#a855f7"
                info={{
                  titulo: 'Cuota diaria total',
                  que: 'Lo que DEBERÍAS cobrar en un día normal si todos tus clientes pagaran su cuota del día sin atrasos.',
                  comoSeCalcula: 'Sumo la cuota diaria pactada de cada préstamo activo (la cuota que cada cliente debe pagar todos los días según su frecuencia).',
                  ejemplo: `Tu meta diaria es ${formatMoney(data.prestamos.cuotaDiariaTotal)}. Si cobraste menos hoy, tienes mora acumulándose. Si cobraste más, hay clientes adelantando pagos.`,
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

          {/* Desktop: bottom sections in 2-col grid */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
          <div className="space-y-5">
          {/* Movimientos de hoy: resumen narrativo + desglose por cobrador */}
          {data.actividadHoy && (
            <ResumenDelDia actividad={data.actividadHoy} esOwner={esOwner} />
          )}

          {/* Mi equipo — dropdown colapsable, solo owner con cobradores */}
          {esOwner && equipoData && equipoData.cobradores.length > 0 && (
            <div
              className="rounded-[16px] overflow-hidden"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => setEquipoOpen(v => !v)}
                className="w-full px-4 py-3 flex items-center gap-2 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #8b5cf6 15%, transparent)', color: '#8b5cf6' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Mi equipo</span>
                <span className="text-[10px] font-mono-display px-2 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, #8b5cf6 12%, transparent)', color: '#8b5cf6' }}>
                  {equipoData.cobradores.length}
                </span>
                <svg
                  className="w-4 h-4 ml-auto transition-transform duration-200"
                  style={{ color: 'var(--color-text-muted)', transform: equipoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {equipoOpen && (
                <div className="divide-y" style={{ borderColor: 'var(--color-border)', borderTop: '1px solid var(--color-border)' }}>
                  {equipoData.cobradores.map(c => {
                    const inactivo = c.minutesSinceActivity !== null && c.minutesSinceActivity > 120
                    const tiempoStr = c.minutesSinceActivity === null
                      ? 'Sin registro'
                      : c.minutesSinceActivity < 5
                        ? 'Ahora'
                        : c.minutesSinceActivity < 60
                          ? `${c.minutesSinceActivity}min`
                          : c.minutesSinceActivity < 1440
                            ? `${Math.floor(c.minutesSinceActivity / 60)}h`
                            : `${Math.floor(c.minutesSinceActivity / 1440)}d`
                    return (
                      <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-xs font-bold relative"
                          style={{
                            background: inactivo
                              ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                              : 'color-mix(in srgb, #8b5cf6 12%, transparent)',
                            color: inactivo ? 'var(--color-danger)' : '#8b5cf6',
                          }}
                        >
                          {c.nombre.charAt(0).toUpperCase()}
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                            style={{
                              borderColor: 'var(--color-bg-card)',
                              background: c.minutesSinceActivity !== null && c.minutesSinceActivity < 15
                                ? 'var(--color-success)'
                                : inactivo
                                  ? 'var(--color-danger)'
                                  : 'var(--color-text-muted)',
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                            {inactivo && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}>
                                Inactivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {c.rutas.length > 0 && (
                              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{c.rutas.join(', ')}</span>
                            )}
                            <span className="text-[10px]" style={{ color: inactivo ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                              {tiempoStr}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13px] font-bold font-mono-display" style={{ color: c.recaudadoHoy > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                            {formatMoney(c.recaudadoHoy)}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{c.pagosHoy} cobros</span>
                            {c.cajaCerrada && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{
                                background: c.cajaDiferencia === 0
                                  ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                                  : 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
                                color: c.cajaDiferencia === 0 ? 'var(--color-success)' : 'var(--color-warning)',
                              }}>
                                Caja OK
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          </div>
          <div className="space-y-5">
          {/* Necesita tu atencion: alertas accionables al final (solo owner) */}
          {esOwner && data.alertas && (
            <NecesitaAtencion alertas={data.alertas} moraData={moraData} />
          )}

          {/* Prestamos listos para renovar (80%+ pagado) */}
          {esOwner && data.alertas?.proximosACompletar?.length > 0 && (
            <ProximosARenovar alertas={data.alertas} />
          )}
          </div>
          </div>
        </>
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
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-danger)' }}>{formatMoney(c.saldoPendiente)}</p>
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
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(c.saldoPendiente)}</p>
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
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatMoney(c.saldoPendiente)}</p>
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
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
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
                <p className="text-sm font-bold shrink-0 ml-3 font-mono-display" style={{ color: 'var(--color-success)' }}>+{formatMoney(p.monto)}</p>
              </div>
            ))}
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
                Datos offline: {syncMeta.totalClientes} clientes, {syncMeta.totalPrestamos} préstamos
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

      {/* Accesos rápidos — para cobrador; el owner ya tiene los botones arriba */}
      {!esOwner && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>Accesos rápidos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {puedeCrearClientes && <QuickLink href="/clientes/nuevo" label="Nuevo cliente" desc="Registrar cliente" color="#f5c518" dataTour="nuevo-cliente" />}
            {puedeCrearPrestamos && <QuickLink href="/prestamos/nuevo" label="Nuevo préstamo" desc="Crear préstamo" color="#22c55e" dataTour="nuevo-prestamo" />}
            <QuickLink href="/caja" label="Cierre de caja" desc="Registrar cierre del día" color="#f59e0b" dataTour="caja" />
            <QuickLink href="/clientes" label="Clientes" desc="Ver cartera completa" color="#a855f7" dataTour="prestamos" />
          </div>
        </div>
      )}
    </div>
  )
}
