'use client'

// app/(portal)/portal/login/page.jsx — T04-06 entrar al portal.
//
// ══ ES LA PANTALLA QUE VE ALGUIEN QUE NO ES CLIENTE NUESTRO ════════════════
//
// El deudor no eligió esta app, no la instaló y no confía del todo en quien le
// pasó el enlace. `PortalAcceso` está construido con esa idea: la promesa de
// privacidad va escrita, el PIN son cuatro casillas grandes, y no se pide
// registrarse ni descargar nada.
//
// LO QUE NO CAMBIA DEL BACKEND: `/api/portal/auth` acepta cédula O teléfono como
// `identificador`, y el PIN como cadena. La lámina dibuja «Cédula»; el enlace
// puede llegarle a alguien que no sabe con cuál lo registraron, así que la ayuda
// lo dice.

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PortalAcceso } from '@/components/pantallas/PortalCliente'
import { pinCompleto } from '@/lib/adaptadores/portal'

function Acceso() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org') || ''

  const [identificador, setIdentificador] = useState('')
  const [pin, setPin] = useState([])
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)

  const entrar = async () => {
    if (!identificador.trim() || !pinCompleto(pin)) {
      setError('Escribe tu documento y los cuatro dígitos del PIN.')
      return
    }
    if (!orgId) {
      setError('Este enlace no es válido. Pídele uno nuevo a quien te prestó.')
      return
    }
    setError('')
    setEntrando(true)
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: identificador.trim(),
          pin: pin.join(''),
          organizationId: orgId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'No pudimos entrar. Revisa el documento y el PIN.')
        return
      }
      router.push('/portal')
    } catch {
      setError('No hay conexión. Intenta de nuevo.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex' }}>
        <PortalAcceso
          rotuloCedula="Documento o teléfono"
          ayuda="Con tu documento y el PIN que te dio quien te prestó. No necesitas descargar nada ni crear una cuenta."
          cedula={identificador}
          onCedula={setIdentificador}
          pin={pin}
          onPin={setPin}
          error={error}
          onEntrar={entrar}
          entrando={entrando}
          // No hay recuperación automática: el cliente no tiene cuenta ni correo.
          // Se le pide a quien presta, que es quien lo puso.
          onPedirPin={() => router.push(`/portal/recuperar${orgId ? `?org=${orgId}` : ''}`)}
        />
      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <Acceso />
    </Suspense>
  )
}
