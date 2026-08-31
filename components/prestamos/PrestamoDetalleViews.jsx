'use client'
// components/prestamos/PrestamoDetalleViews.jsx
// Componentes visuales premium para la pagina de detalle de prestamo.
// Inspirados en Mercury / Revolut, alineados con el dashboard rediseñado.

import { useState, useEffect, useRef, useId } from 'react'
import { abreviaturaDocumento } from '@/lib/documento'
import Link from 'next/link'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import OfflineBadge from '@/components/offline/OfflineBadge'
import Avatar from '@/components/ui/Avatar'
import { getPlataformaInfo, PlataformaIcon } from '@/components/ui/LogoPlataforma'
import { Pastilla } from '@/components/cf/primitivos'

// ─── Helpers de fecha ────────────────────────────────────────────
//
// ⚠ SON DOS COSAS DISTINTAS Y SE LEEN DISTINTO:
//
//  · Un PAGO es un INSTANTE: se guarda con la hora real del cobro (el 97% a
//    horas variadas). Va en la zona de quien mira — leerlo en UTC pondría un
//    cobro de las 7 de la noche en el día siguiente.
//  · `fechaInicio`/`fechaFin` son FECHAS DE CALENDARIO calculadas en UTC
//    (`fechaDePeriodo` usa `setUTCDate`). Hay que leerlas EN UTC: un
//    `2026-03-02T00:00:00Z` visto desde Bogotá —UTC−5— es el 1 de marzo a las
//    19:00, y la ficha decía «1 de mar» un préstamo que vence el 2.
//
// Es el mismo fallo que reportó un prestamista en el comprobante. Aquí había
// una TERCERA copia del formateo, y la encontré recorriendo el DOM en el
// navegador: arreglar el comprobante y la ficha no bastó porque esta pantalla
// trae su propio helper. Ver `formatFechaCalendario` en lib/i18n.
/* ⚠ SIN EL «de» NI EL PUNTO. El ICU nuevo escribe «6 de ago. de 2026» en
   `month:'short'`: dos preposiciones y una abreviatura para decir una fecha, en
   una tarjeta donde el sitio se le está quitando al monto. Se arma a mano, igual
   que en `lib/simulacion-imagen.js`, que ya tropezó con esto.
   Solo la usa `PagoMiniCard`; no hay otra pantalla que dependa de este formato. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFecha = (d) => {
  if (!d) return '—'
  const f = new Date(d)
  if (Number.isNaN(f.getTime())) return '—'
  return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}`
}

const fmtFechaCorta = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  : '—'

// ─── Mood color (igual que cards rediseñadas) ────────────────────
export function moodColorFromPrestamo(p) {
  if (!p) return 'var(--cf-gold)'
  if (p.estado === 'completado') return 'var(--cf-green-dark)'
  if (p.estado === 'cancelado') return 'var(--cf-ink-3)'
  if ((p.diasMora ?? 0) > 7) return 'var(--cf-red-dark)'
  if ((p.diasMora ?? 0) > 0) return 'var(--cf-gold-dark)'
  return 'var(--cf-gold)'
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
function MiniSparkline({ data, color = 'var(--cf-green-dark)', height = 32 }) {
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
      <svg width={size} height={size}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cf-fill)" strokeWidth="6" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${len} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.05s linear' }}
          />
        </g>
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
      className="cf-hero-card relative rounded-[20px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 14%, var(--cf-card)) 0%, var(--cf-card) 50%, color-mix(in srgb, ${accent} 8%, var(--cf-card)) 100%)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, var(--cf-border))`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
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
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--cf-ink-2)' }}>
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
                textShadow: 'none',
              }}
            >
              {formatMoney(Math.round(animSaldo))}
            </p>
            <p className="text-[12px] mt-2" style={{ color: 'var(--cf-ink-2)' }}>
              de {formatMoney(totalAPagar)} totales
            </p>
            {prestamo.capitalRestante != null && prestamo.capitalRestante !== saldo && (
              <div
                className="mt-3 flex items-center gap-3 px-3.5 py-2.5 rounded-[12px]"
                style={{
                  background: `color-mix(in srgb, ${color} 8%, var(--cf-surface))`,
                  border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke={color} strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--cf-ink-2)' }}>
                    Capital adeudado
                  </p>
                  <p className="text-[16px] font-mono-display font-bold leading-tight mt-0.5" style={{ color: 'var(--cf-ink)' }}>
                    {formatMoney(prestamo.capitalRestante)}
                  </p>
                </div>
              </div>
            )}
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
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--cf-ink-2)' }}>Ha pagado</p>
            <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: 'var(--cf-ink)' }}>{formatMoney(totalPagado)}</p>
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--cf-ink-3)' }}>Pagos últimos 14 días</p>
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

  return (
    <div
      className="rounded-[16px] px-4 py-3.5"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar
          nombre={cliente?.nombre}
          fotoUrl={cliente?.fotoUrl}
          size={48}
          fontSize={16}
          style={cliente?.fotoUrl ? { border: `2px solid ${color}` } : undefined}
        />

        <div className="flex-1 min-w-0">
          <Link
            href={cliente?.id ? `/clientes/${cliente.id}` : '#'}
            className="text-base font-bold leading-tight truncate block hover:text-[var(--cf-gold)] transition-colors"
            style={{ color: 'var(--cf-ink)' }}
          >
            {cliente?.nombre || 'Cliente'}
          </Link>
          {cliente?.cedula && !cliente.cedula.startsWith('SIN-') && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{abreviaturaDocumento()} {cliente.cedula}</p>
          )}
          {statsCliente && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-2)' }}>{statsCliente}</p>
          )}
        </div>

        {/* Botones circulares */}
        <div className="flex items-center gap-1.5 shrink-0">
          {cliente?.telefono && onWhatsApp && (
            <button
              onClick={onWhatsApp}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(37, 211, 102, 0.18)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)' }}
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
            </button>
          )}
          <Link
            href={cliente?.id ? `/clientes/${cliente.id}` : '#'}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
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
/* ══ E02 · EL BOTÓN DE PAGO PASA DE VERDE A DORADO ═══════════════════════════
 *
 * ⚠ ES UNA REGLA DEL SISTEMA, NO UNA PREFERENCIA. En todo el rediseño el verde
 * significa AL DÍA, PAGADO, A FAVOR — y esta misma pantalla lo usa así tres
 * líneas más abajo, en el banner «Pago registrado». Usarlo también como color
 * de acción rompe esa lectura justo donde más importa: el mismo verde decía
 * «esto ya está hecho» y «toca aquí para cobrar».
 *
 * El dorado es la acción primaria del sistema y aquí no compite con nada.
 *
 * EN MORA SIGUE ROJO: ahí el color no es decoración, es el estado del préstamo,
 * y quitarlo sería perder el aviso.
 */
