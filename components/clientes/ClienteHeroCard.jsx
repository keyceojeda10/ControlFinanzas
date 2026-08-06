'use client'
// components/clientes/ClienteHeroCard.jsx
// Hero card premium para detalle de cliente. Saldo total + avatar + chips
// + acciones rapidas. Inspirado en Mercury / Revolut.

import { formatMoney } from '@/lib/i18n'
import { direccionIncompleta, telefonoLegible } from '@/lib/direcciones'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

const COLOR_OK   = 'var(--cf-gold)'
const COLOR_HOT  = 'var(--cf-gold-dark)'
const COLOR_CRIT = 'var(--cf-red-dark)'
const COLOR_OFF  = 'var(--cf-ink-3)'

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

function FotoLightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const gestureRef = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0, startTx: 0, startTy: 0, isPanning: false, lastTap: 0 })
  const containerRef = useRef(null)

  const clampTranslate = useCallback((tx, ty, s) => {
    if (s <= 1) return { x: 0, y: 0 }
    const maxX = (s - 1) * window.innerWidth / 2
    const maxY = (s - 1) * window.innerHeight / 2
    return { x: Math.max(-maxX, Math.min(maxX, tx)), y: Math.max(-maxY, Math.min(maxY, ty)) }
  }, [])

  const handleTouchStart = useCallback((e) => {
    const g = gestureRef.current
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      g.startDist = Math.hypot(dx, dy)
      g.startScale = scale
      g.isPanning = false
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - g.lastTap < 300) {
        e.preventDefault()
        if (scale > 1.5) {
          setScale(1)
          setTranslate({ x: 0, y: 0 })
        } else {
          setScale(3)
        }
        g.lastTap = 0
        return
      }
      g.lastTap = now
      g.startX = e.touches[0].clientX
      g.startY = e.touches[0].clientY
      g.startTx = translate.x
      g.startTy = translate.y
      g.isPanning = scale > 1
    }
  }, [scale, translate])

  const handleTouchMove = useCallback((e) => {
    const g = gestureRef.current
    if (e.touches.length === 2 && g.startDist > 0) {
      e.preventDefault()
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.hypot(dx, dy)
      const newScale = Math.max(1, Math.min(5, g.startScale * (dist / g.startDist)))
      setScale(newScale)
      if (newScale <= 1) setTranslate({ x: 0, y: 0 })
    } else if (e.touches.length === 1 && g.isPanning) {
      e.preventDefault()
      const dx = e.touches[0].clientX - g.startX
      const dy = e.touches[0].clientY - g.startY
      const clamped = clampTranslate(g.startTx + dx, g.startTy + dy, scale)
      setTranslate(clamped)
    }
  }, [scale, clampTranslate])

  const handleTouchEnd = useCallback((e) => {
    gestureRef.current.startDist = 0
    gestureRef.current.isPanning = false
    if (e.touches.length === 0 && scale <= 1) {
      setTranslate({ x: 0, y: 0 })
    }
  }, [scale])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black" style={{ touchAction: 'none' }}>
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/15 text-white active:bg-white/30 transition-colors"
        onClick={onClose}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {scale > 1 && (
        <button
          className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium active:bg-white/30 transition-colors"
          onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }) }}
        >
          Restablecer
        </button>
      )}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => { if (scale <= 1 && e.target === containerRef.current) onClose() }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="select-none"
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: gestureRef.current?.startDist > 0 ? 'none' : 'transform 0.2s ease-out',
          }}
        />
      </div>
      <p className="absolute bottom-6 left-0 right-0 text-center text-white/60 text-xs font-medium pointer-events-none">
        {scale <= 1 ? 'Doble toque para ampliar' : `${Math.round(scale * 100)}%`}
      </p>
    </div>
  )
}

