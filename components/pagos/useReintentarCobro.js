'use client'
// components/pagos/useReintentarCobro.js — el botón «Reintentar el cobro», sin la
// pintura: la pantalla de acceso suspendido y «Mi plan» lo visten a su manera.
//
// ⚠ PULSAR NO ES PAGAR. El POST solo MANDA el cobro; Nequi contesta unos
// segundos después, por el webhook. Por eso, tras mandarlo, se pregunta al
// servidor cada cuatro segundos hasta que diga «al día» o «rechazado». Dar por
// bueno el cobro al pulsar sería volver a dejar dentro a quien no pagó.

import { useCallback, useEffect, useRef, useState } from 'react'

const CADA_MS = 4000
const TOPE_MS = 90000

/**
 * @param {{ onPagado?: () => void }} opciones  se llama una vez, con el pago aprobado
 * @returns {{ fase: string, mensaje: string|null, reintentar: () => Promise<void>, esperar: () => void }}
 *   fase: 'quieto' | 'cobrando' | 'pagado' | 'rechazado' | 'espera' | 'error' | 'tarda'
 */
export function useReintentarCobro({ onPagado } = {}) {
  const [fase, setFase] = useState('quieto')
  const [mensaje, setMensaje] = useState(null)
  const sondeo = useRef(null)
  const alPagar = useRef(onPagado)

  useEffect(() => { alPagar.current = onPagado }, [onPagado])
  useEffect(() => () => clearInterval(sondeo.current), [])

  const pagado = useCallback(() => {
    clearInterval(sondeo.current)
    setFase('pagado')
    setMensaje(null)
    alPagar.current?.()
  }, [])

  /* Pregunta hasta que la pasarela conteste. También sirve al abrir la pantalla
     con un cobro ya en camino. */
  const esperar = useCallback(() => {
    clearInterval(sondeo.current)
    setFase('cobrando')
    setMensaje(null)
    const hasta = Date.now() + TOPE_MS
    sondeo.current = setInterval(async () => {
      try {
        const r = await fetch('/api/pagos/wompi/reintentar', { cache: 'no-store' })
        const d = await r.json()
        if (d.alDia) return pagado()
        if (!d.pendiente) {
          clearInterval(sondeo.current)
          setFase(d.rechazo ? 'rechazado' : 'error')
          setMensaje(d.rechazo?.motivo ?? 'El cobro no llegó a salir. Vuelve a intentarlo.')
          return
        }
        if (Date.now() > hasta) {
          clearInterval(sondeo.current)
          setFase('tarda')
          setMensaje('El banco todavía no contesta. Si aprueba, el acceso vuelve solo: revisa en unos minutos.')
        }
      } catch { /* un fallo de red suelto no corta la espera */ }
    }, CADA_MS)
  }, [pagado])

  const reintentar = useCallback(async () => {
    setFase('cobrando')
    setMensaje(null)
    try {
      const r = await fetch('/api/pagos/wompi/reintentar', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setFase('error')
        setMensaje(d.error || 'No se pudo reintentar el cobro.')
        return
      }
      switch (d.resultado) {
        case 'enviado':
        case 'pendiente':
          return esperar()
        case 'aprobado':
        case 'no-hace-falta':
          return pagado()
        case 'rechazado':
          setFase('rechazado')
          setMensaje(d.motivo)
          return
        case 'espera':
          setFase('espera')
          setMensaje(`Lo acabamos de intentar. Espera ${d.segundos ?? 60} segundos antes de volver a probar.`)
          return
        case 'sin-medio':
          setFase('error')
          setMensaje('No hay un medio de pago guardado. Vuelve a guardarlo.')
          return
        case 'sin-plan':
          setFase('error')
          setMensaje('No encontramos qué plan cobrarte. Escríbenos por WhatsApp y lo resolvemos.')
          return
        default:
          setFase('error')
          setMensaje(d.motivo || 'No pudimos contactar la pasarela. Intenta en unos minutos.')
      }
    } catch {
      setFase('error')
      setMensaje('Sin conexión. Revisa tu internet y vuelve a intentarlo.')
    }
  }, [esperar, pagado])

  return { fase, mensaje, reintentar, esperar }
}
