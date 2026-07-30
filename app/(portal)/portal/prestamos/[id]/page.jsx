'use client'

// app/(portal)/portal/prestamos/[id]/page.jsx — T04-07 su préstamo.
//
// ══ TRES PREGUNTAS Y NADA MÁS ══════════════════════════════════════════════
//
// Cuánto falta, cuándo es la próxima, y qué he pagado. La versión anterior tenía
// pestañas «Resumen / Pagos / Cuotas» con el monto prestado, el total a pagar, la
// tasa y el modo de interés: información del PRESTAMISTA en la pantalla del
// DEUDOR. Nada de eso contesta una pregunta que el cliente se esté haciendo
// delante del teléfono, y la tasa además invita a una discusión que no es aquí.
//
// LO QUE FALTA SE CALCULA SIN `totalAPagar`. El API solo lo manda cuando la
// organización activó `portalDatosCompletos`; `saldo` y `totalPagado` llegan
// siempre. Total = saldo + pagado, que es lo mismo y no depende del permiso.

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatMoney } from '@/lib/i18n'
import { PortalPrestamo } from '@/components/pantallas/PortalCliente'
import { loQueDebe, proximaCuota as adaptarProxima, misPagos, avisoDePago } from '@/lib/adaptadores/portal'
import { PilaEsqueletos } from '@/components/cf/primitivos2'

function fechaLarga(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** «Mañana» dice más que «29 de julio»: es lo que contesta la pregunta. */
function relativoDe(fecha) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(fecha); objetivo.setHours(0, 0, 0, 0)
  const dias = Math.round((objetivo - hoy) / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias === -1) return 'Fue ayer'
  if (dias < 0) return `Hace ${Math.abs(dias)} días`
  return `En ${dias} días`
}

export default function PortalPrestamoDetalle() {
  const router = useRouter()
  const params = useParams()
  const [prestamo, setPrestamo] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [todos, setTodos] = useState(false)

  const fmt = useCallback((v) => formatMoney(v, cliente?.country || 'co'), [cliente?.country])

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/session').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/portal/prestamos/${params.id}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sesion, p]) => {
        if (!sesion?.authenticated) { router.push('/portal/login'); return }
        setCliente(sesion.cliente)
        if (!p) { router.push('/portal'); return }
        setPrestamo(p)
      })
      .catch(() => router.push('/portal'))
      .finally(() => setCargando(false))
  }, [params.id, router])

  if (cargando || !prestamo) {
    return <div style={{ padding: 20 }}><PilaEsqueletos cuantos={3} alto={110} /></div>
  }

  const pagado = prestamo.totalPagado ?? 0
  const saldo = prestamo.saldo ?? 0
  const cuotas = prestamo.cuotas ?? []
  const pagos = prestamo.pagos ?? []

  const deuda = loQueDebe({
    totalAPagar: prestamo.totalAPagar ?? (saldo + pagado),
    pagado,
    cuotasPagadas: cuotas.filter((c) => c.estado === 'pagada').length,
    cuotasTotales: cuotas.length,
    diasMora: prestamo.diasMora,
  }, fmt)

  const proxima = prestamo.estado === 'activo' && prestamo.proximaCuota
    ? adaptarProxima({
      monto: prestamo.proximaCuota.monto ?? prestamo.cuota,
      fecha: fechaLarga(prestamo.proximaCuota.fechaProgramada),
      relativo: relativoDe(prestamo.proximaCuota.fechaProgramada),
    }, fmt)
    : null

  const visibles = todos ? pagos : pagos.slice(0, 5)

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex' }}>
        <PortalPrestamo
          cliente={cliente?.nombre}
          cedula={cliente?.cedula ? `CC ${cliente.cedula}` : null}
          onSalir={async () => {
            await fetch('/api/portal/auth', { method: 'DELETE' })
            router.push('/portal/login')
          }}
          deuda={deuda}
          proxima={proxima}
          // «Avisar que ya pagué» NO REGISTRA EL PAGO: abre WhatsApp con el texto
          // escrito. Registrar lo hace quien cobra, y dejar creer lo contrario
          // haría que el cliente diera por hecho algo que no pasó.
          onAvisar={prestamo.estado === 'activo' ? () => {
            const texto = avisoDePago({
              nombre: cliente?.nombre,
              monto: prestamo.proximaCuota?.monto ?? prestamo.cuota,
              cuando: 'hoy',
            }, fmt)
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
          } : undefined}
          pagosCuenta={pagos.length > 0 ? `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'}` : null}
          pagos={misPagos(
            visibles.map((p) => ({ id: p.id, fecha: p.fechaPago, monto: p.montoPagado, tipo: p.tipo })),
            fmt,
            (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }),
          )}
          onTodos={!todos && pagos.length > 5 ? () => setTodos(true) : undefined}
        />
      </div>
    </div>
  )
}
