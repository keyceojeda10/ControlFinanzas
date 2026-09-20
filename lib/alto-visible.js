'use client'
// lib/alto-visible.js — cuánto de la pantalla SE VE de verdad, y desde dónde.
//
// En iPhone, al salir el teclado, la ventana no se encoge: el navegador corre la
// página hacia arriba para enseñar el campo. Un `position: fixed` con `100dvh`
// sigue midiendo la pantalla entera, así que su cabecera se queda fuera por
// arriba. Si además el documento tiene el scroll apagado, no hay forma de
// traerla de vuelta: fue lo que dejó a Lucas sin poder cerrarse.
//
// `visualViewport` sí dice la verdad: qué alto queda visible y cuánto se ha
// corrido. Una caja que se mide con esto siempre cabe en lo que el usuario ve.
import { useEffect, useState } from 'react'

export function useAltoVisible() {
  const [v, setV] = useState({ alto: null, arriba: 0 })
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined
    const medir = () => setV({ alto: Math.round(vv.height), arriba: Math.round(vv.offsetTop) })
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    window.addEventListener('orientationchange', medir)
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
      window.removeEventListener('orientationchange', medir)
    }
  }, [])
  return v
}
