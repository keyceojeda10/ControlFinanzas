// components/ui/ChipTarjeta.jsx — chip EMV dorado para las tarjetas de
// cliente/prestamo (look de tarjeta de credito). SVG puro, sin assets.

export default function ChipTarjeta({ width = 26, className = '' }) {
  const height = Math.round(width * (20 / 26))
  return (
    <svg width={width} height={height} viewBox="0 0 26 20" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="cfChipGrad" x1="0" y1="0" x2="26" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4dc82" />
          <stop offset="0.5" stopColor="#d9ae3e" />
          <stop offset="1" stopColor="#f5c518" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="25" height="19" rx="4.5" fill="url(#cfChipGrad)" stroke="rgba(60,42,10,0.35)" />
      <path
        d="M9.5 0.5 v5.5 a2.5 2.5 0 0 0 2.5 2.5 h2 a2.5 2.5 0 0 0 2.5 -2.5 V0.5 M9.5 19.5 v-5.5 a2.5 2.5 0 0 1 2.5 -2.5 h2 a2.5 2.5 0 0 1 2.5 2.5 v5.5 M0.5 10 h9 M16.5 10 h9"
        stroke="rgba(60,42,10,0.35)"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  )
}
