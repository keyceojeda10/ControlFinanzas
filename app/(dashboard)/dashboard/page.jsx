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
import Panel from '@/components/pantallas/Panel'
import { adaptarPanel, porRutaHoy } from '@/lib/adaptadores/panel'
import CacheAge from '@/components/offline/CacheAge'

// Carga diferida — solo se descargan si el usuario los necesita
import TraerCartera from '@/components/pantallas/TraerCartera'
import AsistenteChat from '@/components/asistente/AsistenteChat'
import { rotulo } from '@/lib/dinero/definiciones'
import PanelDinero from '@/components/pantallas/PanelDinero'
import { adaptarPanelDinero, notaDelPanel } from '@/lib/adaptadores/panel-dinero'

const OnboardingWizard    = dynamic(() => import('@/components/onboarding/OnboardingWizard'),    { ssr: false })
const SpotlightOverlay    = dynamic(() => import('@/components/onboarding/SpotlightOverlay'),    { ssr: false })
const CobradorOnboarding  = dynamic(() => import('@/components/onboarding/CobradorOnboarding'),  { ssr: false })
const DashboardAiTip      = dynamic(() => import('@/components/dashboard/DashboardAiTip'),       { ssr: false })
const BannerFotosDonadas  = dynamic(() => import('@/components/dashboard/BannerFotosDonadas'),   { ssr: false })
const MonedaCF            = dynamic(() => import('@/components/ui/MonedaCF'),                    { ssr: false })
const InstallBanner       = dynamic(() => import('@/components/layout/InstallBanner'),            { ssr: false })

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[12px] ${className}`} style={{ background: 'var(--cf-fill)' }} />
}

// Skeleton con forma de KpiCard real para que la carga no parezca un bloque vacio
function KpiCardSkeleton() {
  const shimmerStyle = {
    background: 'linear-gradient(90deg, var(--cf-fill) 0%, color-mix(in srgb, var(--cf-ink-3) 18%, var(--cf-fill)) 50%, var(--cf-fill) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  }
  return (
    <div
      className="rounded-[16px] px-4 py-4"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
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

// Debe reflejar la misma estructura que KpiGroup (seccion con titulo, sin card
// contenedora), o al cargar se ve un layout que luego cambia.
function KpiGroupSkeleton({ kpis = 2 }) {
  return (
    // `aria-busy` NO es adorno de accesibilidad, aunque tambien lo sea: es la
    // senal que dice «esto no es la pantalla, es la espera». Sin ella, una
    // captura del esqueleto se parece lo justo a la pantalla real para colarse
    // en un cotejo — ya me pase un rato comparando esqueletos contra la lamina.
    // Un lector de pantalla gana lo mismo: deja de leer cajas vacias.
    <div aria-busy="true">
      <div className="px-1 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] animate-pulse" style={{ background: 'var(--cf-fill)' }} />
        <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--cf-fill)' }} />
      </div>
      <div className="pt-1.5">
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
function Sparkline({ data, color = 'var(--cf-green-dark)', ariaLabel, etiquetasDias, mutedColor, tooltipBg, tooltipText }) {
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
                fill={esHoy || esActive ? color : (tooltipBg || 'var(--cf-card)')}
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
              fill={esHoy ? color : (mutedColor || 'var(--cf-ink-3)')}
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
            background: tooltipBg || 'var(--cf-surface)',
            border: `1px solid color-mix(in srgb, ${color} 35%, ${tooltipBg ? 'rgba(0,0,0,0.2)' : 'var(--cf-border)'})`,
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
            zIndex: 10,
          }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: tooltipBg ? 'rgba(245, 197, 24, 0.6)' : (mutedColor || 'var(--cf-ink-3)') }}>{dias[activeIdx]}</p>
          <p className="font-mono-display font-bold" style={{ color: tooltipText || color }}>{formatMoney(activePoint[2])}</p>
        </div>
      )}
    </div>
  )
}

// Hero card: la tarjeta dorada de marca (color-block). Numero grande en tinta
// oscura sobre dorado, donut de meta integrado. Sin skeuomorfismo.
const HERO_GRAD  = 'linear-gradient(135deg, #f9d64a 0%, #f5b824 55%, #e7a400 100%)'
const HERO_INK   = '#3a2900'
const HERO_SUB   = 'rgba(58, 41, 0, 0.62)'
const HERO_TRACK = 'rgba(58, 41, 0, 0.16)'
const HERO_GLOSS = 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 58%)'

// HeroCard SE BORRO. Era el hero dorado de la version anterior —111 lineas
// con degradado, sombra y `kpi-lift`— y llevaba CERO usos desde que <Panel>
// lo sustituyo: el comentario del montaje ya decia «sustituye al HeroCard SIN
// PERDER NADA». Codigo muerto que ademas cargaba la estetica que se acaba de
// quitar del resto de la pantalla: `elevation-2`, `kpi-lift` y sus propios
// degradados.
//
// (Medido despues de borrarlo: los techos de la prueba del canon NO bajaron.
// Sus sombras y degradados no coincidian con los patrones que esa prueba
// vigila, asi que era deuda invisible para ella. Un motivo mas para que no
// siguiera ahi.)

// Donut de progreso animado: anillo SVG con porcentaje en el centro.
function DonutProgress({ value = 0, max = 100, color = 'var(--cf-green-dark)', size = 90, strokeWidth = 9, label, sublabel, trackColor = 'var(--cf-fill)', labelColor = 'var(--cf-ink-2)' }) {
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
        <p className="text-[10px] mt-0.5 text-center" style={{ color: 'var(--cf-ink-3)' }}>{sublabel}</p>
      )}
    </div>
  )
}


// Genera narrativa contextual basada en datos. Da personalidad al dashboard.
function generarNarrativa({ recaudadoHoy, recaudadoAyer, recaudadoAyerAEstaHora, cuotaDiaria, sparkline7d }) {
  if (!recaudadoHoy && !recaudadoAyer) return null

  // Comparativo contra ayer A LA MISMA HORA, no contra el dia completo de ayer.
  // Comparar la mañana contra 24 horas enteras daba negativo siempre antes del
  // cierre: a las 10am salia "94% menos que ayer" todos los dias, con lo que la
  // alarma sonaba a diario y dejaba de significar nada.
  const referenciaAyer = recaudadoAyerAEstaHora
  if (referenciaAyer > 0) {
    const pct = Math.round(((recaudadoHoy - referenciaAyer) / referenciaAyer) * 100)
    if (pct > 15) return `Vas a buen ritmo: ${pct}% más que ayer a esta hora`
    if (pct < -15) return `${Math.abs(pct)}% menos que ayer a esta hora`
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

function KpiCard({ label, value, valueRaw, format = 'cop', sub, color = 'var(--cf-ink)', icon, info }) {
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

  // Sin count-up en los montos: durante ~700ms mostraba cifras FALSAS y ademas
  // el ancho del texto cambiaba en cada frame. En una app de dinero, el numero
  // correcto desde el primer frame vale mas que la animacion.
  const displayValue = (() => {
    if (valueRaw === undefined && typeof value !== 'number') return value
    const n = typeof valueRaw === 'number' ? valueRaw : (typeof value === 'number' ? value : 0)
    if (format === 'cop') return formatMoney(Math.round(n))
    return Math.round(n).toLocaleString('es-CO')
  })()

  // El monto NUNCA se trunca: los numeros son el producto. En movil van dos KPI
  // por fila y un monto de 9 digitos no cabe a 24px; con `truncate` se leia
  // "$25.706...." y el dueño no podia ver su propio patrimonio. El tamaño se
  // ajusta al largo del texto en vez de recortarlo.
  const textoValor = String(displayValue ?? '')
  const tamValor = textoValor.length >= 14 ? 'text-[16px]'
    : textoValor.length >= 12 ? 'text-[18px]'
    : textoValor.length >= 10 ? 'text-[21px]'
    : 'text-[24px]'
  return (
    <div
      onClick={openInfo}
      role={hasInfo ? 'button' : undefined}
      tabIndex={hasInfo ? 0 : undefined}
      onKeyDown={hasInfo ? (e) => { if (e.key === 'Enter' || e.key === ' ') openInfo(e) } : undefined}
      /* LA RECETA DE LA TARJETA, de 03-COMPONENTES.md · 1 · Tarjeta estandar:
         fondo plano, borde de 1px, radio 18, relleno 16x19 y SIN SOMBRA — «la
         separacion la da el borde sobre el fondo hueso». Aqui habia un degradado
         a 135 grados teñido con el color del KPI, sombra y elevacion al tocar:
         nada de eso esta en el paquete de diseño, que no menciona un degradado
         ni una sola vez. El color se queda donde si tiene que estar: en la
         cifra y en el rotulo, no en la superficie. */
      className={`rounded-[18px] px-[19px] py-4 relative group ${hasInfo ? 'cursor-pointer' : ''}`}
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[.07em] leading-tight" style={{ color: color }}>{label}</p>
          {/* La "i" era un <span aria-hidden pointer-events-none>: se veia como
              boton pero no lo era, y quien la tocaba le acertaba de rebote al
              click de la tarjeta. Ahora es un boton de verdad, enfocable y con
              area tactil de 40px (el minimo del canon para uso en la calle),
              usando un pseudo-elemento para no agrandar el circulo visible. */}
          {hasInfo && (
            <button
              type="button"
              onClick={openInfo}
              aria-label={`Qué significa ${label}`}
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold relative
                         before:absolute before:-inset-3 before:content-['']
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]"
              style={{ background: `color-mix(in srgb, ${color} 25%, transparent)`, color }}
            >
              i
            </button>
          )}
        </div>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      <p className={`${tamValor} font-bold leading-tight font-mono-display whitespace-nowrap`} style={{ color }}>{displayValue}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>{sub}</p>}
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
  const [verMas, setVerMas] = useState(false)

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
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-4"
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
      {/* Sheet pegado abajo en movil (donde alcanza el pulgar) y dialogo
          centrado en desktop. Radio 20px, que es el que manda el canon para
          modales y sheets; antes era 16px, fuera de escala. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={info.titulo || 'Explicación'}
        className="relative w-full max-w-[640px] max-h-[85vh] max-h-[85dvh] overflow-y-auto rounded-t-[20px] sm:rounded-[20px]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--cf-surface)',
          border: `1px solid color-mix(in srgb, ${color} 35%, var(--cf-border))`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'cardFadeUp 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Header con color del KPI */}
        <div
          className="px-4 py-3 flex items-center justify-between sticky top-0 z-10"
          style={{ background: `color-mix(in srgb, ${color} 12%, var(--cf-surface))`, borderBottom: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
            <p className="text-[12px] font-extrabold uppercase tracking-[.07em] truncate" style={{ color }}>{info.titulo || '¿Qué es?'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[18px] leading-none w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--cf-fill)] shrink-0"
            style={{ color: 'var(--cf-ink-2)' }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Contenido progresivo. Antes eran CINCO bloques planos, cada uno con
            su eyebrow en mayusculas: demasiado para aclarar una cifra (el
            limite de memoria de trabajo son ~4 elementos) y la repeticion del
            eyebrow en todos es andamiaje, no jerarquia. Ahora: la explicacion
            y TU numero visibles, el resto detras de "Ver mas". No se perdio
            ni una palabra del contenido. */}
        <div className="p-4 sm:p-5 text-[12px] leading-relaxed space-y-3">
          {info.que && (
            <p style={{ color: 'var(--cf-ink)' }}>{info.que}</p>
          )}

          {/* Lo mejor del panel: la formula con las cifras REALES del usuario.
              Este si lleva etiqueta, porque avisa que habla de SUS numeros. */}
          {info.ejemplo && (
            <div
              className="rounded-[12px] px-3 py-2.5"
              style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color }}>Tu número ahora</p>
              <p style={{ color: 'var(--cf-ink)' }}>{info.ejemplo}</p>
            </div>
          )}

          {info.comoSeCalcula && (
            <div className="rounded-[12px] px-3 py-2.5" style={{ background: 'var(--cf-fill)' }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-3)' }}>Cómo se calcula</p>
              <p style={{ color: 'var(--cf-ink-2)' }}>{info.comoSeCalcula}</p>
            </div>
          )}

          {(info.cuandoCambia || info.tip) && (
            <>
              {!verMas && (
                <button
                  onClick={() => setVerMas(true)}
                  className="w-full rounded-[12px] py-2 text-[11px] font-medium transition-colors hover:bg-[var(--cf-fill)]"
                  style={{ color: 'var(--cf-ink-2)', border: '1px dashed var(--cf-border)' }}
                >
                  Ver más
                </button>
              )}
              {verMas && (
                <div className="space-y-3">
                  {info.cuandoCambia && (
                    <div className="rounded-[12px] px-3 py-2.5" style={{ background: 'var(--cf-fill)' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-3)' }}>Cuándo cambia</p>
                      <p style={{ color: 'var(--cf-ink-2)' }}>{info.cuandoCambia}</p>
                    </div>
                  )}
                  {info.tip && (
                    <div
                      className="rounded-[12px] px-3 py-2.5"
                      style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 20%, transparent)' }}
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-gold-dark)' }}>Tip</p>
                      <p style={{ color: 'var(--cf-ink-2)' }}>{info.tip}</p>
                    </div>
                  )}
                </div>
              )}
            </>
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
  // Mismo criterio que KpiCard: sin count-up (mostraba cifras falsas mientras
  // animaba) y sin truncate (un monto recortado no sirve para nada).
  const textoMonto = formatMoney(Math.round(monto || 0))
  const tamMonto = textoMonto.length >= 14 ? 'text-[15px]'
    : textoMonto.length >= 12 ? 'text-[17px]'
    : 'text-xl'
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
      className={`rounded-[18px] px-[19px] py-4 relative ${hasInfo ? 'cursor-pointer' : ''}`}
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[11px]" style={{ color: 'var(--cf-ink-2)' }}>{label}</p>
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
      <p className={`${tamMonto} font-bold font-mono-display whitespace-nowrap`} style={{ color }}>{textoMonto}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{cantidad} {cantidad === 1 ? 'pago' : 'pagos'} {label.toLowerCase().includes('mes') ? 'en el mes' : 'registrados'}</p>
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
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
            <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>{cuotaDiaria > 0 ? `${pct}% de la cuota diaria` : 'Sin cuotas esperadas'}</p>
        </>
      )}
      {pct !== null && sparklineData && (
        <>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
            <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{pct}% de la cuota diaria</p>
        </>
      )}
      {extraSub && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--cf-red-dark)' }} />
          <p className="text-[10px]" style={{ color: 'var(--cf-red-dark)' }}>{extraSub}</p>
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
      color="var(--cf-ink-2)"
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
      className="relative overflow-hidden rounded-[18px] px-[19px] py-4 transition-all duration-200 group flex items-center gap-3 active:scale-[0.98]"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-[0.05] pointer-events-none" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 relative z-10" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0 relative z-10">
        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--cf-ink)' }}>{label}</p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{desc}</p>
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
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
      = vs ayer
    </span>
  )
  const positivo = diff > 0
  const color = positivo ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)'
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

  // Seccion con titulo, NO una card. Antes este contenedor era una card
  // (fondo + borde + radio 16) que contenia KpiCards que tambien son cards con
  // la misma superficie: card dentro de card y doble borde, que el canon
  // prohibe. Ahora el grupo solo etiqueta y agrupa; las tarjetas de adentro son
  // las unicas con superficie propia.
  return (
    <div>
      <button
        onClick={toggle}
        className="w-full px-1 py-2 flex items-center justify-between gap-2 rounded-[12px] transition-colors hover:bg-[var(--cf-fill)]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-3) 12%, transparent)', color: 'var(--cf-ink-2)' }}>
            {icon}
          </div>
          <h2 className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-2)' }}>{title}</h2>
        </div>
        <svg className={`w-4 h-4 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--cf-ink-3)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pt-1.5">
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
    color: 'var(--cf-green-dark)',
    text: `${pagos.cantidad} ${pagos.cantidad === 1 ? 'pago' : 'pagos'}`,
    monto: formatMoney(pagos.monto),
  })
  if (prestamos.cantidad > 0) items.push({
    icon: Icons.prestamoOut,
    color: 'var(--cf-gold-dark)',
    text: `${prestamos.cantidad} ${prestamos.cantidad === 1 ? 'préstamo entregado' : 'préstamos entregados'}`,
    monto: formatMoney(prestamos.monto),
  })
  if (esOwner && gastos && gastos.cantidad > 0) items.push({
    icon: Icons.gasto,
    color: 'var(--cf-gold-dark)',
    text: `${gastos.cantidad} ${gastos.cantidad === 1 ? 'gasto' : 'gastos'}`,
    monto: formatMoney(gastos.monto),
  })
  if (esOwner && retiros && retiros.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--cf-red-dark)',
    text: 'Retiro de caja',
    monto: formatMoney(retiros.monto),
  })
  if (esOwner && inyecciones && inyecciones.monto > 0) items.push({
    icon: Icons.retiro,
    color: 'var(--cf-green-dark)',
    text: 'Inyección de capital',
    monto: formatMoney(inyecciones.monto),
  })

  const sinMovimientos = items.length === 0 && (!desgloseCobradores || desgloseCobradores.length === 0)

  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--cf-border)' }}>
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)', color: 'var(--cf-gold)' }}>
          {Icons.actividad}
        </div>
        <h2 className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-2)' }}>Movimientos de hoy</h2>
      </div>
      <div className="px-4 py-3">
        {sinMovimientos && (
          <p className="text-[12px] text-center py-2" style={{ color: 'var(--cf-ink-3)' }}>
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
                  <span className="text-[13px] truncate" style={{ color: 'var(--cf-ink)' }}>{it.text}</span>
                </div>
                <span className="text-[13px] font-bold font-mono-display shrink-0" style={{ color: it.color }}>{it.monto}</span>
              </div>
            ))}
          </div>
        )}
        {esOwner && desgloseCobradores && desgloseCobradores.length > 0 && (
          <div className={`${items.length > 0 ? 'mt-3 pt-3 border-t' : ''}`} style={{ borderColor: 'var(--cf-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--cf-ink-3)' }}>
              <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{Icons.clientes}</span>
              Por cobrador
            </p>
            <div className="space-y-1.5">
              {desgloseCobradores.map((c) => (
                <div key={c.cobradorId || 'sin'} className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--cf-ink-2)' }}>{c.nombre}</span>
                  <span className="font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                    <span style={{ color: 'var(--cf-ink-3)' }}>{c.pagos} {c.pagos === 1 ? 'pago' : 'pagos'}</span>
                    <span className="mx-1.5" style={{ color: 'var(--cf-ink-3)' }}>·</span>
                    <span style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(c.monto)}</span>
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
// ¿Que ruta va mal HOY? Con varias rutas esa es la pregunta de la mañana, y
// hasta ahora tocaba entrar a Caja > Por ruta y revisarlas de a una. El dato ya
// venia en /api/rutas (esperadoHoy y recaudadoHoy por ruta), solo no se pintaba.
// Orden: la PEOR primero, que es la que hay que empujar. Un ranking que empieza
// por la mejor es decorativo; este es para actuar.
function RutasHoy({ rutas }) {
  const conActividad = (rutas || []).filter(r => (r.esperadoHoy || 0) > 0 || (r.recaudadoHoy || 0) > 0)
  if (conActividad.length === 0) return null

  const pctDe = (r) => {
    const meta = r.esperadoHoy || 0
    if (meta <= 0) return (r.recaudadoHoy || 0) > 0 ? 100 : 0
    return Math.min(100, Math.round(((r.recaudadoHoy || 0) / meta) * 100))
  }
  const ordenadas = [...conActividad].sort((a, b) => pctDe(a) - pctDe(b))
  const totalEsperado = conActividad.reduce((a, r) => a + (r.esperadoHoy || 0), 0)
  const totalRecaudado = conActividad.reduce((a, r) => a + (r.recaudadoHoy || 0), 0)

  return (
    <div
      className="rounded-[16px] px-4 py-4"
      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-2)' }}>
          Por ruta hoy
        </p>
        <span className="text-[11px] font-mono-display whitespace-nowrap" style={{ color: 'var(--cf-ink-3)' }}>
          {formatMoney(totalRecaudado)} de {formatMoney(totalEsperado)}
        </span>
      </div>
      <div className="space-y-1">
        {ordenadas.map((r) => {
          const pct = pctDe(r)
          const color = pct >= 80 ? 'var(--cf-green-dark)'
            : pct >= 40 ? 'var(--cf-gold-dark)'
            : 'var(--cf-red-dark)'
          return (
            <Link
              key={r.id}
              href={`/rutas/${r.id}`}
              className="block rounded-[12px] px-2 py-2 -mx-2 transition-colors hover:bg-[var(--cf-fill)]"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--cf-ink)' }}>
                  {r.nombre}
                </span>
                <span className="text-[12px] font-bold font-mono-display shrink-0" style={{ color }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'var(--cf-fill)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                />
              </div>
              <p className="text-[10px] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                {formatMoney(r.recaudadoHoy || 0)} de {formatMoney(r.esperadoHoy || 0)}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function NecesitaAtencion({ alertas, moraData }) {
  if (!alertas) return null
  const items = []
  const mora30 = moraData?.agrupado?.mora31plus?.length ?? 0
  if (mora30 > 0) items.push({
    color: 'var(--cf-red-dark)',
    text: `${mora30} ${mora30 === 1 ? 'préstamo con más de 30 días de mora' : 'préstamos con más de 30 días de mora'}`,
    href: '/clientes?filtro=mora',
  })
  if (alertas.clientesSinRuta > 0) items.push({
    color: 'var(--cf-gold-dark)',
    text: `${alertas.clientesSinRuta} ${alertas.clientesSinRuta === 1 ? 'cliente sin ruta asignada' : 'clientes sin ruta asignada'}`,
    href: '/clientes?sinRuta=1',
  })
  if (alertas.prestamosSinPagosLargo > 0) items.push({
    color: 'var(--cf-gold-dark)',
    text: `${alertas.prestamosSinPagosLargo} ${alertas.prestamosSinPagosLargo === 1 ? 'préstamo sin pagos hace más de 7 días' : 'préstamos sin pagos hace más de 7 días'}`,
    href: '/prestamos?sinPagosDias=7',
  })
  const proximos = alertas.proximosACompletar?.length ?? 0
  if (proximos > 0) items.push({
    color: 'var(--cf-green-dark)',
    text: `${proximos} ${proximos === 1 ? 'préstamo listo para renovar' : 'préstamos listos para renovar'} (80%+ pagado)`,
    href: '#renovar',
    scroll: true,
  })

  if (items.length === 0) return null

  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, var(--cf-border))',
      }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--cf-border)', background: 'color-mix(in srgb, var(--cf-gold-dark) 6%, transparent)' }}>
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 18%, transparent)', color: 'var(--cf-gold-dark)' }}>
          {Icons.alerta}
        </div>
        <h2 className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-gold-dark)' }}>Necesita tu atención</h2>
      </div>
      <div className="px-2 py-1">
        {items.map((it, i) => (
          <Link key={i} href={it.href} className="flex items-center justify-between gap-2 py-2 px-2 rounded-[8px] transition-colors hover:bg-[var(--cf-fill)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: it.color }} />
              <span className="text-[12px] truncate" style={{ color: 'var(--cf-ink)' }}>{it.text}</span>
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
  const [verTodosRenovar, setVerTodosRenovar] = useState(false)
  if (!lista?.length) return null

  return (
    <div
      id="renovar"
      className="rounded-[16px] overflow-hidden"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid color-mix(in srgb, var(--cf-green-dark) 25%, var(--cf-border))',
      }}
    >
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--cf-border)', background: 'color-mix(in srgb, var(--cf-green-dark) 6%, transparent)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 18%, transparent)', color: 'var(--cf-green-dark)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
            </svg>
          </div>
          <h2 className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-green-dark)' }}>Listos para renovar</h2>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)', color: 'var(--cf-green-dark)' }}>
          {lista.length}
        </span>
      </div>
      <div className="px-2 py-1">
        {/* CINCO, no veinte. Con la lista entera este bloque ocupaba media
            pantalla y competia con todo lo de arriba, incluida la plata puesta.
            El dueño lo quiso visible y visible se queda — pero visible no es lo
            mismo que dominante. Vienen ordenados por lo que les falta, asi que
            los cinco primeros son los que de verdad estan por caer. */}
        {lista.slice(0, verTodosRenovar ? lista.length : 5).map((p) => (
          <Link
            key={p.prestamoId}
            href={`/prestamos/${p.prestamoId}`}
            className="flex items-center justify-between gap-2 py-2.5 px-2 rounded-[8px] transition-colors hover:bg-[var(--cf-fill)]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--cf-ink)' }}>
                  {p.clienteNombre}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)', color: 'var(--cf-green-dark)' }}>
                  {p.porcentaje}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                <span>Faltan {formatMoney(p.saldoPendiente)}</span>
                {p.cuotasRestantes > 0 && <span>{p.cuotasRestantes} cuotas</span>}
                {p.rutaNombre && <span>{p.rutaNombre}</span>}
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--cf-border)' }}>
                <div className="h-full rounded-full" style={{ width: `${p.porcentaje}%`, background: 'var(--cf-green-dark)' }} />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-medium" style={{ color: 'var(--cf-green-dark)' }}>Renovar</span>
              <svg className="w-3 h-3" style={{ color: 'var(--cf-green-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
        {!verTodosRenovar && lista.length > 5 && (
          <button
            type="button"
            onClick={() => setVerTodosRenovar(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-[999px] text-[12px] font-semibold transition-colors hover:bg-[var(--cf-fill)]"
            style={{ background: 'var(--cf-fill)', border: 0, color: 'var(--cf-ink-2)', cursor: 'pointer' }}
          >
            Ver los otros {lista.length - 5}
          </button>
        )}
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

  const accentColor = urgente ? 'var(--cf-red-dark)' : 'var(--cf-gold)'
  const gradientBg = urgente
    ? 'var(--cf-card)'
    : 'var(--cf-card)'

  return (
    <a href="/configuracion/plan"
      className="block rounded-[16px] px-4 py-3.5 transition-all hover:scale-[1.005] active:scale-[0.995] relative overflow-hidden"
      style={{ background: gradientBg, border: '1px solid var(--cf-border)' }}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-11 h-11 shrink-0">
          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--cf-fill)" strokeWidth="3.5" />
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
          <p className="text-[12px] font-semibold text-[var(--cf-ink)]">
            {dias} dias restantes
          </p>
          <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">{mensaje}</p>
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

/**
 * Un resumen a medias es peor que ninguno: el render deshace `data.cobros.hoy`
 * y `data.clientes.total` directamente, asi que basta con que falte una de las
 * dos claves para que la pantalla entera se caiga con un TypeError.
 * Se comprueban SOLO las que el render deshace sin guarda.
 */
function esResumenValido(d) {
  return Boolean(d) && typeof d === 'object' && Boolean(d.cobros) && Boolean(d.clientes)
}

export default function DashboardPage() {
  const { session, loading: authLoading, esOwner, puedeCrearClientes, puedeCrearPrestamos } = useAuth()
  // «Actualizar» de T02-07. Solo sale en 1440: en el telefono se recarga
  // tirando hacia abajo, y un boton mas en una pantalla estrecha sobra.
  const [refrescando, setRefrescando] = useState(false)

  // ── LUCAS AL LADO, NO ENCIMA (T43-04) ──
  // La lámina: «En escritorio Lucas no es una hoja que tapa la pantalla: es una
  // columna de 396px al lado. Así el dueño ve su patrimonio y la respuesta a la
  // vez... Taparle el panel para contestarle sería quitarle el contexto que le
  // da sentido a la respuesta.»
  //
  // Hoy preguntarle obliga a IRSE del panel a /asistente, que es la misma
  // pérdida de contexto en su version peor: no tapa los números, los quita.
  //
  // Se abre a peticion y no siempre: dejarla fija le come 396px al panel a todo
  // el mundo, incluido quien no usa el asistente. La lamina pide que NO TAPE,
  // no que este siempre puesta.
  const [lucas, setLucas] = useState(false)

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
  const [rutasData, setRutasData] = useState(null)
  const [equipoOpen, setEquipoOpen] = useState(false)

  // Vista simple = solo lo esencial (Cobros + Tu dinero). Vista pro = todo.
  // El dashboard arranca respondiendo TRES preguntas: como voy hoy, quien no me
  // pago, y cuanta plata tengo. Lo demas (mes, cartera, clientes, operacion,
  // equipo, detalle de mora) vive detras de "Ver mas metricas". Antes arrancaba
  // mostrandolo todo: ~20 secciones y 7 pantallas de scroll en movil antes de
  // llegar a lo unico accionable.
  const [vistaSimple, setVistaSimple] = useState(true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cf-dashboard-vista')
      // Simetrico a proposito: antes solo restauraba 'simple', asi que al
      // cambiar el default quien hubiera elegido 'pro' quedaba atrapado.
      if (stored === 'simple') setVistaSimple(true)
      else if (stored === 'pro') setVistaSimple(false)
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
    /* ── LA RED SALE PRIMERO, Y LA CACHÉ PINTA MIENTRAS LLEGA ──────────────
       El «cache-first» de abajo es correcto en la idea y estaba mal en el
       orden: se hacía `await leerDeCache(...)` y la petición no salía hasta
       terminar de leer IndexedDB. La red se quedaba parada esperando al
       teléfono. Ahora salen a la vez — mismo dato, igual de fresco, pedido
       antes. */
    const enCamino = navigator.onLine
      ? fetch(`/api/dashboard/resumen?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }).then((r) => r.json()).catch(() => null)
      : null
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
      // La petición ya salió arriba, con su cache-buster: ni el navegador ni
      // ningún intermediario pueden devolver una respuesta vieja.
      const d = enCamino ? await enCamino : null
      if (!d) throw new Error('offline')
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
        // El render deshace data.cobros.hoy y data.clientes.total sin guarda, asi
        // que un cache viejo o a medias no tumba la peticion: tumba la PANTALLA
        // entera con un TypeError. Vale mas quedarse sin resumen que en blanco.
        if (esResumenValido(cached)) {
          setData(cached)
          if (!navigator.onLine) setIsOffline(true)
          return
        }
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
      fetch(`/api/rutas?t=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setRutasData(d) })
        .catch(() => {})
    }
  }, [loadDashboard, loadMora, loadCapital, esOwner])

  useEffect(() => {
    if (authLoading) return
    const fetches = [loadDashboard(), loadMora()]
    if (esOwner) {
      fetches.push(loadCapital())
      fetches.push(
        fetch('/api/pagos/estado').then(r => r.json())
          .then(d => { if (d.diasRestantes !== undefined) setSusInfo(d) })
          .catch(() => {})
      )
      fetches.push(
        fetch(`/api/equipo/resumen?t=${Date.now()}`, { cache: 'no-store' })
          .then(r => r.json()).then(d => { if (d.cobradores) setEquipoData(d) })
          .catch(() => {})
      )
      fetches.push(
        fetch(`/api/rutas?t=${Date.now()}`, { cache: 'no-store' })
          .then(r => r.json()).then(d => { if (Array.isArray(d)) setRutasData(d) })
          .catch(() => {})
      )
    }
    Promise.allSettled(fetches)
  }, [authLoading, esOwner, loadDashboard, loadMora, loadCapital, lastSyncedAt])

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
            // Sin dismiss(): eso marcaba el paso 99 (onboarding cerrado para
            // siempre) y dejaba sin guia a quien salio del wizard con la cuenta
            // vacia. El wizard ya persistio el paso 50; al recargar aparece la
            // lista de misiones.
            window.location.reload()
          }}
          onMinimize={() => {
            onboarding.minimize()
          }}
        />
      </div>
    )
  }

  // ── T22-00 · MIENTRAS NO HAYA CARTERA, EL PANEL ES TRAERLA ──
  //
  // Esto no es una pantalla de bienvenida: es el arreglo del cuello de botella.
  // Medido sobre la base real, los clientes cargados predicen el pago —con 0 la
  // conversion es 0%, entre 51 y 150 es el 74%— y el 75% de las organizaciones
  // se queda atascada en cinco clientes o menos.
  //
  // La causa es que el asistente es DE UN SOLO TIRO: se cierra (paso 99) y no
  // vuelve nunca. Quien lo termina sin cargar nada aterriza en un panel vacio y
  // ahi se queda. Una pantalla de arranque mas bonita no arregla eso; que VUELVA
  // cada vez que entra hasta que tenga cartera, si.
  //
  // Y no estorba: no tapa nada, es el CONTENIDO del panel, que de todas formas
  // esta vacio. El «puedes cerrar esto y volver cuando quieras» deja de ser una
  // promesa y pasa a ser verdad.
  //
  // Solo al dueño: al cobrador no le toca subir la cartera, y ademas el servidor
  // le manda `finanzas: null`.
  if (esOwner && !loading && data && (data.clientes?.total ?? 0) === 0) {
    return (
      <div className="max-w-3xl lg:max-w-6xl mx-auto">
        <TraerCartera
          nombre={session?.user?.nombre || session?.user?.name}
          // LA FOTO, que es el camino rapido: el migrador lee la cartulina.
          onFoto={() => { window.location.href = '/migrador' }}
          onExcel={() => { window.location.href = '/carga-masiva' }}
          onCero={() => { window.location.href = '/prestamos/nuevo' }}
          onEscribirnos={() => { window.location.href = '/soporte/nuevo' }}
          // SOLO LO QUE SE PUEDE COMPROBAR. La lamina dibuja tambien «como
          // prestas» en verde, pero aqui no hay forma de saber si de verdad lo
          // configuro, y marcarle como hecho algo que no hizo es peor que no
          // enseñarlo. Los tres de abajo son ciertos: esta dentro (cuenta), esta
          // en esta pantalla (cartera), y no ha cobrado nada (0 clientes).
          pasos={[
            { texto: 'Crear tu cuenta', hecho: true },
            { texto: 'Traer tu cartera', actual: true },
            { texto: 'Salir a cobrar' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className={lucas ? 'xl:flex xl:gap-5 xl:items-start' : undefined}>
    <div className={`max-w-3xl lg:max-w-6xl mx-auto space-y-5${lucas ? ' xl:mx-0 xl:flex-1 xl:min-w-0' : ''}`}>
      {/* Banner: wizard minimizado — click to resume */}
      {onboarding.showWizard && onboarding.wizardMinimized && esOwner && (
        <button
          onClick={() => onboarding.unminimize()}
          className="w-full flex items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-all active:scale-[0.99] cursor-pointer"
          style={{ background: 'color-mix(in srgb, var(--cf-gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, transparent)' }}>
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}>
            <svg className="w-4 h-4" fill="none" stroke="var(--cf-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-gold)' }}>Continuar configuración</p>
            <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Retoma el asistente donde lo dejaste</p>
          </div>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24">
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
          reapertura={onboarding.reapertura}
        />
      )}
      {!authLoading && !esOwner && session?.user?.id && (
        <CobradorOnboarding userId={session.user.id} />
      )}
      {/* ── LA CAMPAÑA DE FOTOS, y VA DESPUÉS DEL ONBOARDING ──
          Quien está configurando la cuenta tiene una tarea a medias; pedirle un
          favor por encima de ella es cambiarle el orden a lo suyo. Esto puede
          esperar tres renglones.

          Solo al dueño: el cuaderno es suyo, y es quien puede decidir compartir
          los datos de sus clientes. Un cobrador no tiene por qué tomar esa
          decisión por él.

          El componente se borra solo cuando la campaña cierra —por llegar a las
          40 fotos o por pasar el lunes— así que quitarlo de aquí no es urgente,
          pero sí conviene: es código de una campaña de tres días. */}
      {esOwner && <BannerFotosDonadas />}
      {/* El promotor de la app SALE de la pila de arriba. Segun el orden del
          diseño es «lo comodo» —no pierdes un peso por no instalarla hoy— y
          estaba haciendo de tercera franja ambar seguida. Cuatro franjas ambar
          no son cuatro avisos: son una pared, y cuando todo esta en ambar nada
          lo esta.

          PENDIENTE: su sitio es la campana, junto con los demas avisos que no
          ganen la franja (ver lib/adaptadores/avisos.js). Mientras tanto la app
          se sigue pudiendo instalar desde el navegador. */}
      <SpotlightOverlay
        spotlight={onboarding.spotlight}
        onClose={onboarding.hideSpotlight}
      />
      {/* El saludo, el subtítulo «Resumen de tu cartera hoy» y la hora de
          actualización se fueron: el saludo vive ahora dentro del Panel, y los
          otros dos no respondían ninguna pregunta. */}
      {/* LA BANDA DE SUSCRIPCION BAJA, no se borra. Abria la pantalla por
          delante del saludo y se comia 150px justo donde T02-01 pone el hero, y
          encima quedaba debajo de la franja «Pasaste el limite de tu plan»: dos
          avisos de plan apilados es el ruido que PilaAvisos existe para evitar.
          Sigue estando —es un aviso de renovacion, no adorno— pero despues de
          lo que el dueno abrio la pantalla a mirar. Ver mas abajo. */}
      {isOffline && (
        <div className="text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--cf-gold-tint)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)', color: 'var(--cf-gold-dark)' }}>
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--cf-gold-dark)' }} />
          Datos guardados — sin conexión
        </div>
      )}
      {error && <div className="text-sm rounded-[12px] px-4 py-3" style={{ background: 'var(--cf-red-pill-bg)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)', color: 'var(--cf-red-dark)' }}>{error}</div>}


      {loading || !mounted ? (
        <div className="space-y-3">
          <KpiGroupSkeleton kpis={2} />
          <KpiGroupSkeleton kpis={2} />
          <KpiGroupSkeleton kpis={2} />
        </div>
      ) : data && data.clientes?.total === 0 && data.prestamos?.activos === 0 && esOwner ? (
        <div className="flex flex-col items-center text-center py-8">
          <MonedaCF pose="guia" size={100} />
          <h2 className="text-lg font-bold mt-4 mb-1" style={{ color: 'var(--cf-ink)' }}>
            Tu cartera está lista
          </h2>
          <p className="text-[13px] max-w-[280px] mx-auto mb-6 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
            Ya configuraste el sistema. Ahora sube tus clientes para que el dashboard cobre vida.
          </p>
          <div className="w-full max-w-sm space-y-2.5">
            <Link href="/migrador" className="group flex items-center gap-3 w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'color-mix(in srgb, var(--cf-gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold) 25%, transparent)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)', color: 'var(--cf-gold)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>Sube tu cartera</p>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Foto de cartulina, Excel o manual</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/clientes/nuevo" className="group flex items-center gap-3 w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 10%, transparent)', color: 'var(--cf-ink-2)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>Crear cliente manual</p>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Agrega uno a uno desde el formulario</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/prestamos/nuevo" className="group flex items-center gap-3 w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 10%, transparent)', color: 'var(--cf-green-dark)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>Crear un prestamo</p>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>El sistema calcula cuota y saldo</p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      ) : data && (
        <>
          {/* Desktop: grid de 2 columnas para hero + strip lateral */}
          {/* ── Se va la columna de KPIs de escritorio ──
              Repetía lo que el Panel ya dice, y no una vez: «en mora» salía
              CUATRO veces en la misma pantalla (en el bloque oscuro, en el KPI
              rojo, en la fila de atención y en el aviso del 83%), y el saldo de
              caja, dos. Un número repetido no se lee cuatro veces: se deja de
              leer, y encima invita a compararlos por si no cuadran.

              El Panel pasa a ancho completo. Lo único de esa columna que no
              estaba en otro sitio era el consejo de IA, que se queda. */}
          {/* ── EL PANEL DEL REDISEÑO ──
              Sustituye al HeroCard SIN PERDER NADA: lo cobrado, lo esperado, la
              ganancia, cuántos pagos, el histórico de siete días y la frase que
              interpreta el día siguen ahí, más el patrimonio y las alertas.

              Y el bloque se voltea con la hora: hasta que entra el primer pago
              el titular mira hacia adelante, porque un «recaudado hoy $0» a las
              7 de la mañana es inútil. */}
          <Panel
            {...adaptarPanel(data, {
              nombre: session?.user?.nombre || session?.user?.name,
              hora: new Date().getHours(),
              // Ya no va en 0. El resumen daba la PLATA que toca cobrar hoy
              // (`esperadoHoy`) pero no A CUANTOS, asi que el bloque del dia no
              // se pintaba. Ahora el endpoint cuenta los clientes en el MISMO
              // bucle y con la MISMA regla que la plata, en un Set por
              // clienteId: un cliente con tres prestamos que vencen hoy es UNA
              // visita, no tres.
              clientesHoy: data?.prestamos?.clientesConCobroHoy ?? 0,
            })}
            // «martes 28 de julio». T40-00-a la dibuja bajo el saludo y no
            // salia: el adaptador no la produce y el Panel solo la pinta si
            // llega. Se formatea aca porque depende de la zona del NAVEGADOR:
            // hecha en el servidor, sale el dia de UTC y en Bogota eso se
            // equivoca en las cinco primeras horas del dia.
            fecha={new Date().toLocaleDateString('es-CO', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
            porRuta={porRutaHoy(rutasData, session?.user?.country)}
            // Para que la barra dorada pueda decir cuánto fue cada día al
            // tocarla. El país sale de la sesión, que el componente no ve.
            fmt={(n) => formatMoney(n, session?.user?.country)}
            // LA RANURA QUE CIERRA EL HUECO DE 1440. Iba debajo de la rejilla, a
            // ancho completo, y por eso la columna izquierda se quedaba con un
            // vacio enorme: un bloque a ancho completo no empieza hasta que
            // acaba la celda mas alta de la fila. Dentro de la columna, cuadra.
            bajoAtencion={esOwner && data.finanzas ? (() => {
              const pd = adaptarPanelDinero(data, rutasData)
              const dinero = (n) => formatMoney(n, session?.user?.country)
              return <PanelDinero datos={pd} nota={notaDelPanel(pd, dinero)} fmt={dinero} />
            })() : null}
            sinMargen
            onIr={(destino) => { window.location.href = destino }}
            // ── T02-07 · LAS DOS ACCIONES DE 1440 ──
            // En el telefono estas dos viven en el FAB y en la pastilla, y ahi
            // esta bien: la mano llega abajo. Sentado no hay FAB que valga —el
            // raton esta arriba— y la lamina las pone a la derecha del saludo.
            // Solo se pintan en `lg`; el componente las esconde en movil.
            acciones={<>
              <button
                type="button"
                onClick={() => { setRefrescando(true); loadDashboard().finally(() => setRefrescando(false)) }}
                disabled={refrescando}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, height: 44,
                  padding: '0 18px', borderRadius: 14, cursor: refrescando ? 'progress' : 'pointer',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-3.2-6.9M21 3v5h-5" />
                </svg>
                {refrescando ? 'Actualizando…' : 'Actualizar'}
              </button>
              {/* Solo desde `xl`: la columna mide 396px y por debajo de eso no
                  cabe sin comerse el panel, que es justo lo que la lámina
                  quiere evitar. En móvil Lucas sigue en el FAB y en «Más».
                  El display va SOLO en la clase, nunca en línea. */}
              {esOwner && !lucas && (
                <button
                  type="button"
                  onClick={() => setLucas(true)}
                  className="hidden xl:inline-flex items-center gap-2"
                  style={{
                    height: 44, padding: '0 18px', borderRadius: 14, cursor: 'pointer',
                    background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                    font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  Preguntar a Lucas
                </button>
              )}
              {puedeCrearPrestamos && (
                <button
                  type="button"
                  onClick={() => { window.location.href = '/prestamos/nuevo' }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', height: 44,
                    padding: '0 20px', borderRadius: 14, border: 0, cursor: 'pointer',
                    background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                    font: 'inherit', fontSize: 14, fontWeight: 700,
                  }}
                >Nuevo préstamo</button>
              )}
            </>}
          />

          {/* La banda de suscripcion, AQUI. Ver la nota de arriba: antes abria
              la pantalla y empujaba el hero fuera de la primera vista. */}
          {esOwner && susInfo && <BandaSuscripcion dias={susInfo.diasRestantes} />}

          {/* ⚠ `DashboardAiTip` SE FUE DE AQUI.
              Repetia la mora que la tarjeta blanca ya dice tres centimetros mas
              arriba —«655 de tus 972 clientes estan en mora (67%)»— y la
              cabecera de `Panel.jsx` fija que «la mora se dice UNA vez».
              Su otra rama, la del avance del dia, media contra
              `cuotaDiariaTotal`: la suma de TODAS las cuotas de la cartera, que
              la propia pantalla rotula «es un techo». La pantalla decia 48% y el
              consejo 9%, del mismo dia.
              Lo sustituye la nota de `PanelDinero`, que es determinista y sale
              de las mismas cifras que el panel enseña. */}


          {/* El segundo «Necesita tu atención» se va: había DOS bloques con el
              mismo título diciendo cosas distintas —uno «8 sin pagar hace más
              de 15 días», el otro «8 préstamos sin pagos hace más de 7 días»—.
              Mismo número, umbral distinto: uno de los dos mentía (el bueno es
              7, que es lo que usa el endpoint). Dos verdades con el mismo
              rótulo es peor que ninguna, porque obliga a elegir a ojo.

              El del Panel se queda: lleva la misma información con la cifra
              correcta y su enlace. */}

          {/* «Como va cada ruta hoy» AHORA VIVE DENTRO DEL PANEL, que es donde
              lo pone T02-01 («Por ruta hoy», el ultimo bloque). Este era un
              segundo bloque con la misma informacion justo debajo: dos veces la
              misma tabla de rutas, una con el diseno nuevo y otra con el viejo.
              Es el mismo defecto que el «Necesita tu atencion» duplicado de
              arriba, y se corrige igual: se queda el del Panel. */}

          {/* Recaudado del mes + interes — en desktop side by side */}
          {!vistaSimple && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
          <RecaudoCard
            label="Recaudado este mes"
            color="var(--cf-gold)"
            colorHex="var(--cf-gold)"
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
              color="var(--cf-green-dark)"
              colorHex="var(--cf-green-dark)"
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

          {/* ── LAS DOS PREGUNTAS QUE EL PANEL NO CONTESTABA ───────────────
              «¿Cuánta plata tengo puesta?» y «¿cuánto estoy ganando?».

              Aquí había UNA tarjeta, Patrimonio, dentro de un `KpiGroup`
              llamado «Tu dinero». Patrimonio es caja + por cobrar: contesta
              «cuánto vale mi negocio», que no es ninguna de las dos. El dueño
              pidió ver su plata puesta CON intereses y SIN ellos, porque la
              diferencia entre las dos es lo que va a ganar — y eso no estaba
              en ninguna pantalla.

              Patrimonio no se pierde: sigue bajo «ver todo». Lo que cambia es
              qué se ve sin tener que abrir nada. */}
          {/* Toggle "Mostrar mas / menos KPIs" — sutil, contextual */}
          <button
            onClick={toggleVista}
            className="w-full rounded-[12px] py-2.5 px-4 flex items-center justify-center gap-2 transition-colors hover:bg-[var(--cf-fill)]"
            style={{
              background: 'var(--cf-card)',
              border: '1px dashed var(--cf-border)',
              color: 'var(--cf-ink-2)',
            }}
            // EL RÓTULO, no el mecanismo. Decía «Ver más métricas / Mostrar
            // solo lo esencial»: la app admitiendo que no sabe cuáles de sus 47
            // cifras importan, y llamando «métricas» a la plata de alguien.
            //
            // El plegado en sí está BIEN y se queda — el plan pedía justo eso,
            // que el resto se pliegue bajo «ver todo» y NO se borre, porque
            // alguna de esas cifras es la que alguien mira a diario y no
            // sabemos cuál. Lo que cambia es cómo se llama: arriba están las
            // respuestas, aquí abajo todo lo demás.
            title={vistaSimple ? 'Ver todo lo demás' : 'Dejar solo las respuestas'}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${vistaSimple ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-[11px] font-medium">{vistaSimple ? 'Ver todo lo demás' : 'Dejar solo las respuestas'}</span>
          </button>

          {/* Desktop: KPI groups side by side */}
          {!vistaSimple && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-5 lg:space-y-0">
          {/* Tu cartera — Cartera activa, Por cobrar */}
          <KpiGroup title="Tu cartera" icon={Icons.cartera}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Cartera activa"
                value={formatMoney(data.prestamos.saldoPorCobrar ?? data.prestamos.carteraActiva)}
                valueRaw={data.prestamos.saldoPorCobrar ?? data.prestamos.carteraActiva}
                sub={`${rotulo('capitalEnCalle')}: ${formatMoney(data.prestamos.capitalEnCalle)}`}
                color="var(--cf-gold-dark)"
                info={{
                  titulo: 'Cartera activa',
                  que: 'Lo que tus clientes te deben HOY, ya con los intereses adentro. Es la suma del saldo pendiente de todos los préstamos activos.',
                  comoSeCalcula: `Sumo el saldo pendiente (Total a pagar - Lo ya pagado) de cada préstamo activo.`,
                  ejemplo: `Tus clientes te deben ${formatMoney(data.prestamos.saldoPorCobrar ?? data.prestamos.carteraActiva)}. La promesa total cuando todos terminen de pagar es ${formatMoney(data.prestamos.carteraActiva)}, y de tu plata pura siguen afuera ${formatMoney(data.prestamos.capitalEnCalle)}.`,
                  cuandoCambia: 'Baja cada vez que un cliente paga. Sube cuando creas un préstamo nuevo.',
                  // El sub decia "Promesa total" y el capital estaba escondido bajo "Ya
                  // cobrado", que no tiene nada que ver. Un cliente sumo cartera + monto
                  // de una renovacion y reclamo $100.000 que nunca faltaron: creia que
                  // este numero era capital sin interes. Ahora el capital va aqui mismo.
                  tip: `OJO: este número incluye los intereses, no es tu capital. Tu plata pura la ves justo debajo del monto, en «${rotulo('capitalEnCalle')}».`,
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
              />
              <KpiCard
                label="Ya cobrado"
                value={formatMoney((data.prestamos.carteraActiva ?? 0) - (data.prestamos.saldoPorCobrar ?? 0))}
                valueRaw={(data.prestamos.carteraActiva ?? 0) - (data.prestamos.saldoPorCobrar ?? 0)}
                sub={`Promesa total: ${formatMoney(data.prestamos.carteraActiva)}`}
                color="var(--cf-green-dark)"
                info={{
                  titulo: 'Ya cobrado',
                  que: 'Lo que ya has recibido de los préstamos que siguen activos.',
                  comoSeCalcula: `Promesa total (${formatMoney(data.prestamos.carteraActiva)}) - Saldo pendiente (${formatMoney(data.prestamos.saldoPorCobrar ?? 0)}) = ${formatMoney((data.prestamos.carteraActiva ?? 0) - (data.prestamos.saldoPorCobrar ?? 0))}.`,
                  ejemplo: `De los préstamos activos, ya cobraste ${formatMoney((data.prestamos.carteraActiva ?? 0) - (data.prestamos.saldoPorCobrar ?? 0))} y te faltan ${formatMoney(data.prestamos.saldoPorCobrar ?? 0)}.`,
                  cuandoCambia: 'Sube cada vez que un cliente paga.',
                }}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>}
              />
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
                color="var(--cf-gold)"
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
                color="var(--cf-green-dark)"
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
                color="var(--cf-ink-2)"
                info={{
                  titulo: 'Cuota diaria total',
                  que: 'La suma de una cuota de cada préstamo activo. Sirve como referencia de cuánto mueve tu cartera, no como meta exacta del día.',
                  comoSeCalcula: 'Sumo la cuota pactada de cada préstamo activo. OJO: incluye los préstamos semanales, quincenales y mensuales, que no se cobran todos los días, y no descuenta domingos ni festivos. Por eso es un techo, no lo que toca cobrar hoy.',
                  ejemplo: `La suma de cuotas de tu cartera es ${formatMoney(data.prestamos.cuotaDiariaTotal)}. Si casi todos tus préstamos son diarios, se parece mucho a tu meta del día; si manejas semanales o quincenales, el número real de hoy es menor.`,
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

          {/* Mi equipo — dropdown colapsable, solo owner con cobradores.
              Detras de "Ver mas metricas": en un dia sin cobros son 9 filas en
              $0 ocupando una pantalla completa de movil. */}
          {!vistaSimple && esOwner && equipoData && equipoData.cobradores.length > 0 && (
            <div
              className="rounded-[16px] overflow-hidden"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
            >
              <button
                type="button"
                onClick={() => setEquipoOpen(v => !v)}
                className="w-full px-4 py-3 flex items-center gap-2 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 15%, transparent)', color: 'var(--cf-ink-2)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <span className="text-[12px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-2)' }}>Mi equipo</span>
                <span className="text-[10px] font-mono-display px-2 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)' }}>
                  {equipoData.cobradores.length}
                </span>
                <svg
                  className="w-4 h-4 ml-auto transition-transform duration-200"
                  style={{ color: 'var(--cf-ink-3)', transform: equipoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {equipoOpen && (
                /* `divide-[color]` EXPLICITO. En Tailwind 4 `divide-y` dibuja el
                    borde ABAJO y el codigo pintaba `borderTopColor`: el color no
                    llegaba y el borde caia a `currentColor`, o sea a la tinta.
                    Eso son las lineas negras duras del historial. Resto de la
                    migracion de v3 a v4. */
                <div className="divide-y divide-[var(--cf-hairline)]" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
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
                              ? 'color-mix(in srgb, var(--cf-red-dark) 12%, transparent)'
                              : 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)',
                            color: inactivo ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
                          }}
                        >
                          {c.nombre.charAt(0).toUpperCase()}
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                            style={{
                              borderColor: 'var(--cf-card)',
                              background: c.minutesSinceActivity !== null && c.minutesSinceActivity < 15
                                ? 'var(--cf-green-dark)'
                                : inactivo
                                  ? 'var(--cf-red-dark)'
                                  : 'var(--cf-ink-3)',
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{c.nombre}</p>
                            {inactivo && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}>
                                Inactivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {c.rutas.length > 0 && (
                              <span className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{c.rutas.join(', ')}</span>
                            )}
                            <span className="text-[10px]" style={{ color: inactivo ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                              {tiempoStr}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13px] font-bold font-mono-display" style={{ color: c.recaudadoHoy > 0 ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }}>
                            {formatMoney(c.recaudadoHoy)}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{c.pagosHoy} cobros</span>
                            {c.cajaCerrada && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{
                                background: c.cajaDiferencia === 0
                                  ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)'
                                  : 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)',
                                color: c.cajaDiferencia === 0 ? 'var(--cf-green-dark)' : 'var(--cf-gold-dark)',
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
          {/* Prestamos listos para renovar (80%+ pagado) */}
          {esOwner && data.alertas?.proximosACompletar?.length > 0 && (
            <ProximosARenovar alertas={data.alertas} />
          )}
          </div>
          </div>
        </>
      )}
      {/* Detalle de mora préstamo por préstamo. Es el drill-down: el resumen
          accionable ya esta arriba en "Necesita tu atencion" con enlaces. Aqui
          eran 4 bloques y 32 filas, mas de dos pantallas de movil. */}
      {!vistaSimple && !loading && mounted && moraData !== undefined && moraData.total > 0 && (
        <div
          className="rounded-[18px] px-[19px] py-4"
          style={{
            background: 'var(--cf-card)',
            border: '1px solid var(--cf-border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-2)' }}>Alertas de mora</p>
            {/* NO `--cf-ink` sobre rojo: en tema claro es casi negro y no se lee.
                La pastilla va en rojo TENUE con el texto rojo oscuro encima,
                que es el mismo par que usa `Pastilla tono="mora"`. */}
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{
              background: 'color-mix(in srgb, var(--cf-red) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--cf-red) 26%, transparent)',
              color: 'var(--cf-red-dark)',
            }}>{moraData.total} préstamos</span>
          </div>
          <div className="space-y-2">
            {moraData.agrupado.mora31plus.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 18%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--cf-red-dark)' }}>Más de 30 días ({moraData.agrupado.mora31plus.length})</p>
                {moraData.agrupado.mora31plus.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--cf-red-dark)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--cf-ink)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--cf-red-dark)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--cf-red-dark)' }}>{formatMoney(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora16a30.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 18%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--cf-gold-dark)' }}>16-30 días ({moraData.agrupado.mora16a30.length})</p>
                {moraData.agrupado.mora16a30.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--cf-gold-dark)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--cf-ink)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--cf-gold-dark)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora8a15.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--cf-gold)' }}>8-15 días ({moraData.agrupado.mora8a15.length})</p>
                {moraData.agrupado.mora8a15.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--cf-gold)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--cf-ink)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--cf-gold)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--cf-gold)' }}>{formatMoney(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora1a7.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-green-dark) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--cf-green-dark)' }}>1-7 días ({moraData.agrupado.mora1a7.length})</p>
                {moraData.agrupado.mora1a7.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--cf-green-dark)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--cf-ink)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--cf-green-dark)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {(loading || !mounted) ? <Skeleton className="h-44" /> : data && data.ultimosPagos.length > 0 && (
        <div
          className="rounded-[18px] px-[19px] py-4"
          style={{
            background: 'var(--cf-card)',
            border: '1px solid var(--cf-border)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-2)' }}>Últimos pagos</p>
            <Link href="/prestamos" className="text-[11px] hover:underline" style={{ color: 'var(--cf-gold)' }}>Ver todos →</Link>
          </div>
          {/* Ver la nota del otro `divide-y`: el color va en la clase, no en
              un `borderTopColor` que Tailwind 4 no usa. `--cf-hairline` es el
              pelo de separacion entre filas, mas suave que el borde de tarjeta. */}
          <div className="space-y-0 divide-y divide-[var(--cf-hairline)]">
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5" style={{ borderTopColor: 'var(--cf-border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--cf-ink)' }}>{p.cliente}</p>
                  <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold shrink-0 ml-3 font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>+{formatMoney(p.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Offline sync status indicator */}
      {syncMeta && !bulkSyncing && !bulkProgress && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--cf-green-dark)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                Datos offline: {syncMeta.totalClientes} clientes, {syncMeta.totalPrestamos} préstamos
                <span> · </span>
                {new Date(syncMeta.syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
              </p>
            </div>
            <button onClick={startBulkSync} className="text-[10px] transition-colors shrink-0 hover:text-[var(--cf-green-dark)]" style={{ color: 'var(--cf-ink-3)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {bulkSyncing && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 8%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-green-dark) 25%, transparent)' }}>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--cf-green-dark)' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[11px]" style={{ color: 'var(--cf-green-dark)' }}>{bulkProgress?.message || 'Sincronizando datos...'}</p>
          </div>
        </div>
      )}

      {/* Accesos rápidos — para cobrador; el owner ya tiene los botones arriba */}
      {!esOwner && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cf-ink-2)' }}>Accesos rápidos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {puedeCrearClientes && <QuickLink href="/clientes/nuevo" label="Nuevo cliente" desc="Registrar cliente" color="var(--cf-gold)" dataTour="nuevo-cliente" />}
            {puedeCrearPrestamos && <QuickLink href="/prestamos/nuevo" label="Nuevo préstamo" desc="Crear préstamo" color="var(--cf-green-dark)" dataTour="nuevo-prestamo" />}
            <QuickLink href="/caja" label="Cierre de caja" desc="Registrar cierre del día" color="var(--cf-gold-dark)" dataTour="caja" />
            <QuickLink href="/clientes" label="Clientes" desc="Ver cartera completa" color="var(--cf-ink-2)" dataTour="prestamos" />
          </div>
        </div>
      )}

      {/* El hueco del pie ya NO va aqui: lo pone el armazon para toda la app.
          Ponerlo pantalla por pantalla solo arregla la que se mira, y el dueño
          reporto que el menu tapaba el final en varias. Ver . */}
    </div>

    {/* La columna de Lucas. `hidden xl:block` y no un `display` en línea: una
        clase responsive pierde siempre contra un estilo en línea, y ya me costó
        tres veces el mismo día. */}
    {lucas && (
      <aside className="hidden xl:block w-[396px] shrink-0 sticky top-4" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="h-full rounded-[16px] overflow-hidden" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <AsistenteChat onClose={() => setLucas(false)} />
        </div>
      </aside>
    )}
    </div>
  )
}
