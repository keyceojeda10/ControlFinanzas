'use client'
// components/layout/PuertaInstalacion.jsx — EL timbre para instalar la app, desde
// cualquier sitio.
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// «Si la gente pone “instalar aplicación” en el buscador, no le sale nada.
// Entonces toca enviarles capturas de pantalla de cómo se hace.»
//
// La guía existía y no tenía puerta: ni URL, ni entrada de menú, ni presencia
// en el buscador. Esto le pone un timbre global, el mismo patrón que conecta la
// lupa de la cabecera con el buscador (`cf:abrir-buscador`).
//
// ══ DE UN TOQUE (19 oct 2026) ══════════════════════════════════════════════
// «Que sea de un solo toque. Muchas personas no consiguen con las instrucciones
// dónde está.» Si el navegador ya avisó de que se puede instalar
// (`window.__cfInstalar`, oído en el <head>: lib/instalar.js), el timbre abre
// SU ventana «¿Instalar?» y nada más. Solo si no se puede va la guía del camino
// que toque: saltar a Chrome, la flecha del iPhone o los pasos.
//
// ⚠ EL TIMBRE SE TOCA DENTRO DEL TOQUE. `prompt()` exige que venga de un gesto:
// `dispatchEvent` es síncrono, así que el oyente corre dentro del mismo toque.
//
// ⚠ Si la app ya está instalada no se abre nada: enseñarle a instalar a quien
// ya la tiene instalada hace dudar de si el sistema sabe dónde está uno.
import { useEffect, useState } from 'react'
import { isStandalone, InstallGuideModal } from '@/components/layout/InstallButton'
import GuiaInstalar from '@/components/layout/GuiaInstalar'
import { detectar, caminoInstalar } from '@/lib/instalar'

export const EVENTO_INSTALAR = 'cf:abrir-instalacion'

/** Toca el timbre. `origen`: de dónde (más, configuración, campana, /instalar…). */
export function pedirInstalar(origen) {
  window.dispatchEvent(new CustomEvent(EVENTO_INSTALAR, { detail: { origen } }))
}

// Cuántos llegan a instalarla y por qué camino: para saber si esto mejoró.
function medir(evento, metadata) {
  fetch('/api/analytics/track', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, pagina: window.location.pathname, metadata }),
  }).catch(() => {})
}

export default function PuertaInstalacion() {
  const [camino, setCamino] = useState(null)

  useEffect(() => {
    const abrir = (e) => {
      if (isStandalone()) return
      const det = detectar(navigator.userAgent)
      const aviso = window.__cfInstalar
      const elegido = caminoInstalar(det, { hayToque: Boolean(aviso) })
      const origen = e?.detail?.origen ?? window.location.pathname
      medir('instalar_abierto', { camino: elegido, origen, ...det })
      if (elegido === 'un-toque') {
        // El aviso sirve una vez: el navegador manda otro si hace falta.
        window.__cfInstalar = null
        aviso.prompt()
        aviso.userChoice
          ?.then(({ outcome }) => medir(outcome === 'accepted' ? 'instalar_aceptada' : 'instalar_rechazada', { origen, ...det }))
          .catch(() => {})
        return
      }
      setCamino(elegido)
    }
    const instalada = () => { setCamino(null); medir('instalada', detectar(navigator.userAgent)) }
    window.addEventListener(EVENTO_INSTALAR, abrir)
    window.addEventListener('cf:instalada', instalada)
    return () => {
      window.removeEventListener(EVENTO_INSTALAR, abrir)
      window.removeEventListener('cf:instalada', instalada)
    }
  }, [])

  if (!camino) return null
  if (camino === 'pasos') return <InstallGuideModal onClose={() => setCamino(null)} />
  return <GuiaInstalar camino={camino} onCerrar={() => setCamino(null)} />
}
