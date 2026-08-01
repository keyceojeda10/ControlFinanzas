// components/ui/MonedaCF.jsx — Moneda de Control Finanzas.
// SVG puro. Poses para empty states y feedback visual.
//   feliz    — default (ojos abiertos, sonrisa)
//   vacia    — ojos dormidos (listas sin datos)
//   celebra  — ojos emocionados + brillos (logros, exito)
//   busca    — ojo grande + burbuja ? (sin resultados de busqueda)
//   guia     — guino + flecha (CTAs, onboarding)

const GOLD     = 'var(--cf-gold)'
const GOLD_DARK = '#d4a90e'
const INK      = 'var(--cf-ink)'
const BLUSH    = '#ff6b8a'

export default function MonedaCF({ pose = 'feliz', size = 96, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Sombra suave */}
      <ellipse cx="50" cy="93" rx="26" ry="4" fill="rgba(20,20,40,0.08)" />

      {/* Moneda — cuerpo */}
      <circle cx="50" cy="50" r="38" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      {/* Borde interior punteado */}
      <circle cx="50" cy="50" r="32" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.25" />
      {/* $ sutil de fondo */}
      <text x="50" y="34" textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} opacity="0.12">$</text>

      {/* Cachetes (no en busca) */}
      {pose !== 'busca' && (
        <>
          <circle cx="30" cy="58" r="4.5" fill={BLUSH} opacity="0.45" />
          <circle cx="70" cy="58" r="4.5" fill={BLUSH} opacity="0.45" />
        </>
      )}

      {/* ── OJOS + BOCA POR POSE ── */}

      {pose === 'feliz' && (
        <>
          <circle cx="38" cy="48" r="3.5" fill={INK} />
          <circle cx="62" cy="48" r="3.5" fill={INK} />
          <circle cx="40" cy="46.5" r="1.2" fill="#fff" opacity="0.7" />
          <circle cx="64" cy="46.5" r="1.2" fill="#fff" opacity="0.7" />
          <path d="M40 62 Q50 70 60 62" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {pose === 'vacia' && (
        <>
          <path d="M33 48 L43 48" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 48 L67 48" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M42 64 Q50 60 58 64" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {pose === 'celebra' && (
        <>
          <path d="M32 50 Q38 43 44 50" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M56 50 Q62 43 68 50" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M38 60 Q50 73 62 60 Q50 67 38 60 Z" fill={BLUSH} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          {/* Brillos */}
          <path d="M14 22 L16 16 L18 22 L24 24 L18 26 L16 32 L14 26 L8 24 Z" fill="#a78bfa" opacity="0.8" />
          <path d="M82 28 L84 24 L86 28 L90 30 L86 32 L84 36 L82 32 L78 30 Z" fill="#34d399" opacity="0.8" />
          <path d="M84 66 L85 63 L86 66 L89 67 L86 68 L85 71 L84 68 L81 67 Z" fill="#60a5fa" opacity="0.7" />
        </>
      )}

      {pose === 'busca' && (
        <>
          <circle cx="38" cy="48" r="3.5" fill={INK} />
          <circle cx="62" cy="48" r="2.8" fill={INK} />
          <circle cx="40" cy="46.5" r="1.2" fill="#fff" opacity="0.7" />
          <path d="M42 64 L58 62" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Burbuja ? */}
          <circle cx="80" cy="26" r="7.5" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="73" cy="36" r="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
          <text x="80" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>?</text>
        </>
      )}

      {pose === 'guia' && (
        <>
          {/* Guino */}
          <circle cx="38" cy="48" r="3.5" fill={INK} />
          <circle cx="40" cy="46.5" r="1.2" fill="#fff" opacity="0.7" />
          <path d="M57 48 L67 48" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 62 Q50 70 60 62" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Flecha apuntando abajo-derecha */}
          <path d="M78 32 L86 40" stroke={GOLD_DARK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M80 40 L86 40 L86 34" stroke={GOLD_DARK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
    </svg>
  )
}
