// components/ui/Capi.jsx — Capi, la mascota capibara de Control Finanzas.
// SVG geometrico puro (sin assets externos). Poses:
//   feliz   — default, ojos cerrados contentos
//   celebra — confetti + ojos emocionados (pago exitoso, metas)
//   duerme  — Zzz (estados vacios "no hay nada aun")
//   busca   — lupa (busquedas sin resultados)
// Colores fijos de pelaje (funcionan en dark y light); confetti usa la paleta de marca.

const FUR       = '#C08E5F'
const FUR_DARK  = '#A1734A'
const INK       = '#4A3527'
const BLUSH     = '#E8A0A0'

const CONFETTI = [
  { cx: 14,  cy: 16, r: 2.6, fill: '#f5c518' },
  { cx: 30,  cy: 7,  r: 2.2, fill: '#34d399' },
  { cx: 48,  cy: 13, r: 2.0, fill: '#c084fc' },
  { cx: 62,  cy: 4,  r: 2.4, fill: '#60a5fa' },
  { cx: 99,  cy: 8,  r: 2.2, fill: '#f5c518' },
  { cx: 116, cy: 18, r: 2.0, fill: '#f9a8d4' },
]

export default function Capi({ pose = 'feliz', size = 96, className = '', style }) {
  const h = Math.round(size * (96 / 120))
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {/* Sombra */}
      <ellipse cx="60" cy="89" rx="42" ry="4.5" fill="rgba(0,0,0,0.10)" />

      {/* Cuerpo (pan de capibara) */}
      <rect x="10" y="32" width="86" height="46" rx="23" fill={FUR} />
      {/* Cabeza — mas alta y hacia la derecha, hocico cuadrado */}
      <rect x="64" y="20" width="48" height="42" rx="17" fill={FUR} />
      {/* Hocico */}
      <rect x="96" y="26" width="16" height="30" rx="8" fill={FUR_DARK} />
      <ellipse cx="106" cy="34" rx="2" ry="1.5" fill={INK} />

      {/* Orejas */}
      <ellipse cx="72" cy="20" rx="6" ry="5.5" fill={FUR_DARK} />
      <ellipse cx="88" cy="18" rx="6" ry="5.5" fill={FUR_DARK} />
      <ellipse cx="72" cy="20.5" rx="3" ry="2.6" fill={INK} opacity="0.35" />
      <ellipse cx="88" cy="18.5" rx="3" ry="2.6" fill={INK} opacity="0.35" />

      {/* Patas */}
      <rect x="20" y="72" width="9" height="13" rx="4" fill={FUR_DARK} />
      <rect x="37" y="72" width="9" height="13" rx="4" fill={FUR_DARK} />
      <rect x="63" y="72" width="9" height="13" rx="4" fill={FUR_DARK} />
      <rect x="80" y="72" width="9" height="13" rx="4" fill={FUR_DARK} />

      {/* Mejilla */}
      <circle cx="85" cy="46" r="4" fill={BLUSH} opacity="0.5" />

      {/* ── Ojos y boca por pose ── */}
      {pose === 'feliz' && (
        <>
          <path d="M77 34 q5 4 10 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M101 45 q4 3.5 8 0.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {pose === 'celebra' && (
        <>
          <path d="M77 35 q5 -4.5 10 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="105" cy="47" rx="3.4" ry="2.8" fill={INK} />
          <g className="capi-confetti">
            {CONFETTI.map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} />
            ))}
            <rect x="80" y="6" width="4.5" height="4.5" rx="1" fill="#34d399" transform="rotate(24 82 8)" />
            <rect x="22" y="24" width="4" height="4" rx="1" fill="#60a5fa" transform="rotate(-18 24 26)" />
          </g>
        </>
      )}

      {pose === 'duerme' && (
        <>
          <path d="M77 35 q5 2.6 10 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M102 46 q3 1.5 6 0.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          <text x="70" y="14" fontSize="12" fontWeight="700" fill={INK} opacity="0.5" fontFamily="inherit">z</text>
          <text x="82" y="9" fontSize="9" fontWeight="700" fill={INK} opacity="0.4" fontFamily="inherit">z</text>
          <text x="91" y="5.5" fontSize="7" fontWeight="700" fill={INK} opacity="0.3" fontFamily="inherit">z</text>
        </>
      )}

      {pose === 'busca' && (
        <>
          <circle cx="82" cy="34" r="2.6" fill={INK} />
          <path d="M102 46 q3 2 6 1" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          {/* Lupa flotando frente a la cabeza */}
          <circle cx="106" cy="13" r="7.5" stroke={INK} strokeWidth="2.4" fill="rgba(255,255,255,0.10)" />
          <path d="M100.5 18.5 L94 26" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
