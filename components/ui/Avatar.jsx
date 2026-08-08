// components/ui/Avatar.jsx
// Avatar reutilizable: muestra foto, avatar NFT seleccionado, o 2 iniciales con color
// solido/gradiente unico por nombre. Colores se asignan deterministicamente por hash del nombre.

import { getAvatarById } from '@/lib/avatars'

const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #7a6cf0, #9385f5)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #e5484d, #f0575c)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #e7a400, #f5b824)', text: '#3a2900' },
  { bg: 'linear-gradient(135deg, #12a150, #2fbe6a)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #2f6fed, #5b8df5)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #0fa5a5, #2dbdbd)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #c05cf5, #9385f5)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #f07a24, #f5b824)', text: '#3a2900' },
  { bg: 'linear-gradient(135deg, #2fbe6a, #2dbdbd)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #5b8df5, #7a6cf0)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #e5484d, #f07a24)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #0fa5a5, #12a150)', text: '#fff' },
]

function hashNombre(nombre) {
  let h = 0
  const s = (nombre || '').toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getIniciales(nombre) {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  if (partes.length >= 2) {
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }
  return partes[0][0]?.toUpperCase() ?? '?'
}

export function getAvatarColor(nombre) {
  return AVATAR_COLORS[hashNombre(nombre) % AVATAR_COLORS.length]
}

export default function Avatar({ nombre, fotoUrl, avatarId, size = 40, fontSize, round = false, className = '', onClick, style: extraStyle }) {
  const px = `${size}px`
  const fs = fontSize || Math.round(size * 0.38)
  const radius = round ? '50%' : `${Math.max(8, Math.round(size * 0.3))}px`
  const shapeClass = round ? 'rounded-full' : ''

  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nombre || ''}
        onClick={onClick}
        loading="lazy"
        decoding="async"
        className={`object-cover shrink-0 ${shapeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: px, height: px, minWidth: px, borderRadius: round ? undefined : radius, ...extraStyle }}
      />
    )
  }

  const elegido = avatarId ? getAvatarById(avatarId) : null
  if (elegido) {
    return (
      /* ⚠ `<img>` Y NO SVG INCRUSTADO. Dos motivos, los dos medidos:
             · Los 96 dibujos pesan 550 KB. Incrustados viajan en el JS a todo
               el mundo, tenga avatar o no; como imagen se baja solo el suyo.
             · DiceBear emite `id="viewboxMask"`, EL MISMO en todos. Varios en
               la misma página y las máscaras se pisan: en mi hoja de muestra
               cinco estilos salieron en blanco. En un `<img>` cada SVG es su
               propio documento. */
      <img
        src={elegido.src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        onClick={onClick}
        className={`shrink-0 overflow-hidden ${shapeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: px, height: px, minWidth: px, borderRadius: round ? undefined : radius, ...extraStyle }}
      />
    )
  }

  const color = getAvatarColor(nombre)
  const iniciales = getIniciales(nombre)

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center font-bold shrink-0 select-none ${shapeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: px,
        height: px,
        minWidth: px,
        borderRadius: round ? undefined : radius,
        background: color.bg,
        color: color.text,
        fontSize: `${fs}px`,
        letterSpacing: iniciales.length > 1 ? '-0.02em' : undefined,
        ...extraStyle,
      }}
    >
      {iniciales}
    </div>
  )
}
