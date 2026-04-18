// components/ui/Mascota.jsx — Mascota de Control Finanzas (moneda con cara)

export default function Mascota({ variant = 'happy', size = 120, className = '' }) {
  const eyes = {
    happy:     <><circle cx="38" cy="48" r="4" fill="#1a1a2e" /><circle cx="62" cy="48" r="4" fill="#1a1a2e" /></>,
    empty:     <><path d="M33 48 L43 48" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/><path d="M57 48 L67 48" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/></>,
    celebrate: <><path d="M32 52 Q38 44 44 52" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none"/><path d="M56 52 Q62 44 68 52" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none"/></>,
    thinking:  <><circle cx="38" cy="48" r="4" fill="#1a1a2e" /><circle cx="62" cy="48" r="3" fill="#1a1a2e" /></>,
  }[variant] || <><circle cx="38" cy="48" r="4" fill="#1a1a2e" /><circle cx="62" cy="48" r="4" fill="#1a1a2e" /></>

  const mouth = {
    happy:     <path d="M38 62 Q50 72 62 62" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />,
    empty:     <path d="M42 66 Q50 62 58 66" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />,
    celebrate: <path d="M36 60 Q50 76 64 60 Q50 70 36 60 Z" fill="#ff6b8a" stroke="#1a1a2e" strokeWidth="2.5" strokeLinejoin="round" />,
    thinking:  <path d="M42 66 L58 64" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />,
  }[variant] || <path d="M38 62 Q50 72 62 62" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`Mascota ${variant}`}
    >
      {/* sombra */}
      <ellipse cx="50" cy="92" rx="28" ry="4" fill="rgba(20,20,40,0.08)" />
      {/* moneda base */}
      <circle cx="50" cy="50" r="38" fill="#f5c518" stroke="#1a1a2e" strokeWidth="3" />
      {/* ring interior */}
      <circle cx="50" cy="50" r="32" fill="none" stroke="#1a1a2e" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.4" />
      {/* simbolo $ detras */}
      <text x="50" y="32" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1a1a2e" opacity="0.2">$</text>
      {/* cachetes */}
      {variant !== 'thinking' && (
        <>
          <circle cx="30" cy="60" r="4" fill="#ff6b8a" opacity="0.6" />
          <circle cx="70" cy="60" r="4" fill="#ff6b8a" opacity="0.6" />
        </>
      )}
      {/* ojos */}
      {eyes}
      {/* boca */}
      {mouth}
      {/* brillitos celebrate */}
      {variant === 'celebrate' && (
        <>
          <path d="M12 20 L14 14 L16 20 L22 22 L16 24 L14 30 L12 24 L6 22 Z" fill="#a78bfa" />
          <path d="M82 30 L84 26 L86 30 L90 32 L86 34 L84 38 L82 34 L78 32 Z" fill="#22c9a0" />
          <path d="M86 68 L87 65 L88 68 L91 69 L88 70 L87 73 L86 70 L83 69 Z" fill="#4fb8e5" />
        </>
      )}
      {/* burbuja thinking */}
      {variant === 'thinking' && (
        <>
          <circle cx="82" cy="26" r="7" fill="#ffffff" stroke="#1a1a2e" strokeWidth="2" />
          <circle cx="75" cy="36" r="3" fill="#ffffff" stroke="#1a1a2e" strokeWidth="1.5" />
          <text x="82" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a2e">?</text>
        </>
      )}
    </svg>
  )
}
