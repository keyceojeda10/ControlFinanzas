'use client'
// components/acciones/AccionesProvider.jsx — el punto de encuentro.
//
// ══ ⚠ POR QUÉ LAS ACCIONES SE REGISTRAN Y NO SE DECLARAN EN UNA LISTA ══════
//
// Las acciones del préstamo NO son enlaces: abren modales y hojas que viven en
// el estado de `app/(dashboard)/prestamos/[id]/page.jsx`. Desde fuera nadie
// puede ejecutarlas. Así que cada pantalla APUNTA las suyas al montarse, con su
// `ejecutar` ya cerrado sobre su propio estado; el buscador solo las lee y las
// dispara.
//
// Es el mismo patrón del cable `cf:abrir-buscador` que ya conecta la lupa de la
// cabecera con el buscador: viven en ramas distintas del árbol y se hablan por
// un punto de encuentro, no pasándose props por diez niveles.
//
// La lógica de emparejado está en `lib/acciones/registro.js`, sin React, para
// que se pueda probar frase a frase.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const Contexto = createContext(null)

/** Va en el armazón del panel, envolviendo todas las pantallas. */
export function AccionesProvider({ children }) {
  const [porPantalla, setPorPantalla] = useState({})

  /* `useCallback` sin dependencias: `registrar` tiene que ser ESTABLE, porque
     es una dependencia del efecto que registra. Si cambiara en cada render, el
     efecto se desmontaría y volvería a montar sin parar. */
  const registrar = useCallback((clave, lista) => {
    setPorPantalla((prev) => ({ ...prev, [clave]: lista }))
    return () => setPorPantalla((prev) => {
      const copia = { ...prev }
      delete copia[clave]
      return copia
    })
  }, [])

  const valor = useMemo(
    () => ({ acciones: Object.values(porPantalla).flat(), registrar }),
    [porPantalla, registrar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/**
 * Lo que leen el buscador y la caja de la sección.
 *
 * ⚠ Devuelve `[]` si no hay proveedor en vez de reventar: el buscador se monta
 * en el armazón del panel, pero estos componentes también se usan en el banco
 * de pruebas (`/estilo`) y en pantallas sueltas.
 */
export function useAcciones() {
  return useContext(Contexto)?.acciones ?? []
}

/**
 * Lo que llama cada pantalla.
 *
 *   useRegistrarAcciones('prestamo', [
 *     { id: 'renovar', label: 'Renovar el préstamo',
 *       sinonimos: ['renovar', 'volver a prestar', 'refinanciar'],
 *       disponible: puedeGestionar && activo,
 *       ejecutar: () => { abrirGestion(); abrirRenovar() } },
 *   ])
 *
 * ⚠ La lista se guarda en una `ref` y el efecto solo depende de su FIRMA —los
 * ids y su disponibilidad—, no del array. Si dependiera del array, que se crea
 * nuevo en cada render, esto se registraría en bucle infinito. Y guardando la
 * última en la ref, `ejecutar` siempre ve el estado de ahora, no el del primer
 * render, que es el fallo clásico de cerrar sobre el estado viejo.
 */
export function useRegistrarAcciones(clave, lista) {
  const ctx = useContext(Contexto)
  const ultima = useRef(lista)
  ultima.current = lista

  const firma = (lista || [])
    .map((a) => `${a.id}:${a.disponible === false ? 0 : 1}`)
    .join('|')

  useEffect(() => {
    if (!ctx) return undefined
    // Se envuelve para que el buscador llame SIEMPRE a la versión de ahora.
    const envueltas = (ultima.current || []).map((a) => ({
      ...a,
      ejecutar: (...args) => {
        const viva = (ultima.current || []).find((x) => x.id === a.id)
        return (viva?.ejecutar ?? a.ejecutar)?.(...args)
      },
    }))
    return ctx.registrar(clave, envueltas)
  }, [ctx, clave, firma])
}
