'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const LS_KEY = 'cf:novedad-qr:visto'

const STEPS = [
  {
    tag: 'Nueva funcionalidad',
    titulo: 'Cobro con QR',
    texto: 'Ahora puedes cobrar escaneando un codigo QR. Sin buscar al cliente, sin navegar. Escaneas, y el sistema abre el cobro al instante.',
    icon: 'qr',
  },
  {
    tag: 'Paso 1',
    titulo: 'Genera el QR de cada cliente',
    texto: 'Entra al perfil de cualquier cliente y toca "Codigo QR". Puedes descargarlo, imprimirlo o compartirlo por WhatsApp. Cada QR es unico por cliente.',
    icon: 'download',
  },
  {
    tag: 'Paso 2',
    titulo: 'Imprime y pega en el negocio',
    texto: 'Imprime el QR y pegalo en el negocio del cliente, en su cartulina o en cualquier lugar visible. Cuando el cobrador llegue, solo tiene que escanear.',
    icon: 'print',
  },
  {
    tag: 'Paso 3',
    titulo: 'Escanea y cobra',
    texto: 'En la barra inferior, toca "Mas opciones" y luego "Escanear QR". Apunta la camara al codigo y el sistema abre el cobro del cliente automaticamente. Funciona en iPhone y Android.',
    icon: 'scan',
  },
  {
    tag: 'Beneficios',
    titulo: 'Cobra más rápido',
    texto: 'El cobrador no tiene que buscar al cliente en la app. Escanea, cobra y sigue. Reduce errores, ahorra tiempo en cada parada y profesionaliza el negocio.',
    icon: 'bolt',
  },
]

const ICON_PATHS = {
  qr: 'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z M13.5 14.625v2.25m3-5.625v2.25m0 3v2.25m3-6.75v2.25m-6 3.75h1.5m3 0h3',
  download: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
  print: 'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z',
  scan: 'M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  bolt: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
}

/* ⚠ NADA QUE SE ABRA SOLO PUEDE TAPAR LA PANTALLA DE PAGAR. El modal del
   teléfono cayó encima del botón de suscribirse y el dueño estuvo un día sin
   encontrarlo. Éste hoy no está montado en ninguna parte, pero si algún día se
   monta, la regla es la misma. */
const RUTAS_SIN_MODAL = ['/configuracion/plan', '/pago', '/checkout']

export default function NovedadQrModal() {
  const [abierto, setAbierto] = useState(false)
  const [step, setStep] = useState(0)
  const ruta = usePathname()

  useEffect(() => {
    if (RUTAS_SIN_MODAL.some((r) => ruta?.startsWith(r))) return
    try {
      if (localStorage.getItem(LS_KEY)) return
      const t = setTimeout(() => setAbierto(true), 800)
      return () => clearTimeout(t)
    } catch {}
  }, [ruta])

  const cerrar = () => {
    try { localStorage.setItem(LS_KEY, '1') } catch {}
    setAbierto(false)
    setStep(0)
  }

  if (!abierto) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novedad: Cobro con QR"
    >
      <button
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: 'nqr-fade 180ms ease-out' }}
      />

      <div
        className="relative w-full sm:max-w-md overflow-hidden rounded-t-[20px] sm:rounded-[20px] border border-[var(--cf-border)] bg-[var(--cf-card)]"
        style={{ animation: 'nqr-up 260ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        {/* Header con gradiente */}
        <div
          className="relative px-5 pt-5 pb-6 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-gold) 14%, transparent) 0%, transparent 100%)' }}
        >
          {/* Close */}
          <button
            onClick={cerrar}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--cf-ink) 8%, transparent)' }}
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" style={{ color: 'var(--cf-ink-2)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--cf-gold) 20%, transparent)', color: 'var(--cf-gold)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[current.icon]} />
            </svg>
          </div>

          {/* Tag */}
          <span
            className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md mb-2"
            style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)', color: 'var(--cf-gold)' }}
          >
            {current.tag}
          </span>

          <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--cf-ink)' }}>
            {current.titulo}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            {current.texto}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: i === step ? 20 : 6,
                background: i === step
                  ? 'var(--cf-gold)'
                  : 'color-mix(in srgb, var(--cf-ink) 15%, transparent)',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          {!isFirst && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="h-11 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Atras
            </button>
          )}
          <button
            onClick={isLast ? cerrar : () => setStep(s => s + 1)}
            className="flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            style={{ background: 'var(--cf-gold)', color: '#18181b' }}
          >
            {isLast ? 'Entendido' : 'Siguiente'}
            {!isLast && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes nqr-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nqr-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          [style*="nqr-up"], [style*="nqr-fade"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
