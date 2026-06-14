'use client'

import { useRef, useState, useCallback } from 'react'
import BottomNav from './BottomNav'
import AsistenteButton from '@/components/asistente/AsistenteButton'

export default function MobileNavGroup() {
  const lucasRef = useRef(null)
  const [lucasOpen, setLucasOpen] = useState(false)

  // useCallback para no recrear la funcion en cada render (el effect de
  // AsistenteButton depende de ella).
  const handleLucasChange = useCallback((open) => setLucasOpen(open), [])

  return (
    <>
      <BottomNav onOpenLucas={() => lucasRef.current?.open()} lucasOpen={lucasOpen} />
      <AsistenteButton ref={lucasRef} onOpenChange={handleLucasChange} />
    </>
  )
}
