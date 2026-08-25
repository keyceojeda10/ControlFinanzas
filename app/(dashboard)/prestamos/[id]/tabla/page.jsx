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
import { compartirTablaImagen } from '@/lib/simulacion-imagen'
import { useAuth } from '@/hooks/useAuth'

export default function TablaPrestamoPage() {
  const { id } = useParams()
  const router = useRouter()
  const { orgNombre } = useAuth()
  const [prestamo, setPrestamo] = useState(null)
  const [error, setError] = useState('')
  const [comparando, setComparando] = useState(false)
  const [aviso, setAviso] = useState('')

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
      {aviso && (
        <p className="cf-no-print text-[13px] mb-2 text-center" style={{ color: 'var(--cf-ink-2)' }}>{aviso}</p>
      )}

      {/* ── LA CABECERA DEL PAPEL ──────────────────────────────────────────
          En pantalla el título y de quién es la tabla los pone el armazón, y el
          armazón no se imprime. Sin esto el PDF salía con doce tarjetas de
          cifras y ni un nombre: «sin el nombre, una tabla compartida no se sabe
          a quién pertenece» (`adaptarTabla`). */}
      <div className="cf-solo-print" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#63676F', margin: 0 }}>
          Tabla del préstamo
        </p>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#15161A', margin: '4px 0 0' }}>
          {datos.subtitulo}
        </p>
        {orgNombre && (
          <p style={{ fontSize: 12, color: '#63676F', margin: '2px 0 0' }}>{orgNombre}</p>
        )}
      </div>

      <TablaAmortizacion
        {...datos}
        onComparar={() => setComparando(true)}
        /* ── ⚠ EL BOTÓN QUE «NO HACE NADA» ────────────────────────────────
           Reportado el 25 ago 2026: «si le doy al botón compartir tabla no hace
           nada». Y era cierto en escritorio: `navigator.share` no existe, así
           que caía al portapapeles Y COPIABA EN SILENCIO. Un botón que copia
           sin decirlo es indistinguible de uno roto — la lección ya estaba
           escrita en el simulador («al portapapeles Y SE DICE») y esta pantalla
           no se enteró.

           Ahora manda la tabla COMO SE VE, en imagen, que es para lo que existe
           esta pantalla —«metida como acordeón dentro de la ficha no se puede
           mandar al cliente»— y lo que pidió Préstamos Rincón para el
           simulador. El texto plano se queda de respaldo, y avisando. */
        onCompartir={() => {
          const filas = prestamo?.cuotasAmortizacion
          const pagadas = new Map((datos.cuotas ?? []).map((c) => [c.id, c.pagada]))
          const ok = Array.isArray(filas) && filas.length > 0 && compartirTablaImagen({
            tabla: filas.map((f) => ({ ...f, pagada: pagadas.get(f.numeroPeriodo) ?? false })),
            frecuencia: prestamo?.frecuencia,
            orgNombre: orgNombre || '',
            cuotaTexto: datos.cuotas[0]?.cuota ?? '',
            cuotaPie: datos.subtitulo,
            resumen: [
              ['Capital prestado', datos.capital],
              ['Ganancia', datos.ganancia],
              ['Total a pagar', datos.total],
            ],
          })
          if (ok) return
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(datos.textoParaCompartir)
              .then(() => setAviso('Copiado. Pégalo en el chat del cliente.'))
              .catch(() => setAviso('Este aparato no deja copiar ni compartir.'))
          } else {
            setAviso('Este aparato no deja copiar ni compartir.')
          }
          setTimeout(() => setAviso(''), 2800)
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
