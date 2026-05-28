'use client'
// components/clientes/ClienteHeroCard.jsx
// Hero card premium para detalle de cliente. Saldo total + avatar + chips
// + acciones rapidas. Inspirado en Mercury / Revolut.

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

const COLOR_OK   = 'var(--color-accent)'
const COLOR_HOT  = '#f97316'
const COLOR_CRIT = 'var(--color-danger)'
const COLOR_OFF  = '#64748b'

function moodColorFromCliente(c, prestamosActivos) {
  if (c?.estado === 'cancelado' || c?.estado === 'inactivo') return COLOR_OFF
  // Maxima mora entre prestamos activos
  const maxMora = Math.max(0, ...prestamosActivos.map(p => p?.diasMora ?? 0))
  if (maxMora > 7) return COLOR_CRIT
  if (maxMora > 0 || c?.estado === 'mora') return COLOR_HOT
  return COLOR_OK
}

function moodLabel(c, prestamosActivos) {
  if (c?.estado === 'cancelado') return 'Cancelado'
  if (c?.estado === 'inactivo') return 'Inactivo'
  const maxMora = Math.max(0, ...prestamosActivos.map(p => p?.diasMora ?? 0))
  if (maxMora > 7) return `${maxMora}d en mora`
  if (maxMora > 0) return `${maxMora}d vencido`
  if (prestamosActivos.length === 0) return 'Sin préstamos'
  return 'Al día'
}

