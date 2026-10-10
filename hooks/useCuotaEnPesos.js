'use client'
/* La cuota (o el interés del abierto) escrita en pesos, y la tasa que la da.
 * Una sola pieza para todos los formularios que piden la tasa de un préstamo:
 * nuevo, renovar, corregir, simulador y el asistente del primer préstamo. Si
 * cada uno llevara su copia, el día que se arregle una se queda la otra. Ver
 * `lib/dinero/interes-en-pesos.js`.
 *
 * `calcular(t)` TIENE que ser estable (useCallback, sin la tasa en sus
 * dependencias): es lo que se le pregunta al buscador, y si cambiara en cada
 * render el efecto se dispararía sin parar. */
import { useState, useEffect, useCallback } from 'react'
import { tasaParaInteres, tasaParaCuota, interesDelPeriodo } from '@/lib/dinero/interes-en-pesos'

const mismaBusqueda = (a, b) => a === b || (!!a && !!b
  && a.imposible === b.imposible && a.tasa === b.tasa && a.cuota === b.cuota && a.exacta === b.exacta)

export function useCuotaEnPesos({ calcular, monto, modo, abierto = false, tasa, setTasa, habilitado, listo = true, cuotaActual = 0 }) {
  const [enPesos, setEnPesos] = useState(false)
  const [cuota, setCuota] = useState('')
  const [buscada, setBuscada] = useState(null)

  useEffect(() => {
    if (!enPesos || !habilitado) return
    if (abierto) {
      const t = tasaParaInteres(monto, cuota)
      if (t != null) setTasa(String(t))
      setBuscada(null)
      return
    }
    if (!listo || !(Number(monto) > 0) || !(Number(cuota) > 0)) return
    const r = tasaParaCuota(calcular, cuota, { monto, modo })
    const nueva = r ?? { imposible: true }
    setBuscada((prev) => (mismaBusqueda(prev, nueva) ? prev : nueva))
    if (r) setTasa(String(r.tasa))
  }, [enPesos, habilitado, abierto, monto, cuota, calcular, modo, listo, setTasa])

  /* Si deja de poderse (cambió a lineal, o puso su propia cuota), vuelve al
     porcentaje sin la cola de decimales: el campo de % no enseña 11.3333333. */
  useEffect(() => {
    if (habilitado || !enPesos) return
    setEnPesos(false)
    setTasa((t) => String(Math.round(Number(t) * 100) / 100))
  }, [habilitado, enPesos, setTasa])

  const elegir = useCallback((pesos) => {
    if (pesos === enPesos) return
    if (pesos) {
      const actual = abierto ? interesDelPeriodo(monto, tasa) : Math.round(Number(cuotaActual) || 0)
      if (actual > 0) setCuota(String(actual))
    } else {
      setTasa((t) => String(Math.round(Number(t) * 100) / 100))
    }
    setEnPesos(pesos)
  }, [enPesos, abierto, monto, tasa, cuotaActual, setTasa])

  /** Para cuando la tasa se escribe a mano en otro sitio: el % manda otra vez. */
  const apagar = useCallback(() => setEnPesos(false), [])

  return {
    enPesos: enPesos && habilitado, cuota, setCuota, buscada, elegir, apagar,
    imposible: enPesos && habilitado && !abierto && !!buscada?.imposible,
  }
}