export function BotonPagoPersonalidad({ enMora, frecuenciaLabel, monto, onClick }) {
  const isUrgente = enMora
  return (
    <button
      onClick={onClick}
      className="w-full h-16 rounded-[16px] transition-all duration-200 active:scale-[0.98] relative overflow-hidden group flex items-center px-4"
      style={{
        color: isUrgente ? '#ffffff' : 'var(--cf-gold-ink)',
        background: isUrgente
          ? 'linear-gradient(135deg, var(--cf-red-dark), color-mix(in srgb, var(--cf-red-dark) 82%, black))'
          : 'var(--cf-gold)',
        boxShadow: isUrgente
          ? '0 2px 8px rgba(239, 68, 68, 0.2)'
          : '0 2px 8px color-mix(in srgb, var(--cf-gold) 30%, transparent)',
      }}
    >
      {/* Shimmer overlay on hover */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }}
      />

      {/* Icono circular fijo a la izquierda */}
      <span
        className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3"
        style={{ background: isUrgente ? 'rgba(255,255,255,0.18)' : 'rgba(58,41,0,.14)' }}
      >
        {isUrgente ? (
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </span>

      {/* Texto en 2 lineas: titulo arriba (pequeño), monto abajo (grande) */}
      <span className="relative flex-1 flex flex-col items-start min-w-0 text-left leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
          {isUrgente ? 'Pagar ahora · vencido' : `Registrar pago ${frecuenciaLabel}`}
        </span>
        <span className="text-[18px] font-bold font-mono-display mt-0.5">
          {formatMoney(monto)}
        </span>
      </span>

      {/* Chevron a la derecha para indicar accion */}
      <svg className="relative w-5 h-5 shrink-0 ml-2 opacity-70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
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
      color: 'var(--cf-green-dark)',
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
        color: 'var(--cf-gold)',
        icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        text: `Termina en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`,
      })
    }
  }

  // LA MORA NO VUELVE A DECIRSE AQUI.
  //
  // En la ficha de un prestamo atrasado, «62 dias en mora» salia CINCO VECES en
  // la misma pantalla: la franja roja de arriba, la pastilla del cliente, la
  // columna «EN MORA» de las cifras, el consejo de la IA y este chip. Cinco
  // formas de decir lo mismo no lo dicen mas fuerte: hacen que ninguna se lea.
  //
  // Se quedan las dos del rediseño —la pastilla dice el ESTADO, la columna dice
  // la PLATA— y la franja de arriba, que es la unica que trae el agregado
  // («62 cuotas vencidas · $204.000»). Este chip no añadia nada.

  // Casi terminado
  if (porcentajePagado >= 90 && porcentajePagado < 100) {
    stats.push({
      color: 'var(--cf-ink-2)',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
      text: '¡Casi terminado!',
    })
  }

  // Cliente recurrente
  if (prestamoNumeroCliente && prestamoNumeroCliente > 1) {
    stats.push({
      color: 'var(--cf-ink-2)',
      icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      text: `Préstamo #${prestamoNumeroCliente} con este cliente`,
    })
  }

  return stats
}

