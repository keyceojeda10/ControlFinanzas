'use client'

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
    titulo: 'Importa cartulinas con foto',
    desc: 'Saca foto a tu tarjeta y el sistema registra todo automáticamente.',
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

export default function WizardWelcome({ nombre, onNext, onDismiss }) {
  const firstName = nombre ? nombre.split(' ')[0] : null

  return (
    <div className="flex flex-col" style={{ minHeight: '82vh' }}>

      {/* ── Hero ── */}
      <div className="text-center pt-1 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-5"
          style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.18)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518] animate-pulse inline-block" />
          Tu periodo de prueba está activo
        </div>

        <h1 className="text-[30px] font-bold leading-[1.15] mb-3"
          style={{ color: '#f0f0f5', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {firstName ? (
            <>{firstName}, bienvenido a<br /><em style={{ color: '#f5c518', fontStyle: 'italic' }}>Control Finanzas</em></>
          ) : (
            <>Bienvenido a<br /><em style={{ color: '#f5c518', fontStyle: 'italic' }}>Control Finanzas</em></>
          )}
        </h1>
        <p className="text-[13px] max-w-[260px] mx-auto leading-relaxed" style={{ color: '#7777a0' }}>
          La plataforma que usan más de 500 prestamistas en Colombia y LATAM para cobrar más y perder menos.
        </p>
      </div>

      {/* ── Feature strip (scroll horizontal) ── */}
      <div className="relative mb-7">
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {FEATURES.map((f, i) => (
            <div key={i}
              className="snap-start shrink-0 rounded-[14px] p-4 flex flex-col"
              style={{ width: '180px', background: '#0f0f18', border: '1px solid #1e1e2e' }}>
              <div className="w-9 h-9 rounded-[9px] flex items-center justify-center mb-3"
                style={{ background: f.bg, color: f.color }}>
                {f.icon}
              </div>
              <p className="text-[12px] font-semibold mb-1 leading-tight" style={{ color: '#ddddef' }}>{f.titulo}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#5e5e7a' }}>{f.desc}</p>
            </div>
          ))}
          {/* spacer */}
          <div className="shrink-0 w-1" />
        </div>
        <div className="absolute right-0 top-0 bottom-1 w-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, #0d0d14)' }} />
      </div>

      {/* ── Testimonial ── */}
      <div className="mx-1 mb-7 px-4 py-3 rounded-[14px]"
        style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.12)' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#f5c518,#f0a800)', color: '#111' }}>RT</div>
          <div>
            <p className="text-[12px] italic leading-relaxed" style={{ color: '#aaaacc' }}>
              "Pasamos de Excel a Control Finanzas y nuestra mora bajó del 14% al 5.2% en cuatro meses."
            </p>
            <p className="text-[10px] mt-1" style={{ color: '#555570' }}>
              Ricardo Tovar · Préstamos del Valle · 800+ clientes activos
            </p>
          </div>
        </div>
      </div>

      {/* ── Modo selector ── */}
      <div className="flex-1 flex flex-col justify-end gap-3 pb-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#44445a' }}>
          ¿Cómo quieres empezar?
        </p>

        {/* Demo */}
        <button
          onClick={() => onNext(true)}
          className="group w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.22)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[14px] font-bold" style={{ color: '#e8e8f0' }}>Explorar con datos demo</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>Recomendado</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#666680' }}>
                Usa datos de ejemplo. Al terminar se borran solos — tu cuenta queda limpia.
              </p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Real */}
        <button
          onClick={() => onNext(false)}
          className="group w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.18)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold mb-0.5" style={{ color: '#e8e8f0' }}>Empezar con mi primer cliente real</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#666680' }}>
                Registra un cliente de verdad. Ideal si ya tienes cartera lista para migrar.
              </p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          onClick={onDismiss}
          className="mt-0.5 text-[11px] text-center w-full transition-colors cursor-pointer"
          style={{ color: '#3e3e52' }}>
          Ya conozco el sistema — ir al dashboard
        </button>
      </div>
    </div>
  )
}
