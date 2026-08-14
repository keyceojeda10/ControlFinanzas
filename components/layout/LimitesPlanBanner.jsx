'use client'

// Una línea, con la cifra que duele y nada más.
//
// El bloque anterior traía círculo de icono, dos líneas de texto y un botón
// dorado que competía con la acción de la pantalla — y encima se apilaba con el
// aviso de verificar correo, comiéndose un tercio del teléfono antes de que la
// pantalla empezara.

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import FranjaAviso from '@/components/armazon/FranjaAviso'
import { pedirCompartido } from '@/lib/pedir-compartido'

export default function LimitesPlanBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [uso, setUso] = useState(null)

  const rol = session?.user?.rol
  const orgId = session?.user?.organizationId

  useEffect(() => {
    if (!orgId || rol !== 'owner') return
    let cancelado = false
    // Igual que el banner de suscripción: depende de `pathname` y se repetía en
    // cada navegación.
    pedirCompartido('/api/plan/uso')
      .then((d) => { if (!cancelado && d) setUso(d) })
    return () => { cancelado = true }
  }, [orgId, rol, pathname])

  if (!uso?.excedeAlgo) return null

  const detalles = []
  if (uso.clientes.usado > uso.clientes.limite) detalles.push(`${uso.clientes.usado}/${uso.clientes.limite} clientes`)
  if (uso.rutas.usado > uso.rutas.limite) detalles.push(`${uso.rutas.usado}/${uso.rutas.limite} rutas`)
  if (uso.usuarios.usado > uso.usuarios.limite) detalles.push(`${uso.usuarios.usado}/${uso.usuarios.limite} usuarios`)

  return (
    <FranjaAviso
      accion="Ver planes"
      onAccion={() => router.push('/configuracion/plan')}
      icono={
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      }
    >
      Pasaste el límite de tu plan · {detalles.join(', ')}
    </FranjaAviso>
  )
}
