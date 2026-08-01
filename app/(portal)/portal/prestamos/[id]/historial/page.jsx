'use client'

// app/(portal)/portal/prestamos/[id]/historial/page.jsx — T36-02.
//
// ══ POR QUE ES UNA PANTALLA Y NO UN «VER MAS» ══════════════════════════════
//
// Antes la ficha del prestamo enseñaba 5 pagos y el resto se desplegaba debajo.
// Para mirar por encima esta bien; para lo que de verdad se usa, no: el cliente
// abre esto cuando NO CUADRA algo, y entonces necesita la lista entera, de
// arriba abajo, con el medio de pago al lado — para poder ponerla junto a la
// pantalla del cobrador y que la discusion se acabe mirando.
//
// La cifra grande es LO QUE YA PAGO, no lo que debe. Es su portal: entra a
// comprobar que sus pagos estan registrados, no a que le recuerden cuanto falta
// —eso ya lo sabe—. Abrir con la deuda es innecesariamente hostil en la unica
// pantalla del sistema escrita para alguien que no confia del todo en quien se
// la enseña.
//
// ⚠ FALTA «quedaste en $X» detras del medio de pago, que la lamina si lleva.
// El saldo despues de CADA pago no es una columna: sale de la cascada de
// reparto entre interes y capital, y calcularla aqui en el navegador es como se
// consigue que esta pantalla y la del cobrador digan cifras distintas del mismo
// prestamo. Cuando el servidor lo devuelva, se añade al `detalle`.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MiHistorial } from '@/components/pantallas/MiHistorial'
import { misPagos } from '@/lib/adaptadores/portal'
import { formatMoney } from '@/lib/i18n'

export default function PortalHistorialPage() {
  const params = useParams()
  const router = useRouter()
  const [prestamo, setPrestamo] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/prestamos/${params.id}`)
      if (!res.ok) { router.replace('/portal'); return }
      setPrestamo(await res.json())
    } catch {
      router.replace('/portal')
    } finally {
      setCargando(false)
    }
  }, [params.id, router])

  useEffect(() => { cargar() }, [cargar])

  if (cargando || !prestamo) {
    return <div style={{ minHeight: '100dvh', background: '#15161A' }} />
  }

  const fmt = (v) => formatMoney(v)
  const pagos = prestamo.pagos ?? []
  const pagado = Math.round(prestamo.totalPagado ?? 0)
  const falta = Math.round(prestamo.saldo ?? 0)

  return (
    <div style={{ minHeight: '100dvh', background: '#15161A' }}>
      <MiHistorial
        subtitulo={prestamo.nombreProducto || undefined}
        pagado={fmt(pagado)}
        falta={fmt(falta)}
        porcentaje={prestamo.porcentaje ?? 0}
        totalPagos={`${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'}`}
        pagos={misPagos(
          pagos.map((p) => ({
            id: p.id,
            fecha: p.fechaPago,
            monto: p.montoPagado,
            tipo: p.tipo,
            // El nombre de la cuenta cuando fue transferencia («Nequi»), y si no
            // el medio a secas. Los pagos viejos no lo tienen y quedan sin linea
            // en vez de con una inventada.
            medio: p.metodoPagoRef?.nombre || p.metodoPago || null,
          })),
          fmt,
          (f) => new Date(f).toLocaleDateString('es-CO', {
            weekday: 'long', day: 'numeric', month: 'long',
          }),
        )}
        onVolver={() => router.push(`/portal/prestamos/${params.id}`)}
      />
    </div>
  )
}
