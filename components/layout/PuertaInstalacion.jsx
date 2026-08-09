'use client'
// components/layout/PuertaInstalacion.jsx — para poder ENLAZAR la guía de
// instalación desde cualquier sitio.
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// «Si la gente pone “instalar aplicación” en el buscador, no le sale nada.
// Entonces toca enviarles capturas de pantalla de cómo se hace.»
//
// Y lo llamativo es que la guía **ya existe y es buena**: `InstallGuideModal`
// detecta dispositivo y navegador y da los pasos exactos para **once**
// combinaciones. Lo que no tenía era **puerta**: ni URL, ni entrada de menú, ni
// presencia en el buscador. Sus cuatro accesos son una franja que se
// auto-descarta siete días, la campana, un rincón de Configuración y el
// onboarding — todos por estado local de React, ninguno enlazable.
//
// Esto le pone un timbre global. Es el mismo patrón que ya conecta la lupa de
// la cabecera con el buscador (`cf:abrir-buscador`): viven en ramas distintas
// del árbol y se hablan por un evento, no por props.
//
// ⚠ Si la app ya está instalada no se abre nada: enseñarle a instalar a quien
// ya la tiene instalada es de las cosas que hacen dudar de si el sistema sabe
// dónde está uno.

import { useEffect, useState } from 'react'
import { isStandalone, InstallGuideModal } from '@/components/layout/InstallButton'

export const EVENTO_INSTALAR = 'cf:abrir-instalacion'

export default function PuertaInstalacion() {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    const abrir = () => { if (!isStandalone()) setAbierta(true) }
    window.addEventListener(EVENTO_INSTALAR, abrir)
    return () => window.removeEventListener(EVENTO_INSTALAR, abrir)
  }, [])

  if (!abierta) return null
  return <InstallGuideModal onClose={() => setAbierta(false)} />
}
