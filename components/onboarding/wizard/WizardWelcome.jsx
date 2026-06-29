'use client'

const IMPORT_OPTIONS = [
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
    titulo: 'Tengo un Excel o archivo',
    desc: 'Sube tu hoja de calculo y el sistema importa todos tus clientes de una vez.',
    tag: 'Mas rapido',
    tagColor: '#22c55e',
    href: '/carga-masiva',
  },
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
    titulo: 'Los tengo en la cabeza o en papel',
    desc: 'Agrega cliente + prestamo uno por uno en una sola pantalla. Puedes usar foto de cartulina.',
    tag: 'Recomendado',
    tagColor: '#f5c518',
    href: '/migrador',
  },
  {
    id: 'manual',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.07)',
    border: 'rgba(59,130,246,0.22)',
    titulo: 'Quiero agregar uno solo',
    desc: 'Crea un cliente manualmente con todos los detalles. Ideal si apenas vas a empezar.',
    href: '/clientes/nuevo',
  },
]

export default function WizardWelcome({ nombre, onNext, onDismiss, onNavigate }) {
  const firstName = nombre ? nombre.split(' ')[0] : null

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
          Tu periodo de prueba esta activo
        </div>

        <h1 className="text-[28px] font-bold leading-[1.15] mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {firstName ? (
            <>{firstName}, bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          ) : (
            <>Bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          )}
        </h1>
        <p className="text-[14px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Lo primero es subir tus clientes al sistema. Elige como prefieres hacerlo:
        </p>
      </div>

      {/* Import options */}
      <div className="flex-1 flex flex-col justify-start gap-2.5 pb-2">

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

        {/* Demo option */}
        <button
          onClick={() => onNext(true)}
          className="group w-full rounded-[12px] p-3 text-left transition-all active:scale-[0.98] cursor-pointer mt-2"
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
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No tengo clientes aun, quiero explorar</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Datos de ejemplo que se borran al terminar</p>
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