function useCountUp(target, duration = 800) {
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
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (progress < 1) raf = requestAnimationFrame(step)
      else setValue(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return value
}

export default function ClienteHeroCard({ cliente, prestamosActivos = [], stats, onWhatsApp, puedeSubirFoto = false, onFotoActualizada }) {
  const color = moodColorFromCliente(cliente, prestamosActivos)
  const label = moodLabel(cliente, prestamosActivos)
  const tieneFoto = !!cliente?.fotoUrl
  const fotoInputRef = useRef(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoAbierta, setFotoAbierta] = useState(false)

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !cliente?.id) return
    setSubiendoFoto(true)
    try {
      const fd = new FormData()
      fd.append('foto', file)
      const res = await fetch(`/api/clientes/${cliente.id}/foto`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        if (onFotoActualizada) onFotoActualizada(data.fotoUrl)
      }
    } catch {} finally {
      setSubiendoFoto(false)
      e.target.value = ''
    }
  }

  // Saldo total: suma de saldoPendiente de todos los prestamos activos
  const saldoTotal = prestamosActivos.reduce((acc, p) => acc + (p?.saldoPendiente ?? 0), 0)
  const totalAPagar = prestamosActivos.reduce((acc, p) => acc + (p?.totalAPagar ?? 0), 0)
  const totalPagado = totalAPagar - saldoTotal
  const pctPagado = totalAPagar > 0 ? Math.round((totalPagado / totalAPagar) * 100) : 0
  const animSaldo = useCountUp(saldoTotal, 900)
  const tienePrestamos = prestamosActivos.length > 0

  return (
    <div
      className="cf-hero-card relative rounded-[20px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${color} 8%, var(--color-bg-card)) 100%)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, var(--color-border))`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* Orb pulsante decorativo */}
      <div
        className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }}
      />
      {/* Patron de puntos */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color }}
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {/* Top: avatar + nombre + cedula + chip estado + boton WA */}
        <div className="flex items-start gap-3 mb-4">
          {/* Avatar con overlay de camara si puede subir foto */}
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente?.nombre}
              fotoUrl={cliente?.fotoUrl}
              size={56}
              fontSize={20}
              onClick={tieneFoto ? () => setFotoAbierta(true) : undefined}
              style={tieneFoto ? { border: `2px solid ${color}` } : undefined}
            />
            {puedeSubirFoto && (
              <>
                <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFotoChange} />
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={subiendoFoto}
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'var(--color-bg-card)', border: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  title="Cambiar foto"
                >
                  {subiendoFoto ? (
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  )}
                </button>
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">
              {cliente?.nombre}
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              CC {cliente?.cedula}
              {cliente?.ruta && (
                <> · <span style={{ color: 'var(--color-purple)' }}>{cliente.ruta.nombre}</span></>
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                  border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </span>
              {stats && (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{stats}</span>
              )}
            </div>
          </div>

          {cliente?.telefono && (
            <div className="flex gap-1.5 shrink-0">
              {/* Boton llamada */}
              <a
                href={`tel:${cliente.telefono}`}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.35)' }}
                title="Llamar"
                aria-label="Llamar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </a>
              {/* Boton WhatsApp */}
              {onWhatsApp && (
                <button
                  onClick={onWhatsApp}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(37, 211, 102, 0.18)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.35)' }}
                  title="WhatsApp"
                  aria-label="WhatsApp"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Saldo total */}
        {tienePrestamos && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Saldo total pendiente
            </p>
            <p
              className="font-mono-display font-bold leading-none tracking-tight truncate"
              style={{
                color,
                fontSize: 'clamp(28px, 8vw, 40px)',
                textShadow: 'none',
              }}
            >
              {formatMoney(Math.round(animSaldo))}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {prestamosActivos.length} {prestamosActivos.length === 1 ? 'préstamo activo' : 'préstamos activos'}
                {' · '}
                {pctPagado}% pagado
              </p>
              {totalAPagar > 0 && (
                <p className="text-[11px] font-mono-display" style={{ color: 'var(--color-text-secondary)' }}>
                  de {formatMoney(totalAPagar)}
                </p>
              )}
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--color-bg-hover)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${pctPagado}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
                }}
              />
            </div>
          </div>
        )}

        {!tienePrestamos && (
          <div className="text-center py-3">
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              Este cliente no tiene préstamos activos
            </p>
          </div>
        )}
      </div>

      {/* Lightbox foto */}
      {fotoAbierta && tieneFoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setFotoAbierta(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setFotoAbierta(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="p-4 max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cliente.fotoUrl}
              alt={cliente.nombre}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />
            <p className="text-center text-white/80 text-sm mt-3 font-medium">{cliente.nombre}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Card secundaria con info de contacto (tel, dir, ref, notas)
export function InfoContactoCard({ cliente }) {
  const items = []
  if (cliente?.telefono) items.push({
    label: 'Teléfono',
    value: cliente.telefono,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    color: '#22c55e',
  })
  if (cliente?.direccion) items.push({
    label: 'Dirección',
    value: cliente.direccion,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    color: '#3b82f6',
  })
  if (cliente?.referencia) items.push({
    label: 'Referencia',
    value: cliente.referencia,
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    color: '#a855f7',
  })

  if (items.length === 0 && !cliente?.notas) return null

  return (
    <div
      className="rounded-[16px] p-3"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
        Información de contacto
      </p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-[10px]" style={{ background: 'var(--color-bg-base)' }}>
            <div
              className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${it.color} 15%, transparent)`, color: it.color }}
            >
              <span className="w-3.5 h-3.5">{it.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{it.label}</p>
              <p className="text-[12px] truncate" style={{ color: 'var(--color-text-primary)' }}>{it.value}</p>
            </div>
          </div>
        ))}
        {cliente?.notas && (
          <div className="px-2 py-1.5 rounded-[10px]" style={{ background: 'var(--color-bg-base)' }}>
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas</p>
            <p className="text-[12px] whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>{cliente.notas}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Acciones rapidas en grid (Nuevo prestamo, Historial, Editar, Inactivar, Eliminar)
export function AccionesClienteChips({ acciones }) {
  if (!acciones || acciones.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {acciones.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          disabled={a.disabled}
          className="group h-12 px-3 rounded-[12px] flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${a.color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
            border: `1px solid color-mix(in srgb, ${a.color} 22%, var(--color-border))`,
          }}
        >
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
            style={{ background: `color-mix(in srgb, ${a.color} 18%, transparent)`, color: a.color }}
          >
            <span className="w-4 h-4">{a.icon}</span>
          </div>
          <span className="text-[12px] font-semibold truncate text-left" style={{ color: a.color }}>
            {a.label}
          </span>
        </button>
      ))}
    </div>
  )
}
