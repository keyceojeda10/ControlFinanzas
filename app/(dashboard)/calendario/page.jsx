'use client'
// app/(dashboard)/calendario/page.jsx — qué día le toca a quién. Ver
// components/pantallas/CalendarioCobros.jsx y lib/calendario-cobros.js.

import { useRouter } from 'next/navigation'
import { useCabecera } from '@/components/armazon/Armazon'
import { useCountry } from '@/hooks/useCountry'
import { useAuth } from '@/hooks/useAuth'
import CalendarioCobros from '@/components/pantallas/CalendarioCobros'

export default function CalendarioPage() {
  useCabecera({ titulo: 'Calendario', subtitulo: 'Qué día le toca a quién' })
  const router = useRouter()
  const { formatMoney } = useCountry()
  const { esCobrador } = useAuth()
  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      <CalendarioCobros formatMoney={formatMoney} esCobrador={esCobrador}
        onIrCliente={(id) => router.push(`/clientes/${id}`)}
        onVerPlanes={() => router.push('/configuracion/plan')} />
    </div>
  )
}
