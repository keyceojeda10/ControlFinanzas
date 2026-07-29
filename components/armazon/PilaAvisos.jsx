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
import CosasPorResolver from '@/components/armazon/CosasPorResolver'

// El contenido de cada aviso EN LA HOJA. La franja de arriba es una línea; aquí
// cada uno se explica y trae su acción.
//
// ⚠ Los datos concretos —el correo, el precio, la fecha de vencimiento— viven
// dentro de cada componente de aviso y todavía no llegan hasta aquí. El diseño
// pide «Pagar $39.000» con el precio puesto; hasta que se plumbee, el botón
// lleva al sitio donde sí está la cifra.
const CONTENIDO = {
  suscripcion: {
    titulo: 'Tu plan está por vencerse',
    nota: 'Si se vence sigues cobrando y registrando pagos normal. Lo que se bloquea es crear préstamos nuevos.',
    accion: 'Ver mi plan', destino: '/configuracion/plan',
    secundaria: 'Ver planes', destinoSecundario: '/configuracion/plan',
  },
  limitePlan: {
    titulo: 'Pasaste el límite de tu plan',
    nota: 'Puedes seguir cobrando y registrando pagos. Lo que se bloquea es crear cosas nuevas.',
    accion: 'Ver planes', destino: '/configuracion/plan',
  },
  verificarCorreo: {
    titulo: 'Falta confirmar tu correo',
    nota: 'Sirve para recuperar la cuenta si pierdes el teléfono.',
    accion: 'Confirmar', destino: '/configuracion',
  },
  sinRuta: {
    titulo: 'No tienes una ruta asignada',
    nota: 'Sin ruta no te aparecen clientes para cobrar hoy.',
    accion: 'Ver rutas', destino: '/rutas',
  },
}

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
  const [hoja, setHoja] = useState(false)

  // La campana vive en otro punto del árbol —la cabecera y la barra lateral son
  // hermanas de la pila, no hijas— y el layout es Server Component, así que no
  // puede sostener el estado compartido. Un evento del navegador cruza el árbol
  // sin montar un contexto por encima de todo. Es un canal global, con lo que
  // eso tiene de flojo; a cambio, no obliga a envolver el layout entero.
  useEffect(() => {
    const abrir = () => setHoja(true)
    window.addEventListener('cf:abrir-avisos', abrir)
    return () => window.removeEventListener('cf:abrir-avisos', abrir)
  }, [])

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

  const { ganadorClave, textoResto, perdedores } = useMemo(() => {
    const lista = Object.entries(vivos)
      .filter(([, v]) => v.aplica)
      .map(([clave, v]) => ({ clave, id: v.id }))
    const { principal, resto, textoResto } = ordenarAvisos(lista)
    return { ganadorClave: principal?.clave ?? null, textoResto, perdedores: resto }
  }, [vivos])

  const valor = useMemo(() => ({ ...api, ganador: ganadorClave }), [api, ganadorClave])

  // La campana lleva EL NÚMERO (lámina T39-01), y quien lo sabe es esta pila:
  // es la única que ve cuántos avisos aplican. La cabecera y la barra lateral
  // son hermanas suyas en el árbol, no hijas, así que se publica por el mismo
  // canal por el que ellas piden abrir la hoja.
  const cuantos = Object.values(vivos).filter((v) => v.aplica).length
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cf:avisos', { detail: cuantos }))
  }, [cuantos])

  return (
    <Ctx.Provider value={valor}>
      {children}
      {/* «Hay 2 avisos más de la app» — CON el número. Un «ver todo» sin cifra
          no se toca: sin saber cuántos son, nadie abre la campana. */}
      {textoResto && (
        <button
          type="button"
          onClick={() => { setHoja(true); onVerTodos?.() }}
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

      <CosasPorResolver
        abierta={hoja}
        onCerrar={() => setHoja(false)}
        items={perdedores.map((p) => {
          const c = CONTENIDO[p.id]
          if (!c) return null
          return {
            id: p.id, titulo: c.titulo, nota: c.nota, accion: c.accion,
            onAccion: () => { window.location.href = c.destino },
            secundaria: c.secundaria,
            onSecundaria: c.destinoSecundario ? () => { window.location.href = c.destinoSecundario } : undefined,
          }
        }).filter(Boolean)}
      />
    </Ctx.Provider>
  )
}
