'use client'
// components/cobradores/CompartirCredenciales.jsx
// Botonera para compartir las credenciales de un cobrador recien creado
// via WhatsApp, compartir nativo (SMS/email/apps) o copiar al portapapeles.

import { useState } from 'react'

const LOGIN_URL = 'https://app.control-finanzas.com/login'

function buildMensaje({ nombreCobrador, email, password, nombreOwner }) {
  const saludo = nombreCobrador ? `Hola ${nombreCobrador}` : 'Hola'
  const firma = nombreOwner ? `\n\n— ${nombreOwner}` : ''
  return (
    `${saludo}, te han creado una cuenta en *Control Finanzas* para que gestiones los cobros.\n\n` +
    `🔗 Ingresa aqui: ${LOGIN_URL}\n` +
    `📧 Correo: ${email}\n` +
    `🔑 Contrasena: ${password}\n\n` +
    `💡 *Tip:* Abre el link desde tu celular y desde el menu de Chrome/Safari selecciona *"Agregar a pantalla de inicio"* para instalar la app y usarla mas rapido.${firma}`
  )
}

// Normaliza el telefono a formato internacional para wa.me.
// Si solo tiene 10 digitos (CO sin indicativo), le antepone 57.
function normalizarTelefono(tel) {
  if (!tel) return null
  const digits = String(tel).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `57${digits}` // Colombia por defecto
  return digits
}

export default function CompartirCredenciales({ nombreCobrador, email, password, nombreOwner, telefono }) {
  const [copiado, setCopiado] = useState(false)
  const [compartido, setCompartido] = useState(false)

  const mensaje = buildMensaje({ nombreCobrador, email, password, nombreOwner })
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const telNorm = normalizarTelefono(telefono)

  const handleWhatsApp = () => {
    // Si hay telefono, abrir chat directo. Si no, abrir selector de contactos.
    const base = telNorm ? `https://wa.me/${telNorm}` : 'https://wa.me/'
    const url = `${base}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCompartir = async () => {
    if (!hasNativeShare) {
      // Fallback: copiar
      handleCopiar()
      return
    }
    try {
      await navigator.share({
        title: 'Credenciales Control Finanzas',
        text: mensaje,
      })
      setCompartido(true)
      setTimeout(() => setCompartido(false), 2000)
    } catch {
      // Usuario cancelo el dialogo, no hacer nada
    }
  }

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Fallback para navegadores sin Clipboard API
      const ta = document.createElement('textarea')
      ta.value = mensaje
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[#888888] text-left">Enviar credenciales al cobrador</p>

      {/* WhatsApp (primario - es lo que la mayoria usa) */}
      <button
        onClick={handleWhatsApp}
        className="w-full h-11 rounded-[12px] bg-[#25D366] hover:bg-[#1eb855] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        {telNorm ? 'Enviar al WhatsApp del cobrador' : 'Enviar por WhatsApp'}
      </button>

      {/* Fila de 2: Compartir + Copiar */}
      <div className="flex gap-2">
        {hasNativeShare && (
          <button
            onClick={handleCompartir}
            className="flex-1 h-11 rounded-[12px] bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {compartido ? 'Compartido' : 'Compartir'}
          </button>
        )}
        <button
          onClick={handleCopiar}
          className={`${hasNativeShare ? 'flex-1' : 'w-full'} h-11 rounded-[12px] bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copiado ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
