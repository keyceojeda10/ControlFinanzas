'use client'

// app/(dashboard)/mas/page.jsx — el quinto destino de la pastilla.
//
// Existía como componente y NO como ruta, así que el quinto botón de la barra
// inferior llevaba a un 404. Era el único enlace roto de los cinco, y el que
// bloqueaba poder desplegar el armazón.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PantallaMas from '@/components/pantallas/PantallaMas'
import { adaptarMas } from '@/lib/adaptadores/mas'

export default function Mas() {
  const router = useRouter()
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/mas')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setDatos(d) })
      // Sin cifras la pantalla SIGUE sirviendo como menú. Es peor no poder
      // navegar que navegar sin los números.
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  return (
    // El contenido pasa por debajo de la pastilla; el hueco final lo reserva
    // cada pantalla, no el layout.
    <div style={{ paddingBottom: 96 }}>
      <PantallaMas {...adaptarMas(datos)} onIr={(destino) => router.push(destino)} />
    </div>
  )
}
