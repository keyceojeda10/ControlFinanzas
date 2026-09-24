'use client'
/* «Viendo como Juan · solo lectura · Volver a mi cuenta». En el armazón, junto
   a <AvisoSinSenal />: sin dorado, en tinta, para que no se confunda con una
   acción de plata. No toca la barra de navegación (la pill).

   SIN `position: sticky/fixed`, a propósito, como AvisoSinSenal (revisado: esa
   franja tampoco lo usa). El armazón ya tiene un header móvil pegado arriba
   (CabeceraMovil, `position: sticky; top: 0; zIndex: 40`) que vive ANTES que
   esta franja en el mismo contenedor de scroll: si esta también fuera sticky a
   top:0, las dos pelearían por la misma fila del viewport y, con un z-index
   más alto, esta le pintaría encima a la cabecera. En flujo normal, como
   AvisoSinSenal, ya queda por encima del contenido por orden del DOM, y
   por debajo de cualquier Hoja (position: fixed, zIndex 60) sin competir en
   z-index.

   A LA HORA vuelve sola. El servidor ya lo hace en el callback `jwt`, pero la
   cookie solo se reescribe al pedir /api/auth/session, y el SessionProvider no
   la pide nunca por su cuenta (arranca con la sesión guardada). Aquí se pide
   al cumplirse la hora, y SOLO se sale si la sesión nueva ya no está en vista.
   Si el servidor no pudo volver (sin red, dueño desactivado) no se hace nada:
   la franja se queda, y sin bucle de recargas. */
import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { marcarSoloLectura } from '@/lib/modo-vista'
import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'

async function salir(cobradorId) {
  marcarSoloLectura(false)
  await olvidarLecturasDeOtraCuenta()
  window.location.href = `/cobradores/${cobradorId}`
}

// Pedir la sesión reescribe la cookie; pasada la hora, ya es la del dueño.
async function volverSiYaVencio(cobradorId) {
  try {
    const nueva = await fetch('/api/auth/session').then((r) => r.json())
    if (nueva?.user && !nueva.user.soloLectura) return salir(cobradorId)
  } catch {}
  return false
}

export default function FranjaVerComo() {
  const { data: session } = useSession()
  const [volviendo, setVolviendo] = useState(false)
  const [error, setError] = useState('')
  const enVista = !!session?.user?.soloLectura
  const cobradorId = session?.user?.id
  const vistaHasta = session?.user?.vistaHasta

  useEffect(() => {
    if (!enVista || !vistaHasta) return
    const t = setTimeout(() => { volverSiYaVencio(cobradorId) }, Math.max(0, vistaHasta - Date.now()) + 1000)
    return () => clearTimeout(t)
  }, [enVista, vistaHasta, cobradorId])

  if (!enVista) return null

  async function volver() {
    setVolviendo(true); setError('')
    try {
      const res = await fetch('/api/ver-como/volver', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        const r = await signIn('pase', { pase: d.pase, redirect: false })
        if (!r?.error) return salir(d.cobradorId)
      } else if (await volverSiYaVencio(cobradorId) !== false) {
        return // la hora ya había pasado: el servidor volvió solo
      }
    } catch {}
    setVolviendo(false)
    setError('No se pudo volver. Revisa la conexión e intenta otra vez.')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5"
      style={{ flex: 'none', background: 'var(--cf-ink)', color: 'var(--cf-card)' }}>
      <span className="text-[13px] min-w-0">
        Viendo como <strong className="break-words">{session.user.nombre}</strong> · solo lectura
      </span>
      <button type="button" onClick={volver} disabled={volviendo} className="text-[13px] font-bold shrink-0"
        style={{ background: 'var(--cf-card)', color: 'var(--cf-ink)', border: 0, borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}>
        {volviendo ? 'Volviendo…' : 'Volver a mi cuenta'}
      </button>
      {error && <span className="w-full text-[12px]">{error}</span>}
    </div>
  )
}
