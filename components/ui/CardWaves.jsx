export default function CardWaves({ tint = 'rgba(255,255,255,0.55)', className = '' }) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 400 180"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cw-glow" cx="85%" cy="25%" r="45%">
          <stop offset="0%" stopColor={tint} stopOpacity="0.5" />
          <stop offset="100%" stopColor={tint} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="340" cy="45" r="90" fill="url(#cw-glow)" />
      <path
        d="M220 -20 C 280 20, 240 70, 300 110 C 340 135, 310 165, 420 180 L 420 -20 Z"
        fill={tint}
        opacity="0.18"
      />
      <path
        d="M280 -20 C 330 25, 270 85, 340 130 C 375 150, 360 170, 420 185 L 420 -20 Z"
        fill={tint}
        opacity="0.12"
      />
      <path
        d="M-60 140 C 40 110, 120 160, 220 125 C 280 105, 320 135, 400 120 L 400 200 L -60 200 Z"
        fill={tint}
        opacity="0.10"
      />
    </svg>
  )
}
