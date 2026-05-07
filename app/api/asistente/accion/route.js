import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { accionLimiter } from '@/lib/rate-limit'
import { clearCachedContexto } from '@/lib/asistente-cache'
import { generarTextoComprobante, formatearTelefono } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  const isOwner = session.user.rol === 'owner'
  const isCobrador = session.user.rol === 'cobrador'

  // Validación temprana de tool antes de rate-limit para poder hacer el check de permisos
  const bodyRaw = await req.json()
  const { tool, input } = bodyRaw
  if (!tool || !input) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

  // Owner puede todo; cobrador solo puede register_payment y register_expense
  const COBRADOR_TOOLS = ['register_payment', 'register_expense']
  if (!isOwner && !(isCobrador && COBRADOR_TOOLS.includes(tool))) {
    return NextResponse.json({ error: 'Sin permisos para ejecutar esta acción' }, { status: 403 })
  }

  // Rate limit de acciones (más estricto que el chat)
  const rl = accionLimiter(orgId)
  if (!rl.ok) {
    return NextResponse.json({
      error: 'rate_limit',
      message: `Límite de acciones alcanzado. Intenta en ${rl.retryAfter} segundos.`,
    }, { status: 429 })
  }

  // Use NEXTAUTH_URL for internal fetches, fallback to localhost
  const origin = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const cookie = req.headers.get('cookie') || ''
  const headers = { 'Content-Type': 'application/json', Cookie: cookie }

  try {
    switch (tool) {
      case 'create_client': {
        const res = await fetch(`${origin}/api/clientes`, {
          method: 'POST', headers,
          body: JSON.stringify({ nombre: input.nombre, cedula: input.cedula, telefono: input.telefono, rutaId: input.rutaId, direccion: input.direccion }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al crear el cliente' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({ ok: true, message: `Cliente ${input.nombre} creado exitosamente.`, id: data.id })
      }

      case 'create_loan': {
        const hoy = new Date().toISOString().split('T')[0]
        // Validar fechaInicio: si Claude la calculó mal (>30 días en el pasado o en el futuro lejano), usar hoy
        let fechaInicio = hoy
        if (input.fechaInicio) {
          const diff = (new Date(input.fechaInicio) - new Date(hoy)) / (1000 * 60 * 60 * 24)
          if (diff >= -30 && diff <= 365) fechaInicio = input.fechaInicio
        }
        const res = await fetch(`${origin}/api/prestamos`, {
          method: 'POST', headers,
          body: JSON.stringify({
            clienteId: input.clienteId,
            montoPrestado: input.montoPrestado,
            tasaInteres: input.tasaInteres,
            diasPlazo: input.diasPlazo,
            fechaInicio,
            frecuencia: input.frecuencia,
          }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al crear el préstamo' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({ ok: true, message: `Préstamo creado para ${input.clienteNombre}.`, id: data.id })
      }

      case 'create_route': {
        const res = await fetch(`${origin}/api/rutas`, {
          method: 'POST', headers,
          body: JSON.stringify({ nombre: input.nombre, cobradorId: input.cobradorId }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al crear la ruta' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({ ok: true, message: `Ruta "${input.nombre}" creada exitosamente.`, id: data.id })
      }

      case 'assign_clients_to_route': {
        const res = await fetch(`${origin}/api/rutas/${input.rutaId}/clientes`, {
          method: 'POST', headers,
          body: JSON.stringify({ clienteIds: input.clienteIds, forzar: input.forzar ?? false }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al asignar clientes' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({ ok: true, message: `${input.clienteIds.length} clientes asignados a "${input.rutaNombre}".` })
      }

      case 'adjust_capital': {
        const res = await fetch(`${origin}/api/capital`, {
          method: 'POST', headers,
          body: JSON.stringify({ tipo: input.tipo, monto: input.monto, descripcion: input.descripcion || '' }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al ajustar el capital' }, { status: res.status })
        clearCachedContexto(orgId)
        const nuevoSaldo = data.capital?.saldo
        const saldoMsg = nuevoSaldo != null ? ` Nuevo saldo: $${Math.round(nuevoSaldo).toLocaleString('es-CO')}` : ''
        return NextResponse.json({ ok: true, message: `Movimiento registrado.${saldoMsg}` })
      }

      case 'edit_loan': {
        const body = { modo: input.modo }
        // Para modo 'extender': el API requiere nuevaFechaFin, no acepta diasExtra directamente.
        // Si Claude calculó diasExtra sin nuevaFechaFin, derivar la fecha consultando el préstamo.
        if (input.nuevaFechaFin) {
          body.fechaFin = input.nuevaFechaFin
        } else if (input.modo === 'extender' && input.diasExtra) {
          // Fetch current fechaFin from DB
          const prestamoRes = await fetch(`${origin}/api/prestamos/${input.prestamoId}`, { headers })
          if (prestamoRes.ok) {
            const prestamoData = await prestamoRes.json()
            const fechaActual = new Date(prestamoData.prestamo?.fechaFin || prestamoData.fechaFin || Date.now())
            fechaActual.setDate(fechaActual.getDate() + Number(input.diasExtra))
            body.fechaFin = fechaActual.toISOString().split('T')[0]
          }
        }
        if (input.frecuencia) body.frecuencia = input.frecuencia
        if (input.diaCobroSemana !== undefined) body.diaCobroSemana = input.diaCobroSemana
        if (input.diaCobroMes) body.diaCobroMes = input.diaCobroMes

        const res = await fetch(`${origin}/api/prestamos/${input.prestamoId}`, {
          method: 'PATCH', headers, body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al editar el préstamo' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({ ok: true, message: `Préstamo de ${input.clienteNombre} actualizado.` })
      }

      case 'escalate_support': {
        const waNumber = process.env.SOPORTE_WHATSAPP || '573011993001'
        const waText = encodeURIComponent(`Hola, necesito ayuda con Control Finanzas. Motivo: ${input.motivo}`)
        return NextResponse.json({
          ok: true,
          type: 'escalation',
          motivo: input.motivo,
          whatsappUrl: `https://wa.me/${waNumber}?text=${waText}`,
          soporteUrl: '/soporte/nuevo',
          planesUrl: '/configuracion/plan',
        })
      }

      case 'register_payment': {
        const res = await fetch(`${origin}/api/prestamos/${input.prestamoId}/pagos`, {
          method: 'POST', headers,
          body: JSON.stringify({
            montoPagado: input.monto,
            tipo: input.tipo,
            metodoPago: input.metodoPago || 'efectivo',
            plataforma: input.plataforma || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al registrar el pago' }, { status: res.status })
        clearCachedContexto(orgId)

        // Generar link de comprobante WhatsApp si el cliente tiene teléfono
        let waUrl = null
        try {
          const prestamoRes = await fetch(`${origin}/api/prestamos/${input.prestamoId}`, { headers })
          if (prestamoRes.ok) {
            const pd = await prestamoRes.json()
            const prestamo = pd.prestamo ?? pd
            const cliente = prestamo.cliente
            const tel = formatearTelefono(cliente?.telefono)
            if (tel) {
              const pagosReal = (prestamo.pagos ?? []).filter(p => !['recargo', 'descuento'].includes(p.tipo))
              const totalPagado = pagosReal.reduce((s, p) => s + Number(p.montoPagado), 0)
              const saldoPendiente = Math.max(0, Number(prestamo.totalAPagar) - totalPagado)
              const porcentajePagado = prestamo.totalAPagar > 0
                ? Math.round((totalPagado / prestamo.totalAPagar) * 100)
                : 100
              const ultimoPago = pagosReal.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago))[0]
              const texto = generarTextoComprobante(
                { nombre: cliente.nombre, cedula: cliente.cedula },
                { totalPagado, saldoPendiente, porcentajePagado, diasMora: prestamo.diasMora ?? 0 },
                { montoPagado: input.monto, fechaPago: ultimoPago?.fechaPago ?? new Date().toISOString() },
              )
              waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
            }
          }
        } catch {}

        return NextResponse.json({
          ok: true,
          message: `Pago de $${Math.round(input.monto).toLocaleString('es-CO')} registrado para ${input.clienteNombre}.`,
          waUrl,
        })
      }

      case 'register_expense': {
        const res = await fetch(`${origin}/api/gastos`, {
          method: 'POST', headers,
          body: JSON.stringify({ description: input.description, monto: input.monto }),
        })
        const data = await res.json()
        if (!res.ok) return NextResponse.json({ error: data.error || 'Error al registrar el gasto' }, { status: res.status })
        clearCachedContexto(orgId)
        return NextResponse.json({
          ok: true,
          message: `Gasto de $${Math.round(input.monto).toLocaleString('es-CO')} (${input.description}) registrado. Pendiente de aprobación.`,
        })
      }

      default:
        return NextResponse.json({ error: 'Herramienta desconocida' }, { status: 400 })
    }
  } catch (err) {
    console.error('[asistente/accion] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Error interno al ejecutar la acción' }, { status: 500 })
  }
}
