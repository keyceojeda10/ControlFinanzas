// components/ui/Mascota.jsx — wrapper retrocompatible sobre Capi (la capibara).
// La mascota original (moneda con cara) fue reemplazada por Capi.
// Codigo nuevo debe importar Capi directamente de components/ui/Capi.

import Capi from './Capi'

const VARIANT_A_POSE = {
  happy: 'feliz',
  empty: 'duerme',
  celebrate: 'celebra',
  thinking: 'busca',
}

export default function Mascota({ variant = 'happy', size = 120, className = '' }) {
  return <Capi pose={VARIANT_A_POSE[variant] || 'feliz'} size={size} className={`capi-in ${className}`} />
}
