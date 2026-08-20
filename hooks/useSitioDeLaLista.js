'use client'

import { useCallback, useEffect, useRef } from 'react'
import { guardarSitio, tomarSitio, volverAlSitio, marcarVuelta } from '@/lib/sitio-de-la-lista'

/* Engancha una lista al guardado de sitio de `lib/sitio-de-la-lista`.
   Devuelve la función que hay que llamar JUSTO ANTES de salir de la pantalla,
   con el id de la fila desde la que se sale.

   - `clave`: una por pantalla. Dos listas distintas no comparten sitio.
   - `listo`: cuándo están pintadas las filas. Antes de eso no hay a dónde ir.
   - `ancla`: id → id del elemento en el DOM. Declárala FUERA del componente:
     si se pasa en línea cambia de identidad en cada pintada y el efecto se
     vuelve a montar. Aunque cambie no hay daño —`yaVolvio` corta a la primera
     vuelta buena—, pero es trabajo de balde en la pantalla del cobro. */
export function useSitioDeLaLista({ clave, listo, ancla }) {
  const yaVolvio = useRef(false)
  const quitarMarca = useRef(null)

  useEffect(() => () => quitarMarca.current?.(), [])

  useEffect(() => {
    if (!listo || yaVolvio.current) return
    yaVolvio.current = true

    const sitio = tomarSitio(clave)
    if (!sitio) return

    /* DOS CUADROS, no uno. En el primero React ya pintó las filas pero el
       navegador todavía no les ha dado altura: la lista mide lo que mide el
       esqueleto y el desplazamiento se queda corto. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = volverAlSitio(sitio, { ancla })
      if (el) quitarMarca.current = marcarVuelta(el)
    }))
  }, [listo, clave, ancla])

  return useCallback((itemId) => guardarSitio(clave, itemId), [clave])
}

export default useSitioDeLaLista
