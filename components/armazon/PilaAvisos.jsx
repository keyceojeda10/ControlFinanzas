'use client'

// components/armazon/PilaAvisos.jsx — «01 · Un solo aviso arriba».
//
// La regla del diseñador, literal: «una sola franja de aviso, la de mayor
// prioridad, y el resto a la campana. El orden lo decide EL DINERO EN JUEGO, no
// el negocio de la app… Hoy los cuatro se apilan y empujan el patrimonio fuera
// de la pantalla; lo primero que ve el dueño al abrir es que le van a cobrar la
// suscripción.»
//
// CÓMO, SIN REESCRIBIR LOS CUATRO AVISOS. Cada uno ya sabe si le toca: si no
// aplica devuelve null. En vez de darles la vuelta —abrir cuatro archivos con
// sus fetch y sus aplazamientos—, cada uno se envuelve en una <Ranura> que
// MIRA SI PINTÓ ALGO y se apunta. La pila decide quién gana y esconde al resto.
//
// Se esconden con `display:none` en lugar de desmontarlos a propósito: si se
// desmontan, sus peticiones y sus temporizadores se cancelan y vuelven a
// arrancar en cuanto el ganador desaparece. Escondido, el estado se queda
// quieto y el relevo es instantáneo.

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ordenarAvisos } from '@/lib/adaptadores/avisos'

const Ctx = createContext(null)

export function Ranura({ id, children }) {
  const pila = useContext(Ctx)
  const ref = useRef(null)
  const clave = useId()

  // Se mide DESPUÉS de pintar: es la única forma de saber si el aviso decidió
  // que le tocaba, sin duplicar aquí su lógica —que es justamente la que no
  // queremos copiar en dos sitios.
  useEffect(() => {
    if (!pila) return
    const tiene = () => Boolean(ref.current && ref.current.childElementCount > 0)
    pila.registrar(clave, id, tiene())
    // Los avisos llegan por fetch, así que pueden aparecer tarde.
    const obs = new MutationObserver(() => pila.registrar(clave, id, tiene()))
    if (ref.current) obs.observe(ref.current, { childList: true, subtree: true })
    return () => { obs.disconnect(); pila.olvidar(clave) }
  }, [pila, clave, id])

  const gana = pila?.ganador === clave
  return (
    <div ref={ref} style={gana ? undefined : { display: 'none' }} data-aviso={id}>
      {children}
    </div>
  )
}

export default function PilaAvisos({ children, onVerTodos }) {
  const [vivos, setVivos] = useState({})

  const api = useMemo(() => ({
    registrar: (clave, id, aplica) => setVivos((p) => (
      (p[clave]?.aplica === aplica && p[clave]?.id === id) ? p : { ...p, [clave]: { id, aplica } }
    )),
    olvidar: (clave) => setVivos((p) => {
      if (!(clave in p)) return p
      const { [clave]: _, ...resto } = p
      return resto
    }),
  }), [])

  const { ganadorClave, textoResto } = useMemo(() => {
    const lista = Object.entries(vivos)
      .filter(([, v]) => v.aplica)
      .map(([clave, v]) => ({ clave, id: v.id }))
    const { principal, textoResto } = ordenarAvisos(lista)
    return { ganadorClave: principal?.clave ?? null, textoResto }
  }, [vivos])

  const valor = useMemo(() => ({ ...api, ganador: ganadorClave }), [api, ganadorClave])

  return (
    <Ctx.Provider value={valor}>
      {children}
      {/* «Hay 2 avisos más de la app» — CON el número. Un «ver todo» sin cifra
          no se toca: sin saber cuántos son, nadie abre la campana. */}
      {textoResto && (
        <button
          type="button"
          onClick={onVerTodos}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, width: '100%', minHeight: 34, padding: '0 var(--cf-pad-screen)',
            background: 'var(--cf-fill)', border: 0,
            borderBottom: '1px solid var(--cf-border)',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{textoResto}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)' }}>Ver</span>
        </button>
      )}
    </Ctx.Provider>
  )
}
