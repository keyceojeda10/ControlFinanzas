'use client'

import { useState, useEffect } from 'react'

/**
 * ¿Estamos en una pantalla ancha? (por defecto, el corte `lg` de Tailwind)
 *
 * ⚠ LA DETECCIÓN VA EN UN EFECTO, NO EN EL PRIMER RENDER. Leer `matchMedia`
 * al pintar hace que el servidor diga una cosa y el cliente otra, y React tira
 * el árbol entero (el error #418). En este rediseño ya pasó varias veces, y
 * `HojaInferior` lo tenía resuelto con este mismo patrón: esto es ese código
 * sacado a un sitio común, no uno nuevo.
 *
 * Consecuencia de hacerlo bien: el PRIMER render siempre dice `false`, o sea
 * «pantalla estrecha». Lo que dependa de esto tiene que verse decente en móvil
 * durante ese primer render, porque es lo que se pinta antes de hidratar.
 */
export function usePantallaAncha(minimo = 1024) {
  const [ancha, setAncha] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minimo}px)`)
    const leer = () => setAncha(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [minimo])

  return ancha
}

export default usePantallaAncha
