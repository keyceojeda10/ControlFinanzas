'use client'

// components/admin/WhatsAppBusiness.jsx — EN EL SUPERADMIN, WHATSAPP ES EL BUSINESS.
//
// El dueño tiene en el teléfono el WhatsApp normal y el Business, y la cuenta
// de Control Finanzas es la del Business (2 nov 2026). `wa.me` abre el que
// Android tenga por defecto —el normal—. «Para atender» ya deja elegir
// (lib/seguimiento/enlace-whatsapp.js); los otros diez paneles —CRM,
// retención, suscripciones, chats del bot…— abrían el normal.
//
// En vez de tocar cada enlace, se escucha aquí, una vez, para todo `/admin`:
// en Android, un toque en un enlace a `wa.me` abre el Business, y si no está
// instalado `S.browser_fallback_url` cae al que haya. En PC no hace nada.
// Va solo en el superadmin: en la app de los negocios cada cobrador escribe
// desde su propio WhatsApp.

import { useEffect } from 'react'
import { enApp, esAndroidNavegador } from '@/lib/seguimiento/enlace-whatsapp'

export default function WhatsAppBusiness() {
  useEffect(() => {
    // También la tableta en «vista de escritorio» (ver `esAndroidNavegador`).
    if (!esAndroidNavegador(navigator)) return undefined
    const alTocar = (e) => {
      if (e.defaultPrevented || e.button !== 0) return
      const a = e.target?.closest?.('a[href^="https://wa.me/"]')
      if (!a) return
      e.preventDefault()
      window.location.href = enApp(a.href, 'business')
    }
    document.addEventListener('click', alTocar)
    return () => document.removeEventListener('click', alTocar)
  }, [])
  return null
}