// ─── 5. Acciones secundarias como chips ──────────────────────────
/* ══ E02 · TRES BOTONES DISPARES → CUATRO IGUALES ═══════════════════════════
 *
 * Eran filas horizontales con icono, título, subtítulo y chevron, colocadas en
 * una rejilla de dos columnas: WhatsApp y Cobros en fila, Gestión sola debajo
 * ocupando media pantalla. Y los subtítulos no explicaban nada —«Renovar,
 * plazo, ajustes», «Abonos y atajos»— porque son listas, no explicaciones.
 *
 * De la lámina: «cuatro cuadrados con icono y una palabra se recorren de un
 * vistazo, y el que necesita explicación no debería estar ahí».
 *
 * El `sublabel` deja de pintarse, pero NO se quita del contrato: la mora sigue
 * llegando por ahí y aquí se convierte en un punto rojo sobre el icono. Un
 * aviso que se ve de lejos vale más que un renglón de 10px que hay que leer.
 */
export function ChipsAccionesSecundarias({ acciones }) {
  if (!acciones || acciones.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {acciones.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          title={a.sublabel || a.label}
          style={{
            flex: 1, minWidth: 0, height: 74, borderRadius: 16, cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            font: 'inherit', padding: '0 4px',
          }}
        >
          <span style={{
            position: 'relative', width: 20, height: 20, flex: 'none',
            display: 'inline-flex', color: a.color,
          }}>
            {a.icon}
            {/* El aviso que antes iba en el subtítulo: «Mora $120.000» en 10px
                gris se leía como una etiqueta más. Un punto rojo se ve sin
                leer, que es lo que hace falta cuando hay atraso. */}
            {a.alerta && (
              <span aria-hidden style={{
                position: 'absolute', top: -3, right: -4,
                width: 8, height: 8, borderRadius: 999,
                background: 'var(--cf-red-dark)',
                border: '1.5px solid var(--cf-card)',
              }} />
            )}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)',
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{a.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── 6. Grilla de datos en 3 secciones ───────────────────────────
export function GrillaDatosSecciones({ secciones }) {
  return (
    <div className="space-y-3">
      {secciones.map((sec) => {
        const heroItems = sec.items.filter(it => it.hero)
        const regularItems = sec.items.filter(it => !it.hero)

        return (
          <div
            key={sec.titulo}
            className="rounded-[16px] overflow-hidden flex flex-col"
            style={{ border: '1px solid var(--cf-border)', gap: '1px', background: 'var(--cf-border)' }}
          >
            <div
              className="flex items-center gap-1.5 px-4 py-2"
              style={{ background: `color-mix(in srgb, ${sec.color} 6%, var(--cf-card))` }}
            >
              <div
                className="w-5 h-5 rounded-[5px] flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${sec.color} 20%, transparent)`, color: sec.color }}
              >
                {sec.icon}
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: sec.color }}>
                {sec.titulo}
              </p>
            </div>

            {heroItems.length > 0 && (
              <div
                className={`grid ${heroItems.length > 1 ? 'grid-cols-2' : ''}`}
                style={{ gap: '1px', background: 'var(--cf-border)' }}
              >
                {heroItems.map((it) => (
                  <div key={it.label} className="px-4 py-3" style={{ background: 'var(--cf-card)' }}>
                    <p className="text-[10px] mb-0.5" style={{ color: 'var(--cf-ink-3)' }}>{it.label}</p>
                    <p className="text-lg font-bold font-mono-display leading-tight" style={{ color: it.color || 'var(--cf-ink)' }}>
                      {it.value}
                    </p>
                    {it.sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{it.sub}</p>}
                  </div>
                ))}
              </div>
            )}

            {regularItems.length > 0 && (
              <div
                className="grid grid-cols-2"
                style={{ gap: '1px', background: 'var(--cf-border)' }}
              >
                {regularItems.map((it) => (
                  <div key={it.label} className="px-3 py-2.5" style={{ background: 'var(--cf-card)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{it.label}</p>
                    <p className="text-[13px] font-semibold mt-0.5 font-mono-display" style={{ color: it.color || 'var(--cf-ink)' }}>
                      {it.value}
                    </p>
                    {it.sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{it.sub}</p>}
                  </div>
                ))}
                {regularItems.length % 2 === 1 && (
                  <div style={{ background: 'var(--cf-card)' }} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 7. Línea de tiempo del préstamo ─────────────────────────────
/* ══ E03 · CUATRO BLOQUES QUE DECÍAN TRES COSAS ════════════════════════════
 *
 * Debajo del historial había, uno detrás de otro:
 *
 *   1 · un banner ámbar con ✕: «Faltan solo 2 cuotas para completar»
 *   2 · dos chips: «2 cuotas pagadas» · «Préstamo #2 con este cliente»
 *   3 · una tarjeta «Cliente recurrente» que REPETÍA el chip palabra por palabra
 *   4 · la línea de tiempo, con fondo crema que la hacía parecer otro aviso
 *
 * Medido en la ficha de un cliente real: «Préstamo #2 con este cliente» salía
 * DOS veces seguidas, y arriba del todo la cabecera ya decía «1 préstamo
 * completado · cliente recurrente». Tres sitios para el mismo dato.
 *
 * Son tres cosas: cómo va, si va adelantado, y si es cliente repetido.
 *
 * El banner desaparece: un aviso que se puede cerrar es un aviso que no
 * importaba, y «faltan solo 2 cuotas» es lo que ya dice la barra, con otras
 * palabras y encima de ella.
 *
 * La línea de tiempo se queda —muestra el punto de hoy entre inicio y
 * vencimiento, y eso es bueno— pero pierde el fondo teñido y gana las cuotas
 * en el centro: los días que faltan no dicen cuántos PAGOS faltan.
 *
 * Y «cliente recurrente» pasa a la frase que diría un prestamista de verdad:
 * lo que importa de un cliente repetido no es que se repita, es CÓMO TERMINÓ
 * las veces anteriores.
 *
 * Ya hay precedente en este mismo fichero: el chip de mora se quitó porque
 * «62 días en mora» salía cinco veces en la misma pantalla.
 */
export function TimelinePrestamo({
  fechaInicio, fechaFin, porcentajePagado, color = 'var(--cf-gold)',
  // Nuevos: lo que absorbe de los otros tres bloques.
  cuotasPagadas = null, cuotasTotales = null,
  prestamoNumeroCliente = null, prestamosCompletadosCliente = 0,
}) {
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
  const cuotasQueFaltan = (cuotasTotales > 0 && cuotasPagadas != null)
    ? Math.max(0, cuotasTotales - cuotasPagadas)
    : 0

  return (
    // Tarjeta normal: el fondo teñido la hacía parecer un aviso más, en una
    // zona que ya tenía tres. (Comentario con `//`: un `{/* */}` justo después
    // de `return (` es error de sintaxis — la trampa nº1 de este proyecto.)
    <div className="rounded-[20px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
          Cómo va
        </p>
        {diasRestantes > 0 && (
          <span className="text-[10px]" style={{ color: 'var(--cf-ink-2)' }}>
            faltan <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-ink)' }}>{diasRestantes}</span> día{diasRestantes === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Track con dos barras superpuestas: tiempo (gris) + pagos (color) */}
      <div className="relative h-6 mb-1">
        {/* Track de fondo */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ background: 'var(--cf-fill)' }} />
        {/* Tiempo transcurrido (gris claro) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{ width: `${animTiempo}%`, background: 'color-mix(in srgb, var(--cf-ink-3) 40%, transparent)' }}
        />
        {/* Pagos (color del estado) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{
            width: `${animPago}%`,
            background: color,
          }}
        />
        {/* Marker de "Hoy" */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
          style={{
            left: `${animTiempo}%`,
            background: 'var(--cf-card)',
            border: `2px solid ${color}`,
            boxShadow: `0 0 4px color-mix(in srgb, ${color} 30%, transparent)`,
          }}
          title="Hoy"
        />
        {/* Etiqueta "Hoy" */}
        <div
          className="absolute top-full mt-0.5 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap"
          style={{ left: `${animTiempo}%`, color }}
        >
          Hoy
        </div>
      </div>

      {/* ⚠ LAS CUOTAS VAN EN SU PROPIO RENGLÓN, NO ENTRE LAS FECHAS.
          Primero las puse en medio de la fila inicio/vencimiento y quedaron
          apretadas contra las dos: en la captura del dueño, «1 de 6 cuotas»
          caía pegado bajo la barra con las fechas descolocadas a los lados.
          Reportado: «la información se puede distribuir mejor».

          Ahora: las cuotas debajo de la barra —que es lo que la barra mide— y
          las fechas en su fila, cada una en su extremo. */}
      {cuotasTotales > 0 && (
        <p className="font-mono-display font-semibold text-[12px] mt-4 text-center" style={{ color: 'var(--cf-ink)' }}>
          {cuotasPagadas ?? 0} de {cuotasTotales} cuotas
        </p>
      )}

      <div className="flex items-start justify-between text-[10px] mt-2.5 gap-3" style={{ color: 'var(--cf-ink-3)' }}>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider">Inicio</p>
          <p className="font-medium" style={{ color: 'var(--cf-ink-2)' }}>{fmtFechaCorta(fechaInicio)}</p>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10px] uppercase tracking-wider">Vencimiento</p>
          <p className="font-medium" style={{ color: 'var(--cf-ink-2)' }}>{fmtFechaCorta(fechaFin)}</p>
        </div>
      </div>

      {/* ── LAS DOS FRASES ────────────────────────────────────────────────
          Eran pastillas de colores. En frase se leen de corrido y caben las
          cuotas que faltan, que es lo que sigue a «va adelantado». */}
      {(adelantado || atrasado || cuotasQueFaltan > 0) && (
        <p className="text-[11px] mt-3 pt-3 leading-snug" style={{ color: 'var(--cf-ink-2)', borderTop: '1px solid var(--cf-border)' }}>
          {adelantado && <span className="font-semibold" style={{ color: 'var(--cf-green-dark)' }}>Va adelantado. </span>}
          {atrasado && <span className="font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>Va atrasado. </span>}
          {cuotasQueFaltan > 0 && (
            <>Le falta{cuotasQueFaltan === 1 ? '' : 'n'} {cuotasQueFaltan} cuota{cuotasQueFaltan === 1 ? '' : 's'}
              {porcentajePagado >= 80 ? ' y ya casi termina.' : '.'}</>
          )}
        </p>
      )}

      {/* Cliente repetido: lo que importa no es que se repita, es cómo terminó
          las veces anteriores. Absorbe el chip y la tarjeta que lo repetía. */}
      {prestamoNumeroCliente > 1 && (
        <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
          Es su {ORDINAL[prestamoNumeroCliente] ?? `${prestamoNumeroCliente}º`} préstamo contigo
          {prestamosCompletadosCliente > 0 && (
            <> · pagó {prestamosCompletadosCliente === 1 ? 'el anterior' : `los ${prestamosCompletadosCliente} anteriores`}</>
          )}
        </p>
      )}
    </div>
  )
}

/* «Es su tercer préstamo» se lee mejor que «Es su 3º préstamo», que es lo que
   pide la lámina. Más allá de diez, el número a secas. */
const ORDINAL = {
  2: 'segundo', 3: 'tercer', 4: 'cuarto', 5: 'quinto',
  6: 'sexto', 7: 'séptimo', 8: 'octavo', 9: 'noveno', 10: 'décimo',
}

// ─── 8. Mini card de un pago en el historial ─────────────────────
export function PagoMiniCard({ pago, onAnular, anulando, isOffline, children }) {
  /* ══ LA TARJETA DE UN PAGO ═════════════════════════════════════════════════
   *
   * «Esas tarjetas quedaron con el diseño de la versión anterior; no contrasta
   *  bien con lo nuevo que tenemos.»                    — el dueño, 31 ago 2026
   *
   * Tenía nombre en el canon. Esta tarjeta se pintaba con un
   * `linear-gradient` teñido del color del tipo de pago MÁS un borde también
   * teñido, y eso es exactamente lo que prohíbe la regla 4 de `DESIGN.md`:
   *
   *   «El estado va en el acento, nunca en el fondo. La superficie de la
   *    tarjeta es SIEMPRE blanca. Esto corrige el defecto principal del diseño
   *    anterior: tarjetas teñidas formando un muro donde nada destacaba porque
   *    todo destacaba.»
   *
   * Con quince pagos seguidos el muro era literal: quince rectángulos verdes.
   *
   * DÓNDE VA AHORA EL COLOR — tres portadores, que es el tope que fija
   * `TarjetaCliente`, y ni uno más:
   *   1. el anillo de 2px del icono   (igual que el avatar de la lista)
   *   2. la pastilla con el nombre del tipo
   *   3. el signo del monto, SOLO en recargo y descuento
   *
   * ⚠ EL MONTO YA NO SE TIÑE DEL COLOR DEL TIPO. Era el cuarto portador y el
   * más ruidoso: una columna de quince cifras verdes donde la vista no
   * encuentra ninguna. Va en tinta, que es lo que deja ver la que se sale. */
  const TONOS = {
    completo:    { color: 'var(--cf-green-dark)', pastilla: 'aldia',     label: 'Completo' },
    parcial:     { color: 'var(--cf-gold)',       pastilla: 'atraso',    label: 'Parcial' },
    capital:     { color: 'var(--cf-ink-2)',      pastilla: 'neutro',    label: 'A capital' },
    recargo:     { color: 'var(--cf-red-dark)',   pastilla: 'mora',      label: 'Recargo' },
    descuento:   { color: 'var(--cf-ink-2)',      pastilla: 'neutro',    label: 'Descuento' },
    intereses:   { color: 'var(--cf-gold-dark)',  pastilla: 'atraso',    label: 'Intereses' },
    liquidacion: { color: '#6366f1',              pastilla: 'neutro',    label: 'Liquidación' },
  }
  const t = TONOS[pago.tipo] || TONOS.parcial
  const signo = pago.tipo === 'descuento' ? '-' : pago.tipo === 'recargo' ? '+' : ''

  return (
    <div
      className="rounded-[12px] p-3 transition-colors"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* El anillo de estado. El relleno es gris de siempre: el color vive en
            el borde y en el trazo, nunca en la superficie. */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'var(--cf-fill)',
            color: t.color,
            border: `2px solid ${t.color}`,
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
            <Pastilla tono={t.pastilla}>{t.label}</Pastilla>
            {pago.cuotaNumero && (
              <Pastilla tono="neutro" numerica>Cuota {pago.cuotaNumero}</Pastilla>
            )}
            {isOffline && (
              <Pastilla tono="atraso">Sin enviar</Pastilla>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="cf-num">{fmtFecha(pago.fechaPago)}</span>
            {pago.metodoPago && (() => {
              /* El medio de pago SÍ conserva su color de marca: Nequi morado,
                 Daviplata rojo. No es estado del pago, es de quién es la cuenta
                 —lo que decide si entra al fajo— y por eso no cuenta como un
                 cuarto portador del estado. */
              const platInfo = pago.metodoPago === 'transferencia' ? getPlataformaInfo(pago.plataforma) : null
              const badgeColor = platInfo?.color || (pago.metodoPago === 'transferencia' ? 'var(--cf-ink-2)' : 'var(--cf-green-dark)')
              return (
                <span
                  className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold"
                  style={{
                    background: 'var(--cf-fill)',
                    border: '1px solid var(--cf-border)',
                    color: badgeColor,
                  }}
                >
                  {platInfo
                    ? <PlataformaIcon plataforma={pago.plataforma} size={10} />
                    : <span className="w-1.5 h-1.5 rounded-full" style={{ background: badgeColor }} />
                  }
                  {pago.metodoPago === 'transferencia' ? (pago.plataforma || 'Transferencia') : 'Efectivo'}
                </span>
              )
            })()}
          </div>
          {pago.nota && (
            <p className="text-[10px] mt-1 italic truncate" style={{ color: 'var(--cf-ink-2)' }} title={pago.nota}>
              {pago.nota}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p
            className="cf-num text-[15px] font-bold leading-none"
            style={{ color: signo ? t.color : 'var(--cf-ink)' }}
          >
            {signo}{formatMoney(pago.montoPagado)}
          </p>
        </div>
      </div>

      {pago.fotoUrl && (
        <div className="mt-2 rounded-[8px] overflow-hidden border" style={{ borderColor: 'var(--cf-border)' }}>
          <a href={pago.fotoUrl} target="_blank" rel="noopener noreferrer">
            <img src={pago.fotoUrl} alt="Evidencia de cobro" className="w-full h-24 object-cover" loading="lazy" />
          </a>
        </div>
      )}

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
      className="rounded-[20px] px-3 py-2.5 flex items-start gap-2"
      style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-ink-2) 8%, var(--cf-card)) 0%, var(--cf-card) 100%)', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 18%, var(--cf-border))' }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 15%, transparent)', color: 'var(--cf-ink-2)' }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Cliente recurrente</p>
        {items.map((it, i) => (
          <p key={i} className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-2)' }}>{it}</p>
        ))}
      </div>
    </div>
  )
}
