'use client'

export default function WizardWelcome({ nombre, onNext, onDismiss, onNavigate }) {
  const firstName = nombre ? nombre.split(' ')[0] : null

  const go = (href) => onNavigate?.(href)

  return (
    <div className="flex flex-col" style={{ minHeight: '82vh' }}>

      {/* Hero */}
      <div className="text-center pt-1 pb-6">
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
          Para empezar, agrega tus clientes al sistema.
          <br />
          Elige la opcion que mejor te funcione:
        </p>
      </div>

      {/* Opciones principales */}
      <div className="flex-1 flex flex-col justify-start gap-3 pb-2">

        {/* Opcion 1: Agregar uno por uno — la mas comun */}
        <button
          onClick={() => go('/migrador')}
          className="group w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.22)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,197,24,0.15)', color: '#f5c518' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Migrar mis clientes</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(245,197,24,0.15)', color: '#f5c518' }}>
                  Recomendado
                </span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Registra cada cliente con su prestamo en una sola pantalla. Puedes tomar foto de la cartulina y el sistema lee los datos.
              </p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Opcion 2: Importar desde Excel */}
        <button
          onClick={() => go('/carga-masiva')}
          className="group w-full rounded-[16px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Importar desde Excel</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                  Carga masiva
                </span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Si ya tienes una hoja de calculo con tus clientes, subela y el sistema los importa todos de una vez.
              </p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Opcion 3: Crear un solo cliente */}
        <button
          onClick={() => go('/clientes/nuevo')}
          className="group w-full rounded-[14px] p-3.5 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Crear un solo cliente</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Registro manual con todos los datos del cliente.
              </p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Separador visual */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>o si prefieres</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        </div>

        {/* Demo */}
        <button
          onClick={() => onNext(true)}
          className="group w-full rounded-[12px] p-3 text-left transition-all active:scale-[0.98] cursor-pointer"
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
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Explorar con datos de ejemplo</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Prueba el sistema sin crear nada real. Los datos se borran al terminar.</p>
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
