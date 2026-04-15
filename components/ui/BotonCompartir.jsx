// components/ui/BotonCompartir.jsx
// Botón para compartir comprobante de pago via API nativa o copiar al portapapeles.
'use client'

import { useState } from 'react'
import { generarTextoComprobante, generarTextoHistorialCredito } from '@/lib/whatsapp'

const SHARE_ICON = (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
)

export default function BotonCompartir({ tipo = 'pago', cliente, prestamo, pago }) {
  const [copiado, setCopiado] = useState(false)

  const handleClick = async () => {
    const texto = tipo === 'historial'
      ? generarTextoHistorialCredito(cliente, prestamo)
      : generarTextoComprobante(cliente, prestamo, pago)

    if (navigator.share) {
      try {
        await navigator.share({ text: texto })
      } catch {
        // Usuario canceló el diálogo — no hacer nada
      }
      return
    }

    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin soporte de clipboard
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 h-10 rounded-[12px] text-sm font-medium transition-all duration-150 cursor-pointer bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#444]"
    >
      {SHARE_ICON}
      {copiado ? 'Copiado' : (tipo === 'historial' ? 'Compartir historial' : 'Compartir')}
    </button>
  )
}
