import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildContexto, buildSystemPrompt, buildContextoCobrador, buildSystemPromptCobrador, detectQueryComplexity } from '@/lib/asistente'
import { asistenteLimiter } from '@/lib/rate-limit'
import { planTieneIA } from '@/lib/planes'
import { TOOLS_OWNER } from '@/lib/asistente-tools'
import { calcularPrestamo } from '@/lib/calculos'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Build the displayData object shown in the confirmation card
async function buildDisplayData(toolName, input, orgId) {
  const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`

  switch (toolName) {
    case 'create_client': {
      return {
        fields: [
          { label: 'Nombre', value: input.nombre },
          { label: 'Cédula', value: input.cedula },
          { label: 'Teléfono', value: input.telefono },
          ...(input.rutaNombre ? [{ label: 'Ruta', value: input.rutaNombre }] : []),
          ...(input.direccion ? [{ label: 'Dirección', value: input.direccion }] : []),
        ],
        titulo: 'Crear cliente',
        color: 'info',
      }
    }
    case 'create_loan': {
      const hoy = new Date().toISOString().split('T')[0]
      const calc = calcularPrestamo({
        montoPrestado: input.montoPrestado,
        tasaInteres: input.tasaInteres,
        diasPlazo: input.diasPlazo,
        fechaInicio: input.fechaInicio || hoy,
        frecuencia: input.frecuencia,
      })
      const fechaFin = calc.fechaFin
        ? new Date(calc.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—'
      const frecLabels = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }
      return {
        fields: [
          { label: 'Cliente', value: input.clienteNombre },
          { label: 'Monto prestado', value: fmt(input.montoPrestado) },
          { label: 'Tasa de interés', value: `${input.tasaInteres}% mensual` },
          { label: 'Plazo', value: `${input.diasPlazo} días (hasta ${fechaFin})` },
          { label: 'Total a pagar', value: fmt(calc.totalAPagar) },
          { label: 'Cuota', value: `${fmt(calc.cuotaDiaria)} ${frecLabels[input.frecuencia] || ''}` },
          { label: 'Frecuencia', value: frecLabels[input.frecuencia] || input.frecuencia },
        ],
        titulo: 'Crear préstamo',
        color: 'success',
      }
    }
    case 'create_route': {
      return {
        fields: [
          { label: 'Nombre', value: input.nombre },
          ...(input.cobradorNombre ? [{ label: 'Cobrador', value: input.cobradorNombre }] : []),
        ],
        titulo: 'Crear ruta',
        color: 'info',
      }
    }
    case 'assign_clients_to_route': {
      return {
        fields: [
          { label: 'Clientes', value: `${input.clienteCount} clientes` },
          { label: 'Ruta destino', value: input.rutaNombre },
          ...(input.forzar ? [{ label: 'Nota', value: 'Moverá clientes de otras rutas' }] : []),
        ],
        titulo: 'Asignar clientes a ruta',
        color: 'warning',
      }
    }
    case 'adjust_capital': {
      // Fetch current capital balance
      const capital = await prisma.capital.findFirst({
        where: { organizationId: orgId },
        select: { saldo: true },
      })
      const saldoActual = capital?.saldo ?? 0
      const nuevoSaldo = input.tipo === 'inyeccion' ? saldoActual + input.monto : saldoActual - input.monto
      return {
        fields: [
          { label: 'Tipo', value: input.tipo === 'inyeccion' ? 'Inyección de capital' : 'Retiro de capital' },
          { label: 'Monto', value: fmt(input.monto) },
          ...(input.descripcion ? [{ label: 'Descripción', value: input.descripcion }] : []),
          { label: 'Saldo actual', value: fmt(saldoActual) },
          { label: 'Saldo después', value: fmt(nuevoSaldo) },
        ],
        titulo: input.tipo === 'inyeccion' ? 'Inyectar capital' : 'Retirar capital',
        color: input.tipo === 'inyeccion' ? 'success' : 'warning',
      }
    }
    case 'edit_loan': {
      const modeLabels = { extender: 'Extender plazo', corregir: 'Corregir fecha', diaCobro: 'Cambiar día de cobro' }
      const fields = [
        { label: 'Préstamo de', value: input.clienteNombre },
        { label: 'Cambio', value: modeLabels[input.modo] || input.modo },
      ]
      if (input.nuevaFechaFin) {
        fields.push({ label: 'Nueva fecha fin', value: new Date(input.nuevaFechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) })
      }
      if (input.diasExtra) fields.push({ label: 'Días extra', value: `+${input.diasExtra} días` })
      if (input.diaCobroSemana !== undefined) {
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        fields.push({ label: 'Nuevo día de cobro', value: dias[input.diaCobroSemana] || input.diaCobroSemana })
      }
      if (input.diaCobroMes) fields.push({ label: 'Día de cobro', value: `Día ${input.diaCobroMes} de cada mes` })
      return { fields, titulo: 'Editar préstamo', color: 'info' }
    }
    case 'escalate_support': {
      return { tipo: 'escalation', motivo: input.motivo, mensaje: input.mensaje }
    }
    default:
      return { fields: [], titulo: toolName, color: 'info' }
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, organizationId: orgId, plan, rutaIds } = session.user
  const isOwner = rol === 'owner'
  const isCobrador = rol === 'cobrador'

  if (!isOwner && !isCobrador) {
    return NextResponse.json({ error: 'Sin permisos para usar el asistente' }, { status: 403 })
  }

  // Plan check solo para owner
  if (isOwner && !planTieneIA(plan)) {
    return NextResponse.json({
      error: 'plan_upgrade_required',
      minPlan: 'growth',
      message: 'El asistente IA está disponible desde el plan Crecimiento. Actualiza tu plan para acceder.',
    }, { status: 403 })
  }

  // Rate limit por orgId
  const rl = asistenteLimiter(orgId)
  if (!rl.ok) {
    return NextResponse.json({
      error: 'rate_limit',
      message: `Alcanzaste el límite de consultas por hora. Intenta de nuevo en ${rl.retryAfter} segundos.`,
    }, { status: 429 })
  }

  const body = await req.json()
  const { message, history = [] } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  // Build context and prompt based on role
  const ctx = isOwner
    ? await buildContexto(orgId)
    : await buildContextoCobrador(orgId, rutaIds ?? [], session.user.id)

  const systemPrompt = isOwner
    ? buildSystemPrompt(ctx)
    : buildSystemPromptCobrador(ctx)

  const complexity = detectQueryComplexity(message)
  // Owners with tools always use Sonnet for better tool calling; cobradores always use Haiku
  const model = isCobrador
    ? 'claude-haiku-4-5-20251001'
    : (complexity === 'simple' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6')

  const messages = [
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const streamParams = {
    model,
    max_tokens: isOwner ? 1024 : 600,
    system: systemPrompt,
    messages,
    ...(isOwner ? { tools: TOOLS_OWNER, tool_choice: { type: 'auto' } } : {}),
  }

  const stream = anthropic.messages.stream(streamParams)

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      let hasToolUse = false

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: chunk.delta.text })}\n\n`))
          }
          if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
            hasToolUse = true
          }
        }

        if (hasToolUse) {
          const finalMsg = await stream.finalMessage()
          const toolBlock = finalMsg.content.find(b => b.type === 'tool_use')
          if (toolBlock) {
            // lookup_client is handled server-side without showing a confirmation card
            if (toolBlock.name === 'lookup_client') {
              // Perform the lookup and continue conversation
              const buscar = toolBlock.input?.buscar || ''
              const clientes = await prisma.cliente.findMany({
                where: {
                  organizationId: orgId,
                  estado: { notIn: ['eliminado'] },
                  OR: [
                    { nombre: { contains: buscar } },
                    { cedula: { contains: buscar } },
                  ],
                },
                select: { id: true, nombre: true, cedula: true, telefono: true },
                take: 5,
              })
              const lookupResult = clientes.length > 0
                ? clientes.map(c => `${c.nombre} (cédula: ${c.cedula}, id: ${c.id})`).join(' | ')
                : 'No se encontró ningún cliente con ese nombre o cédula'

              controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'lookup_result', result: lookupResult, clientes })}\n\n`))
            } else {
              const displayData = await buildDisplayData(toolBlock.name, toolBlock.input, orgId)
              controller.enqueue(
                enc.encode(`data: ${JSON.stringify({
                  type: 'action_proposal',
                  tool: toolBlock.name,
                  input: toolBlock.input,
                  displayData,
                })}\n\n`)
              )
            }
          }
        }

        controller.enqueue(enc.encode('data: [DONE]\n\n'))
      } catch (err) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'Error al procesar tu consulta.' })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
