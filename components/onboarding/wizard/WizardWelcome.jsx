'use client'

import { useRef } from 'react'

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    titulo: 'Importa con foto',
    desc: 'Cartulina, cuaderno, libreta. Le tomas foto y el sistema extrae todo.',
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.885l6.198-1.424A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.98.997-3.648-.235-.374A9.861 9.861 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106S21.894 6.58 21.894 12 17.42 21.894 12 21.894z"/>
      </svg>
    ),
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    titulo: 'Alertas por WhatsApp',
    desc: 'El sistema avisa a tus clientes cuando se acerca el cobro.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    titulo: 'Rutas de cobro con GPS',
    desc: 'Tus cobradores ven su recorrido del día. Tú el reporte en vivo.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.12)',
    titulo: 'Reportes y cierre de caja',
    desc: 'Mora, cartera, recaudo. Todo sin hojas de cálculo.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    titulo: 'Múltiples métodos de interés',
    desc: 'Fijo, sobre saldo, cuota única. Como tú cobras, no el sistema.',
  },
]

const IMPORT_OPTIONS = [
  {
    id: 'migrador',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.06)',
    border: 'rgba(245,197,24,0.18)',
    titulo: 'Uno por uno (rápido)',
    desc: 'Cliente + préstamo en una sola pantalla. El más ágil para migrar.',
    tag: 'Recomendado',
    tagColor: '#f5c518',
    href: '/migrador',
  },
  {
    id: 'foto',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.07)',
    border: 'rgba(167,139,250,0.22)',
    titulo: 'Foto de cartulina o cuaderno',
    desc: 'Tómale foto a tu registro y la IA extrae nombre, monto, pagos...',
    href: '/clientes/nuevo',
  },
  {
    id: 'excel',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.22)',
    titulo: 'Subir archivo Excel o CSV',
    desc: 'Si ya tienes una hoja de cálculo con tus clientes, súbela directo.',
    href: '/carga-masiva',
  },
]

export default function WizardWelcome({ nombre, onNext, onDismiss, onNavigate }) {
  const firstName = nombre ? nombre.split(' ')[0] : null
  const sliderRef = useRef(null)
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 })

  const onMouseDown = (e) => {
    drag.current = { active: true, startX: e.pageX - sliderRef.current.offsetLeft, scrollLeft: sliderRef.current.scrollLeft }
    sliderRef.current.style.cursor = 'grabbing'
  }
  const onMouseUp = () => { drag.current.active = false; if (sliderRef.current) sliderRef.current.style.cursor = 'grab' }
  const onMouseMove = (e) => {
    if (!drag.current.active) return
    e.preventDefault()
    const x = e.pageX - sliderRef.current.offsetLeft
    sliderRef.current.scrollLeft = drag.current.scrollLeft - (x - drag.current.startX) * 1.2
  }

  const handleImportOption = (opt) => {
    if (onNavigate) {
      onNavigate(opt.href)
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '82vh' }}>

      {/* Hero */}
      <div className="text-center pt-1 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-5"
          style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.18)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518] animate-pulse inline-block" />
          Tu período de prueba está activo
        </div>

        <h1 className="text-[30px] font-bold leading-[1.15] mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {firstName ? (
            <>{firstName}, bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          ) : (
            <>Bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          )}
        </h1>
        <p className="text-[13px] max-w-[260px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          La plataforma que usan más de 500 prestamistas en Colombia y LATAM para cobrar más y perder menos.
        </p>
      </div>

      {/* Feature strip */}
      <div className="relative mb-6">
        <div
          ref={sliderRef}
          className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {FEATURES.map((f, i) => (
            <div key={i}
              className="snap-start shrink-0 rounded-[14px] p-4 flex flex-col"
              style={{ width: '220px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="w-9 h-9 rounded-[9px] flex items-center justify-center mb-3"
                style={{ background: f.bg, color: f.color }}>
                {f.icon}
              </div>
              <p className="text-[13px] font-semibold mb-1.5 leading-tight" style={{ color: 'var(--color-text-primary)' }}>{f.titulo}</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
          <div className="shrink-0 w-1" />
        </div>
        <div className="absolute right-0 top-0 bottom-1 w-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, var(--color-bg-base))' }} />
      </div>

      {/* Import options */}
      <div className="flex-1 flex flex-col justify-end gap-2.5 pb-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Trae tu cartera al sistema
        </p>

        {IMPORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleImportOption(opt)}
            className="group w-full rounded-[16px] p-3.5 text-left transition-all active:scale-[0.98] cursor-pointer"
            style={{ background: opt.bg, border: `1px solid ${opt.border}` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${opt.color} 15%, transparent)`, color: opt.color }}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{opt.titulo}</p>
                  {opt.tag && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `color-mix(in srgb, ${opt.tagColor} 15%, transparent)`, color: opt.tagColor }}>
                      {opt.tag}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {opt.desc}
                </p>
              </div>
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke={opt.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}

        {/* Demo option — smaller, secondary */}
        <button
          onClick={() => onNext(true)}
          className="group w-full rounded-[12px] p-3 text-left transition-all active:scale-[0.98] cursor-pointer mt-1"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Solo quiero explorar primero</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Datos demo que se borran al terminar</p>
            </div>
          </div>
        </button>

        <button
          onClick={onDismiss}
          className="mt-0.5 text-[11px] text-center w-full transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}>
          Ya conozco el sistema — ir al dashboard
        </button>
      </div>
    </div>
  )
}
