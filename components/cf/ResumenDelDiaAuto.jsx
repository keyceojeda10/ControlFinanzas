'use client'
// components/cf/ResumenDelDiaAuto.jsx — el que hace SALIR el resumen.
//
// Vive en el armazón, una sola vez. Cada minuto mira si ya es la hora que el
// dueño eligió (la misma de la notificación: Notificaciones → «El resumen del
// día») y, si toca, saca el pop-up. También lo abre a petición: cualquiera puede
// lanzar `window.dispatchEvent(new Event('cf:ver-resumen-del-dia'))`.
//
//   · Una vez al día: visto hoy, no vuelve hasta mañana.
//   · «Todavía no termino» lo calla UNA HORA, no todo el día.
//   · Un día sin plata movida no interrumpe a nadie (igual que la notificación).
//   · Solo el dueño: a un cobrador no se le enseña la ganancia del negocio.
//
// Antes de las cinco de la tarde ni pregunta al servidor: la hora más temprana
// que se puede elegir es las 5 p. m.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCountry } from '@/hooks/useCountry'
import { ResumenDelDia, AvisoResumen } from '@/components/cf/ResumenDelDia'
import { armarResumen, tocaOfrecerlo, fechaLocal, POSPONER_MS, CLAVE_VISTO, CLAVE_POSPUESTO } from '@/lib/resumen-del-dia'
import { HORAS_RESUMEN, normalizarPrefs } from '@/lib/avisos-preferencias'

const PRIMERA_HORA = Math.min(...HORAS_RESUMEN)
const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

export default function ResumenDelDiaAuto() {
  const { rol, session } = useAuth()
  const { formatMoney } = useCountry()
  const router = useRouter()
  const [resumen, setResumen] = useState(null)
  const [fase, setFase] = useState(null)          // null | 'aviso' | 'pantalla'
  const horaRef = useRef(undefined)               // undefined = aún no se ha leído
  const ocupado = useRef(false)

  const traer = useCallback(async () => {
    // `?detalle=1`: las listas detrás de cada cifra (quién pagó, quién no, mañana).
    const d = await fetch('/api/dashboard/resumen?detalle=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    return d ? armarResumen(d, { nombre: session?.user?.name ?? '' }) : null
  }, [session?.user?.name])

  const revisar = useCallback(async () => {
    if (rol !== 'owner' || ocupado.current || fase) return
    const ahora = new Date()
    if (ahora.getHours() < PRIMERA_HORA) return
    if (leer(CLAVE_VISTO) === fechaLocal(ahora)) return
    ocupado.current = true
    try {
      if (horaRef.current === undefined) {
        const p = await fetch('/api/notificaciones/preferencias', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (!p) return                               // sin red: se reintenta al minuto
        horaRef.current = normalizarPrefs(p.prefs).resumenHora
      }
      if (!tocaOfrecerlo({ hora: horaRef.current, ahora, visto: leer(CLAVE_VISTO), pospuestoHasta: Number(leer(CLAVE_POSPUESTO) || 0) })) return
      const r = await traer()
      if (!r) return
      // Un día sin movimiento no merece un pop-up: se da por visto y ya.
      if (r.cobrado === 0 && r.prestado === 0 && r.gastos === 0) { guardar(CLAVE_VISTO, fechaLocal(ahora)); return }
      setResumen(r); setFase('aviso')
    } finally { ocupado.current = false }
  }, [rol, fase, traer])

  useEffect(() => {
    if (rol !== 'owner') return undefined
    const primero = setTimeout(revisar, 4000)       // que cargue la pantalla primero
    const cada = setInterval(revisar, 60_000)
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearTimeout(primero); clearInterval(cada); document.removeEventListener('visibilitychange', alVolver) }
  }, [rol, revisar])

  // A petición: desde Notificaciones o desde el aviso de la campana.
  useEffect(() => {
    const abrir = async () => {
      const r = await traer()
      if (r) { setResumen(r); setFase('pantalla') }
    }
    window.addEventListener('cf:ver-resumen-del-dia', abrir)
    // La notificación del resumen lleva a `/dashboard?resumen=1`.
    try { if (new URLSearchParams(window.location.search).get('resumen') === '1') abrir() } catch {}
    return () => window.removeEventListener('cf:ver-resumen-del-dia', abrir)
  }, [traer])

  if (!resumen || !fase) return null
  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const formatear = (n) => formatMoney(Math.round(n || 0))

  if (fase === 'aviso') {
    return (
      <AvisoResumen
        r={resumen} formatear={formatear}
        onVer={() => { guardar(CLAVE_VISTO, fechaLocal()); setFase('pantalla') }}
        onLuego={() => { guardar(CLAVE_POSPUESTO, String(Date.now() + POSPONER_MS)); setFase(null); setResumen(null) }}
      />
    )
  }
  return (
    <ResumenDelDia
      r={resumen} formatear={formatear} fecha={fecha}
      onCerrar={() => { guardar(CLAVE_VISTO, fechaLocal()); setFase(null); setResumen(null) }}
      // Tocar a un cliente o un préstamo de una lista: se cierra y se va allí.
      onIr={(href) => { guardar(CLAVE_VISTO, fechaLocal()); setFase(null); setResumen(null); router.push(href) }}
    />
  )
}
