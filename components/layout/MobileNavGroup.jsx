'use client'

import { useRef } from 'react'
import BottomNav from './BottomNav'
import AsistenteButton from '@/components/asistente/AsistenteButton'

export default function MobileNavGroup() {
  const lucasRef = useRef(null)

  return (
    <>
      <BottomNav onOpenLucas={() => lucasRef.current?.open()} />
      <AsistenteButton ref={lucasRef} />
    </>
  )
}
