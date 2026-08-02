'use client'

// app/(dashboard)/mas/page.jsx — el quinto destino de la pastilla.
//
// Existía como componente y NO como ruta, así que el quinto botón de la barra
// inferior llevaba a un 404. Era el único enlace roto de los cinco, y el que
// bloqueaba poder desplegar el armazón.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PantallaMas from '@/components/pantallas/PantallaMas'
import { adaptarMas } from '@/lib/adaptadores/mas'

export default function Mas() {
  const router = useRouter()
  const [datos, setDatos] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [cargando, setCargando] = useState(true)

  // ── SE TRAGABA LOS ERRORES, Y ERAN DOS ──
  //
  // Antes: `.then((r) => (r.ok ? r.json() : null))` convertía CUALQUIER
  // respuesta no 2xx en `null` —sin distinguir un 401 de un 500— y un
  // `.catch(() => {})` se comía el fallo de red. `datos` se quedaba en `null`
  // para siempre y media pantalla aparecía sin cifras, sin decir por qué ni
  // ofrecer nada.
  //
  // La decisión original sigue siendo buena y se mantiene: SIN CIFRAS LA
  // PANTALLA SIGUE SIRVIENDO COMO MENÚ. Es peor no poder navegar que navegar
  // sin los números, así que el fallo no bloquea nada.
  //
  // Lo que cambia es que ahora se dice, y se puede reintentar. Un menú al que
  // le faltan la mitad de las cifras y no explica nada se lee como una app
  // rota.
  const traer = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/mas')
      if (!res.ok) { setFallo(true); return }
      const d = await res.json()
      if (d) { setDatos(d); setFallo(false) }
    } catch {
      setFallo(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { traer() }, [traer])

  // EL HUECO DEL PIE LO RESERVA EL ARMAZÓN (112px), NO LA PANTALLA.
  //
  // Aquí había un `paddingBottom: 96` propio —y el comentario decía «el hueco
  // final lo reserva cada pantalla, no el layout», que era cierto ANTES—. Desde
  // que el armazón lo pone para todas, los dos se sumaban: 208px de blanco al
  // final. Es el «demasiado espacio» que reportó el dueño.
  return (
    <div>
      {/* Discreto y sin robarle el sitio al menú: una línea con su reintento,
          no una pantalla de error que tape lo que sí funciona. */}
      {fallo && !cargando && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          margin: '0 0 12px', padding: '11px 14px',
          borderRadius: 'var(--cf-r-control)',
          background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink-2)' }}>
            No pudimos cargar tus cifras. El menú funciona igual.
          </span>
          <button
            type="button"
            onClick={traer}
            style={{
              flex: 'none', border: 0, background: 'none', padding: 0,
              cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
              color: 'var(--cf-gold-dark)',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      <PantallaMas sinMargen {...adaptarMas(datos)} onIr={(destino) => router.push(destino)} />
    </div>
  )
}
