// components/ui/CardWaves.jsx — textura de olas sutiles para las tarjetas
// (estilo tarjeta fintech premium: lineas blancas fluidas concentradas a la
// derecha + un susurro horizontal abajo-izquierda). SVG puro, decorativo.

export default function CardWaves({ tint = 'rgba(255,255,255,0.55)', className = '' }) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 400 180"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <path d="M258 -30 C 305 30, 225 92, 282 210" stroke={tint} strokeWidth="1.6" />
      <path d="M292 -30 C 342 36, 258 98, 318 210" stroke={tint} strokeWidth="1.4" opacity="0.72" />
      <path d="M328 -30 C 380 44, 295 106, 356 210" stroke={tint} strokeWidth="1.2" opacity="0.5" />
      <path d="M-40 150 C 60 118, 150 178, 250 138" stroke={tint} strokeWidth="1.2" opacity="0.38" />
    </svg>
  )
}
