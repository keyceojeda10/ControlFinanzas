import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { accionLimiter } from '@/lib/rate-limit'
import { clearCachedContexto } from '@/lib/asistente-cache'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador puede ejecutar acciones' }, { status: 403 })

  const orgId = session.user.organizationId

  // Rate limit de acciones (más estricto que el chat)
  const rl = accionLimiter(orgId)
  if (!rl.ok) {
    return NextResponse.json({
      error: 'rate_limit',
      message: `Límite de acciones alcanzado. Intenta en ${rl.retryAfter} segundos.`,
    }, { status: 429 })
  }

  const { tool, input } = await req.json()
  if (!tool || !input) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

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
        const res = await fetch(`${origin}/api/prestamos`, {
          method: 'POST', headers,
          body: JSON.stringify({
            clienteId: input.clienteId,
            montoPrestado: input.montoPrestado,
            tasaInteres: input.tasaInteres,
            diasPlazo: input.diasPlazo,
            fechaInicio: input.fechaInicio || hoy,
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
        if (input.nuevaFechaFin) body.fechaFin = input.nuevaFechaFin
        if (input.diasExtra) body.diasExtra = input.diasExtra
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
        const waNumber = process.env.SOPORTE_WHATSAPP || '573001234567'
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

      default:
        return NextResponse.json({ error: 'Herramienta desconocida' }, { status: 400 })
    }
  } catch (err) {
    console.error('[asistente/accion] error:', err?.message ?? err)
    return NextResponse.json({ error: 'Error interno al ejecutar la acción' }, { status: 500 })
  }
}
