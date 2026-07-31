'use client'

// components/armazon/AvisoSinSenal.jsx — T05-05 «Sin conexión».
//
// LA FRANJA QUE FALTABA. La app YA trabaja sin red —guarda los cobros en el
// teléfono y los sube después, y eso está probado— pero no lo DECÍA en ningún
// sitio que el cobrador vea desde el móvil. El único indicador vive en la barra
// lateral, que en un teléfono ni existe.
//
// El efecto de no decirlo es el peor posible en la calle: se registra un cobro,
// no pasa nada visible, y el cobrador vuelve a registrarlo. O peor: deja de
// cobrar creyendo que la app está rota.
//
// La franja va sobre todo lo demás, en carbón, con el punto dorado y el
// «Reintentar» de la lámina.

import { useOffline } from '@/components/providers/OfflineProvider'
import { FranjaSinSenal } from '@/components/pantallas/Estados'

export default function AvisoSinSenal() {
  const { isOnline, pendingCount } = useOffline()
  if (isOnline) return null

  return (
    <FranjaSinSenal
      // Con cobros guardados se dice CUÁNTOS: «no se ha perdido nada» es una
      // promesa, y una promesa con número se cree.
      texto={pendingCount > 0
        ? `Sin señal · ${pendingCount} ${pendingCount === 1 ? 'cobro guardado' : 'cobros guardados'} en el teléfono`
        : 'Sin señal · trabajando en el teléfono'}
      onReintentar={() => window.location.reload()}
    />
  )
}
