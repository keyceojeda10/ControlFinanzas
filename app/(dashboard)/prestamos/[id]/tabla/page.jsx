'use client'

// app/(dashboard)/prestamos/[id]/tabla/page.jsx — la tabla del préstamo, T12-01.
//
// ES SU PROPIA PANTALLA, no una tarjeta dentro de la ficha. La lámina la dibuja
// con flecha de volver y su propio encabezado —«Tabla del préstamo · Carlos
// Prueba 1 · $1.000.000 · 20% · 6 meses»— y con barra de acción abajo para
// compartirla e imprimirla. Metida como acordeón dentro de la ficha no se puede
// mandar al cliente, que es la mitad de para qué sirve.
//
// SOLO EXISTE PARA LOS MODOS CON TABLA (`lineal`, `lineal_dinamico`,
// `solo_interes`, `saldo`), que son el 6,2% de la cartera. En los otros no hay
// calendario que mostrar: el préstamo es una frase, y dibujar treinta filas
// idénticas sería inventar un desglose que el sistema no guarda. Ver la nota de
// FichaPrestamo.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TablaAmortizacion, { CompararModos } from '@/components/pantallas/TablaAmortizacion'
import HojaInferior from '@/components/cf/HojaInferior'
import { useCabecera } from '@/components/armazon/Armazon'
import { adaptarTabla, adaptarComparacion } from '@/lib/adaptadores/tabla'
import { calcularPrestamo } from '@/lib/calculos'

export default function TablaPrestamoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [prestamo, setPrestamo] = useState(null)
  const [error, setError] = useState('')
  const [comparando, setComparando] = useState(false)

  useEffect(() => {
    let vivo = true
    // `no-store`: en desarrollo la respuesta tarda y el fetch se aborta con la
    // caché por medio. Ya pasó una vez en el panel.
    fetch(`/api/prestamos/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no se pudo cargar'))))
      .then((d) => { if (vivo) setPrestamo(d) })
      .catch(() => { if (vivo) setError('No pude cargar la tabla.') })
    return () => { vivo = false }
  }, [id])

  const datos = prestamo ? adaptarTabla(prestamo) : null

  // El hook va SIEMPRE, antes de cualquier return: detrás de un return temprano
  // el orden de hooks cambia entre renders y React rompe la pantalla entera.
  useCabecera({
    titulo: 'Tabla del préstamo',
    subtitulo: datos?.subtitulo ?? null,
    onVolver: () => router.push(`/prestamos/${id}`),
  })

  if (error) {
    return <p style={{ padding: '20px 0', fontSize: 14, color: 'var(--cf-red-dark)' }}>{error}</p>
  }
  if (!datos) {
    return <p style={{ padding: '20px 0', fontSize: 14, color: 'var(--cf-ink-3)' }}>Cargando…</p>
  }
  if (!datos.cuotas.length) {
    return (
      <p style={{ padding: '20px 0', fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
        Este préstamo no tiene tabla de cuotas: se cobra una cuota fija hasta
        saldar, y eso ya lo dice su ficha en una frase.
      </p>
    )
  }

  const comparacion = comparando ? adaptarComparacion(prestamo, calcularPrestamo) : null

  return (
    <>
      <TablaAmortizacion
        {...datos}
        onComparar={() => setComparando(true)}
        onCompartir={() => {
          // `navigator.share` no existe en escritorio ni en todos los navegadores.
          // Sin la guardia, tocar el botón lanza un TypeError y no pasa nada — que
          // es el patrón del control muerto con otra ropa.
          if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({ title: 'Tabla del préstamo', text: datos.textoParaCompartir }).catch(() => {})
          } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(datos.textoParaCompartir).catch(() => {})
          }
        }}
        onImprimir={() => window.print()}
      />

      {/* COMPARAR NO CAMBIA NADA TODAVÍA. La hoja enseña qué pasaría con cada modo
          y `onElegir` lleva al modal de editar el préstamo con el modo puesto:
          cambiarle el modo a un préstamo en marcha rehace la tabla y mueve lo que el
          cliente debe, así que eso se confirma donde se confirman los cambios de
          plata, no en una hoja de comparación. */}
      {comparando && comparacion && (
        <HojaInferior abierta titulo="Comparar modos" onCerrar={() => setComparando(false)}>
          <CompararModos
            {...comparacion}
            onDejar={() => setComparando(false)}
            onElegir={(o) => {
              if (o.id === comparacion.actual) { setComparando(false); return }
              router.push(`/prestamos/${id}?editar=${o.id}`)
            }}
          />
        </HojaInferior>
      )}
    </>
  )
}