export default function ClienteHeroCard({ cliente, prestamosActivos = [], stats, onWhatsApp, puedeSubirFoto = false, onFotoActualizada }) {
  const color = moodColorFromCliente(cliente, prestamosActivos)
  const label = moodLabel(cliente, prestamosActivos)
  const tieneFoto = !!cliente?.fotoUrl
  const fotoInputRef = useRef(null)
  const fotoCameraRef = useRef(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoAbierta, setFotoAbierta] = useState(false)
  const [fotoMenuAbierto, setFotoMenuAbierto] = useState(false)

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

  /* ══ LAS DOS CIFRAS DE LA TIRA QUE HAY QUE DERIVAR ═══════════════════════
     Se declaran AQUÍ, antes del `return`, y no dentro del JSX: es el mismo
     patrón que tumbó producción con la TDZ hace unos días.

     Con varios préstamos activos se suman las cuotas —es lo que el cliente
     paga— y el próximo cobro es el MÁS CERCANO, que es la fecha en la que hay
     que ir a buscarlo. */
  const cuotaVigente = tienePrestamos
    ? prestamosActivos.reduce((a, p) => a + (p?.cuotaDiaria ?? 0), 0) || null
    : null

  const proximoCobroTexto = (() => {
    const fechas = prestamosActivos
      .map((p) => p?.proximoCobro)
      .filter(Boolean)
      .map((f) => new Date(f))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (!fechas.length) return null
    const cercana = new Date(Math.min(...fechas.map((d) => d.getTime())))
    /* Sin año —«27 ago», que es como lo dice la lámina y como cabe en una
       columna de cuatro— y leído en el huso de Colombia. Las fechas de este
       proyecto se guardan con el convenio T05:00Z: leerlas en la hora local del
       navegador corre el día entero en la franja de la medianoche, y eso ya
       causó bugs invisibles en local porque dev corre en Bogotá y prod en UTC. */
    return cercana.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', timeZone: 'America/Bogota',
    }).replace('.', '')
  })()

  return (
    /* EL FONDO DEJA DE TEÑIRSE SEGUN EL HUMOR DEL CLIENTE.
       Era un degradado del color de estado —rosa si debe, verde si va al dia—
       con un orbe difuminado y una trama de puntos encima. Tres capas decorativas
       para decir lo mismo que ya dice la pastilla de «35d en mora», y de paso
       teñian el saldo: la misma cifra se leia como alarma o como tranquilidad
       segun el fondo.

       Ahora es el bloque carbon del sistema, el mismo de caja, ruta y socios.
       El estado lo sigue diciendo la pastilla, con palabras. */
    <div className="relative rounded-[20px] overflow-hidden" style={{
      background: '#15161A',
      // En tema oscuro el fondo de la app es este mismo carbón: sin borde la
      // tarjeta del cliente se funde y el saldo queda flotando.
      border: '1px solid rgba(255,255,255,.09)',
    }}>

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
                <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFotoChange(e); setFotoMenuAbierto(false) }} />
                <input ref={fotoCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleFotoChange(e); setFotoMenuAbierto(false) }} />
                <button
                  type="button"
                  onClick={() => setFotoMenuAbierto(v => !v)}
                  disabled={subiendoFoto}
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'var(--cf-card)', border: '2px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}
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
                {fotoMenuAbierto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFotoMenuAbierto(false)} />
                    <div className="absolute top-full left-0 mt-1.5 z-50 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] shadow-lg overflow-hidden min-w-[130px]"
                      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
                      <button
                        type="button"
                        onClick={() => fotoInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--cf-ink)] hover:bg-[var(--cf-fill)] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        Galería
                      </button>
                      <button
                        type="button"
                        onClick={() => fotoCameraRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--cf-ink)] hover:bg-[var(--cf-fill)] transition-colors"
                        style={{ borderTop: '1px solid var(--cf-border)' }}
                      >
                        <svg className="w-3.5 h-3.5 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                        Cámara
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* EL NOMBRE NO SE CORTA. Es la identidad de la pantalla, y
                «Ana Milena Guz...» obliga a entrar a editar para saber a quien
                se le va a prestar. Cabe en dos lineas; con tres, se corta. */}
            <h1 className="text-lg font-bold leading-tight" style={{
              color: '#F3F3F6',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {cliente?.nombre}
            </h1>
            {/* ⚠ EL TELÉFONO VA AQUÍ (E05). Estaban la cédula y la ruta, pero
                el número había que ir a buscarlo abajo, en «Cómo ubicarlo». Es
                el dato que más se mira de un cliente después del nombre, y en
                una línea caben los tres. */}
            <p className="text-[11px] mt-0.5" style={{ color: '#8A8E98' }}>
              {cliente?.cedula && !cliente.cedula.startsWith('SIN-') ? `CC ${cliente.cedula}` : 'Sin documento'}
              {cliente?.telefono && (
                <> · <span style={{ color: '#A3A8B2' }}>{telefonoLegible(cliente.telefono)}</span></>
              )}
              {cliente?.ruta && (
                <> · <span style={{ color: '#A3A8B2' }}>{cliente.ruta.nombre}</span></>
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
                <span className="text-[10px]" style={{ color: '#8A8E98' }}>{stats}</span>
              )}
            </div>
          </div>

          {cliente?.telefono && (
            <div className="flex gap-1.5 shrink-0">
              {/* Boton llamada */}
              <a
                href={`tel:${cliente.telefono}`}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(255,255,255,.08)', color: '#F3F3F6', border: '1px solid rgba(255,255,255,.14)' }}
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
                  style={{ background: 'rgba(255,255,255,.08)', color: '#25D366', border: '1px solid rgba(255,255,255,.14)' }}
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
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#A3A8B2' }}>
              Saldo total pendiente
            </p>
            <p
              className="font-mono-display font-bold leading-none tracking-tight truncate"
              style={{ color: '#F3F3F6', fontSize: 'clamp(28px, 8vw, 40px)' }}
            >
              {formatMoney(Math.round(animSaldo))}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-[11px]" style={{ color: '#8A8E98' }}>
                {prestamosActivos.length} {prestamosActivos.length === 1 ? 'préstamo activo' : 'préstamos activos'}
                {' · '}
                {pctPagado}% pagado
              </p>
              {/* ⚠ AQUÍ DECÍA «de $1.800.000» A SECAS, Y CON LA CIFRA GRANDE
                  ARRIBA SE LEÍA «$1.800.000 de $1.800.000» — que suena a
                  saldado cuando es un préstamo recién entregado. El dueño lo
                  reportó: «dentro de la ficha del cliente también pasa la
                  confusión esta».

                  La cifra grande NO cambia: su rótulo dice «saldo total
                  pendiente», así que es correcta y es la que se necesita. Lo que
                  estaba mal era el par: este renglón mide una cosa (lo que
                  falta) y la barra de debajo la contraria (lo pagado). Ahora los
                  dos dicen lo PAGADO, que es lo que la barra pinta. */}
              {totalAPagar > 0 && (
                <p className="text-[11px] font-mono-display" style={{ color: '#8A8E98' }}>
                  {formatMoney(Math.max(0, totalAPagar - saldoTotal))} de {formatMoney(totalAPagar)}
                </p>
              )}
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'rgba(255,255,255,.12)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${pctPagado}%`, background: '#2FBE6A' }}
              />
            </div>

            {/* ══ E05 · LA TIRA DE CUATRO CIFRAS ═══════════════════════════
                Es la información con la que se decide si prestarle otra vez, y
                hasta ahora había que BAJAR a buscarla: la cuota estaba en la
                tarjeta del préstamo y el próximo cobro más abajo todavía.
                Aquí arriba se lee de un vistazo, junto al saldo.

                «Cómo paga» es el porcentaje pagado de lo que lleva pactado —no
                una nota de comportamiento— y por eso dice el mismo número que
                la barra de encima: son la misma verdad, una en cifra y otra en
                trazo. */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2,
              marginTop: 16, paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,.09)',
            }}>
              {[
                /* ⚠ «PRÓXIMO COBRO» NO CABE EN UNA CUARTA PARTE DE 393px:
                   salía «PRÓXIMO CO…». Se dice «Cobra el», que es la misma
                   pregunta con dos palabras cortas — y con la fecha debajo se
                   lee «Cobra el / 4 de ago» sin que falte nada. Medido en la
                   captura, no en el código: ahí se veía correcto. */
                { rotulo: 'Le debe', valor: formatMoney(saldoTotal) },
                { rotulo: 'Cuota', valor: cuotaVigente != null ? formatMoney(cuotaVigente) : '—' },
                { rotulo: 'Cobra el', valor: proximoCobroTexto ?? '—' },
                { rotulo: 'Cómo paga', valor: `${pctPagado}%` },
              ].map((c) => (
                <div key={c.rotulo} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: '#8A8E98',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.rotulo}</span>
                  <span className="font-mono-display" style={{
                    fontSize: 13.5, fontWeight: 700, color: '#F3F3F6',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.valor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!tienePrestamos && (
          <div className="text-center py-3">
            <p className="text-[12px]" style={{ color: '#8A8E98' }}>
              Este cliente no tiene préstamos activos
            </p>
          </div>
        )}
      </div>

      {/* Lightbox foto */}
      {fotoAbierta && tieneFoto && (
        <FotoLightbox src={cliente.fotoUrl} alt={cliente.nombre} onClose={() => setFotoAbierta(false)} />
      )}
    </div>
  )
}

/* ══ E04 · «CÓMO UBICARLO» ═══════════════════════════════════════════════════
   ANTES ERAN TRES TARJETAS QUE NO HACÍAN NADA.

   Cada dato —teléfono, dirección, referencia— ocupaba su tarjeta con fondo
   propio, icono en caja y etiqueta en mayúsculas: 56px de alto para mostrar
   diez caracteres. Y ninguno se podía tocar. El cobrador que abre esto quiere
   LLAMAR o LLEGAR, y tenía que copiar el número a mano y escribir la dirección
   en su mapa.

   Ahora son tres filas con acciones: el teléfono llama y abre WhatsApp, la
   dirección abre el mapa.

   · Fuera el fondo verde del teléfono. En este sistema el verde es «al día», y
     ahí se leía como si el teléfono estuviera bien y los otros dos mal.
   · «Referencia» deja de ser una fila: no es un dato aparte, es parte de la
     dirección. Va en su segunda línea, como se lo dirías a alguien.
   · Las etiquetas en mayúsculas se van: un número de diez cifras con formato de
     celular ya se ve que es un teléfono, y «TELÉFONO» encima le roba la mitad
     del peso al dato.
   · El teléfono se formatea: «300 887 5156», no «3008875156».

   Y aparece lo que la tarjeta callaba: «Calle 9» NO es una dirección. Sin
   número no se puede llegar ni sale en el mapa, y ese es el motivo real de que
   un cobrador se pierda. */

function FilaContacto({ icono, principal, secundario, acciones }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 58,
      padding: '10px 14px', borderRadius: 14,
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      <span style={{
        width: 18, height: 18, flex: 'none', display: 'inline-flex',
        color: 'var(--cf-ink-3)',
      }}>{icono}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{principal}</span>
        {secundario && (
          <span style={{
            fontSize: 12, color: 'var(--cf-ink-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{secundario}</span>
        )}
      </div>
      {acciones}
    </div>
  )
}

function BotonFila({ onClick, etiqueta, color, children, ancho }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        height: 38, width: ancho ? 'auto' : 38, flex: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: ancho ? '0 13px' : 0, borderRadius: 12,
        background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
        color: color ?? 'var(--cf-ink-2)', font: 'inherit',
        fontSize: 13, fontWeight: 700,
      }}
    >{children}</button>
  )
}

export function InfoContactoCard({ cliente, rutaNombre, onEditar, onWhatsApp }) {
  const tel = cliente?.telefono ? String(cliente.telefono).replace(/\D/g, '') : ''
  const dir = cliente?.direccion?.trim()
  const ref = cliente?.referencia?.trim()
  /* ⚠ CON GPS SÍ SALE EN EL MAPA, POR MUY CORTA QUE SEA LA DIRECCIÓN.
     `direccionIncompleta` solo lee el TEXTO, así que «Carrera 1» o «Las palmas»
     disparaban el aviso aunque el cliente tuviera coordenadas exactas y el
     botón «Ir» lo llevara sin problema. Medido en producción: 353 de 400
     clientes con GPS recibían ese aviso, y era falso en los 353.

     Reportado: «es raro lo que dice de "sin número no sale en el mapa" cuando
     creo que sí tiene coordenadas».

     `irAlMapa` (unas líneas más abajo) ya prefiere las coordenadas sobre el
     texto: el aviso tiene que mirar lo mismo que el botón. */
  const tieneGps = cliente?.latitud != null && cliente?.longitud != null
  const falta = dir && !tieneGps ? direccionIncompleta(dir) : false

  if (!tel && !dir && !cliente?.notas) return null

  /* El mapa, con lo que haya. Si el cliente tiene coordenadas manda el punto
     exacto —es lo que ya hacen la ruta y cobrar hoy—; si no, se manda la
     dirección escrita y que el mapa la busque. */
  const irAlMapa = () => {
    const destino = (cliente?.latitud != null && cliente?.longitud != null)
      ? `${cliente.latitud},${cliente.longitud}`
      : encodeURIComponent([dir, ref].filter(Boolean).join(', '))
    if (!destino) return
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destino}`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.07em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)',
        }}>Cómo ubicarlo</span>
        {onEditar && (
          <button type="button" onClick={onEditar} style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
          }}>Editar</button>
        )}
      </div>

      {tel && (
        <FilaContacto
          icono={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.6a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" />
            </svg>
          )}
          principal={telefonoLegible(tel)}
          secundario="su celular"
          acciones={(
            <span style={{ display: 'inline-flex', gap: 6, flex: 'none' }}>
              <BotonFila onClick={() => { window.location.href = `tel:${tel}` }} etiqueta="Llamar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.6a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" />
                </svg>
              </BotonFila>
              <BotonFila
                onClick={onWhatsApp ?? (() => window.open(`https://wa.me/${tel}`, '_blank'))}
                etiqueta="Escribir por WhatsApp"
                color="#25D366"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" />
                  <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1112 20.2z" />
                </svg>
              </BotonFila>
            </span>
          )}
        />
      )}

      {dir && (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          border: falta ? '1px solid var(--cf-border)' : 0,
        }}>
          <FilaContacto
            icono={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10.5c0 6.5-8 11-8 11s-8-4.5-8-11a8 8 0 1116 0z" />
                <circle cx="12" cy="10.5" r="2.8" />
              </svg>
            )}
            principal={dir}
            secundario={[ref && `al lado de ${ref.toLowerCase()}`, rutaNombre].filter(Boolean).join(' · ') || null}
            acciones={(
              <BotonFila onClick={irAlMapa} etiqueta="Ir en el mapa" ancho>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
                Ir
              </BotonFila>
            )}
          />
          {/* ⚠ EL AVISO QUE LA TARJETA CALLABA. «Calle 9» no lleva a ningún
              sitio: sin número no sale en el mapa, y ese es el motivo real de
              que un cobrador se pierda dando vueltas. */}
          {falta && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              /* Mismo relleno lateral que la fila de arriba (`10px 14px`) para
                 que el icono y el texto arranquen en la misma vertical, y algo
                 más de alto: iba pegado al renglón anterior y se leía como si
                 fuera parte de él. Reportado: «se ve como muy pegado». */
              padding: '12px 14px',
              background: 'color-mix(in srgb, var(--cf-gold) 10%, var(--cf-card))',
              borderTop: '1px solid var(--cf-border)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
              </svg>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--cf-gold-dark)' }}>
                Sin número no sale en el mapa.
              </span>
              {onEditar && (
                <button type="button" onClick={onEditar} style={{
                  border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
                  font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
                }}>Completar</button>
              )}
            </div>
          )}
        </div>
      )}

      {cliente?.notas && (
        <div style={{
          padding: '11px 15px', borderRadius: 14,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <p style={{
            margin: '0 0 3px', fontSize: 10, fontWeight: 800, letterSpacing: '.07em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Notas</p>
          <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--cf-ink-2)' }}>
            {cliente.notas}
          </p>
        </div>
      )}
    </div>
  )
}

// Acciones rapidas en grid (Nuevo prestamo, Historial, Editar, Inactivar, Eliminar)
/* ══ Las acciones del cliente ══════════════════════════════════════════════
   EL COLOR VUELVE A SU SEMÁNTICA — la misma decisión que el menú de gestión.

   Eran OCHO PASTILLAS EN MOSAICO de dos columnas, cada una con su color y su
   icono teñido: nuevo préstamo en verde, reagendar en ámbar, ubicación en gris,
   historial en gris, QR en gris, editar en gris, inactivar en ámbar, eliminar en
   rojo. Con ocho colores a la vez, EL COLOR NO DICE NADA: «eliminar» pesa lo
   mismo que «QR».

   Aquí son filas, y solo lleva color la que reconoce una pérdida. La primera
   —prestarle otra vez— es la que trae al dueño a esta pantalla, así que va
   destacada; el resto son de mantenimiento y se leen de arriba abajo. */
export function AccionesClienteChips({ acciones }) {
  if (!acciones || acciones.length === 0) return null
  const [principal, ...resto] = acciones
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {principal && (
        <button
          onClick={principal.onClick}
          disabled={principal.disabled}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', height: 48, borderRadius: 14, border: 0, cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            font: 'inherit', fontSize: 15, fontWeight: 700,
            opacity: principal.disabled ? .4 : 1,
          }}
        >
          <span style={{ width: 17, height: 17, display: 'inline-flex' }}>{principal.icon}</span>
          {principal.label}
        </button>
      )}

      {resto.length > 0 && (
        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          {resto.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              disabled={a.disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                height: 50, padding: '0 16px', background: 'none', border: 0,
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                cursor: a.disabled ? 'default' : 'pointer',
                textAlign: 'left', font: 'inherit',
                opacity: a.disabled ? .4 : 1,
                // Solo «eliminar» va en rojo: es la unica que reconoce una
                // perdida. Ninguna otra fila lleva color.
                color: a.peligro ? 'var(--cf-red-dark)' : 'var(--cf-ink)',
              }}
            >
              <span style={{
                width: 17, height: 17, flex: 'none', display: 'inline-flex',
                color: a.peligro ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
              }}>{a.icon}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600 }}>{a.label}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
