// components/ui/Avatar.jsx
// Avatar reutilizable: muestra foto, avatar NFT seleccionado, o 2 iniciales con color
// solido/gradiente unico por nombre. Colores se asignan deterministicamente por hash del nombre.

import { getAvatarById } from '@/lib/avatars'

const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #6366f1, #818cf8)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #ec4899, #f472b6)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #10b981, #34d399)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #ef4444, #f87171)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #14b8a6, #2dd4bf)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #f97316, #fb923c)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #06b6d4, #22d3ee)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #e11d48, #fb7185)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #7c3aed, #a78bfa)', text: '#fff' },
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

export default function Avatar({ nombre, fotoUrl, avatarId, size = 40, fontSize, className = '', onClick, style: extraStyle }) {
  const px = `${size}px`
  const fs = fontSize || Math.round(size * 0.36)

  // Prioridad: foto real > avatar NFT > iniciales
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nombre || ''}
        onClick={onClick}
        loading="lazy"
        decoding="async"
        className={`rounded-full object-cover shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: px, height: px, minWidth: px, ...extraStyle }}
      />
    )
  }

  // Avatar NFT seleccionado por el usuario
  const nftAvatar = avatarId ? getAvatarById(avatarId) : null
  if (nftAvatar) {
    return (
      <div
        onClick={onClick}
        className={`rounded-full shrink-0 overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: px, height: px, minWidth: px, ...extraStyle }}
        dangerouslySetInnerHTML={{ __html: nftAvatar.svg }}
      />
    )
  }

  const color = getAvatarColor(nombre)
  const iniciales = getIniciales(nombre)

  return (
    <div
      onClick={onClick}
      className={`rounded-full flex items-center justify-center font-bold shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: px,
        height: px,
        minWidth: px,
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
