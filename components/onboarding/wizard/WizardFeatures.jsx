'use client'

const CAPS = [
  {
    id: 'cartulina',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    tag: 'Exclusivo CF',
    titulo: 'Importa cartulinas con foto',
    detalle: 'Toma una foto de tu cartulina física. La IA extrae nombre, monto, tasa, plazo y cuotas pagadas. En segundos queda registrado.',
    beneficio: 'Migra toda tu cartera sin tipear nada.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    tag: 'Automatizado',
    titulo: 'Alertas automáticas por WhatsApp',
    detalle: 'El sistema envía recordatorios a tus clientes cuando se acerca el cobro. Sin llamadas, sin perseguir.',
    beneficio: 'Tu mora baja sin que hagas nada extra.',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.885l6.198-1.424A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.98.997-3.648-.235-.374A9.861 9.861 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106S21.894 6.58 21.894 12 17.42 21.894 12 21.894z"/>
      </svg>
    ),
  },
  {
    id: 'rutas',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    tag: 'Tiempo real',
    titulo: 'Rutas de cobro con GPS',
    detalle: 'Asigna clientes a cobradores por zona. Ellos ven su ruta en el celular. Tú ves en tiempo real quién pagó, quién no y cuánto se recaudó.',
    beneficio: 'Control total de tu equipo sin llamadas.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: 'metodos',
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.1)',
    tag: 'Flexible',
    titulo: 'Múltiples métodos de interés',
    detalle: 'Interés fijo por período, sobre saldo decreciente, o cuota única al inicio. Configura el sistema como tú trabajas — no al revés.',
    beneficio: 'Sin compromisos con un solo método.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'reportes',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)',
    tag: 'Sin Excel',
    titulo: 'Reportes y cierre de caja',
    detalle: 'Saldo en cartera, clientes en mora, recaudo del día por cobrador, utilidad mensual. Todo actualizado al instante.',
    beneficio: 'Toma decisiones con datos, no con intuición.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function WizardFeatures({ onNext }) {
  return (
    <div className="max-w-md mx-auto flex flex-col" style={{ minHeight: '80vh' }}>

      <div className="text-center mb-6">
        <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: "Georgia, serif" }}>
          Esto es lo que <em style={{ color: '#f5c518', fontStyle: 'italic' }}>también</em> puedes hacer
        </h2>
        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          Control Finanzas va mucho más allá de llevar clientes y préstamos.
        </p>
      </div>

      <div className="flex-1 space-y-3 mb-6">
        {CAPS.map((c) => (
          <div key={c.id}
            className="rounded-[12px] p-4"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0"
                style={{ background: c.bg, color: c.color }}>
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.titulo}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
                    style={{ background: c.bg, color: c.color }}>{c.tag}</span>
                </div>
                <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{c.detalle}</p>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke={c.color} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-[11px] font-medium" style={{ color: c.color }}>{c.beneficio}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pb-2">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: '#f5c518', color: '#111' }}>
          Continuar al resumen
        </button>
      </div>
    </div>
  )
}
