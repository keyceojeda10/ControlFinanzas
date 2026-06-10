import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { buildContexto, buildSystemPrompt, buildContextoCobrador, buildSystemPromptCobrador, detectQueryComplexity } from '@/lib/asistente'
import { getAsistenteLimiter } from '@/lib/rate-limit'
import { planTieneIA } from '@/lib/planes'
import { TOOLS_OWNER, TOOLS_COBRADOR } from '@/lib/asistente-tools'
import { calcularPrestamo } from '@/lib/calculos'
import { prisma } from '@/lib/prisma'
import { obtenerMemorias, extraerYGuardarMemoria } from '@/lib/asistente-memoria'

export const dynamic = 'force-dynamic'

let _deepseek = null
function getDeepSeek() {
  if (!_deepseek) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY no está configurada')
    }
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    })
  }
  return _deepseek
}

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
        ? new Date(calc.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
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
        fields.push({ label: 'Nueva fecha fin', value: new Date(input.nuevaFechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) })
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
      const origin = process.env.NEXTAUTH_URL ?? 'https://app.control-finanzas.com'
      const waNum = process.env.SOPORTE_WHATSAPP ?? '573011993001'
      return {
        tipo: 'escalation',
        motivo: input.motivo,
        mensaje: input.mensaje,
        whatsappUrl: `https://wa.me/${waNum}?text=Hola%2C+necesito+soporte+con+Control+Finanzas`,
        soporteUrl: `${origin}/soporte`,
        planesUrl: input.motivo === 'renovar_plan' ? `${origin}/configuracion/plan` : null,
      }
    }
    case 'register_payment': {
      let saldoActual = null
      let prestamoIdResuelto = input.prestamoId
      try {
        let prestamo = null
        if (prestamoIdResuelto) {
          prestamo = await prisma.prestamo.findFirst({
            where: { id: prestamoIdResuelto, organizationId: orgId, estado: 'activo' },
            select: { id: true, totalAPagar: true, pagos: { select: { montoPagado: true, tipo: true } } },
          })
        }
        if (!prestamo && input.clienteNombre) {
          const palabraClave = input.clienteNombre.split(' ')[0]
          const cliente = await prisma.cliente.findFirst({
            where: {
              organizationId: orgId,
              nombre: { contains: palabraClave },
              prestamos: { some: { estado: 'activo' } },
            },
            select: {
              prestamos: {
                where: { estado: 'activo' },
                select: { id: true, totalAPagar: true, pagos: { select: { montoPagado: true, tipo: true } } },
                take: 1,
              },
            },
          })
          prestamo = cliente?.prestamos?.[0] || null
          if (prestamo) {
            prestamoIdResuelto = prestamo.id
            input.prestamoId = prestamo.id
          }
        }
        if (prestamo) {
          const pagado = (prestamo.pagos ?? [])
            .filter(p => !['recargo', 'descuento'].includes(p.tipo))
            .reduce((acc, p) => acc + p.montoPagado, 0)
          saldoActual = Math.max(0, prestamo.totalAPagar - pagado)
        }
      } catch {}

      const tipoLabel = { completo: 'Pago completo', parcial: 'Pago parcial' }
      const metodoLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia' }
      const fields = [
        { label: 'Cliente', value: input.clienteNombre },
        { label: 'Monto del pago', value: fmt(input.monto) },
        { label: 'Tipo', value: tipoLabel[input.tipo] || input.tipo },
        { label: 'Método', value: metodoLabel[input.metodoPago] || 'Efectivo' },
      ]
      if (input.plataforma) fields.push({ label: 'Plataforma', value: input.plataforma })
      if (saldoActual !== null) {
        fields.push({ label: 'Saldo actual', value: fmt(saldoActual) })
        fields.push({ label: 'Saldo después del pago', value: fmt(Math.max(0, saldoActual - input.monto)) })
      }
      return { fields, titulo: 'Registrar pago', color: 'success' }
    }
    case 'register_expense': {
      const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
      return {
        fields: [
          { label: 'Descripción', value: input.description },
          { label: 'Monto', value: fmt(input.monto) },
          { label: 'Fecha', value: hoy },
          { label: 'Estado', value: 'Pendiente de aprobación' },
        ],
        titulo: 'Registrar gasto',
        color: 'warning',
      }
    }
    default:
      return { fields: [], titulo: toolName, color: 'info' }
  }
}

// Helper: run a DeepSeek streaming chat and collect tool calls
async function runDeepSeekStream(params, controller, enc, emitTokens = true) {
  const stream = await getDeepSeek().chat.completions.create({ ...params, stream: true })

  let toolCalls = {} // indexed by tool call index
  let textContent = ''

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta
    if (!delta) continue

    // Text tokens
    if (delta.content && emitTokens) {
      textContent += delta.content
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: delta.content })}\n\n`))
    }

    // Tool call deltas — DeepSeek streams them in parts
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index
        if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', arguments: '' }
        if (tc.id) toolCalls[idx].id = tc.id
        if (tc.function?.name) toolCalls[idx].name = tc.function.name
        if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
      }
    }
  }

  // Parse tool call arguments
  const parsedToolCalls = Object.values(toolCalls).map(tc => {
    let input = {}
    try { input = JSON.parse(tc.arguments) } catch {}
    return { id: tc.id, name: tc.name, input }
  }).filter(tc => tc.name)

  return { textContent, toolCalls: parsedToolCalls }
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

  if (isOwner && !planTieneIA(plan)) {
    return NextResponse.json({
      error: 'plan_upgrade_required',
      minPlan: 'growth',
      message: 'El asistente IA está disponible desde el plan Crecimiento. Actualiza tu plan para acceder.',
    }, { status: 403 })
  }

  const rl = getAsistenteLimiter(orgId, plan)
  if (!rl.ok) {
    return NextResponse.json({
      error: 'rate_limit',
      message: `Alcanzaste el límite de consultas por hora. Intenta de nuevo en ${rl.retryAfter} segundos.`,
    }, { status: 429 })
  }

  const body = await req.json()
  const { message, history = [] } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const [ctx, memorias] = await Promise.all([
    isOwner
      ? buildContexto(orgId)
      : buildContextoCobrador(orgId, rutaIds ?? [], session.user.id),
    isOwner ? obtenerMemorias(orgId, session.user.id) : Promise.resolve([]),
  ])

  if (isOwner) ctx.memorias = memorias

  const systemPrompt = isOwner
    ? buildSystemPrompt(ctx)
    : buildSystemPromptCobrador(ctx)

  // DeepSeek: deepseek-chat para todo (mucho más barato que Claude)
  const model = 'deepseek-chat'

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const tools = isOwner ? TOOLS_OWNER : isCobrador ? TOOLS_COBRADOR : undefined

  const streamParams = {
    model,
    max_tokens: isOwner ? 1024 : 600,
    messages,
    ...(tools ? { tools, tool_choice: 'auto' } : {}),
  }

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      try {
        // emitTokens=false: no streamear en vivo. Si el modelo decide llamar
        // una herramienta, el texto que haya escrito ("Voy a buscar a
        // Carlitos...") suele ser una promesa de accion que NUNCA se ejecuta
        // visualmente (el tool_call la reemplaza), asi que se descarta y se
        // muestra el status message correspondiente en su lugar.
        const { textContent, toolCalls } = await runDeepSeekStream(streamParams, controller, enc, false)

        if (toolCalls.length > 0) {
          const toolCall = toolCalls[0]

          // Status message (se descarta cualquier texto que el modelo haya
          // escrito junto al tool_call, para no prometer acciones que el
          // usuario no vera reflejarse).
          const statusMsgs = {
            lookup_client: 'Buscando...',
            create_client: 'Creando cliente...',
            create_loan: 'Preparando préstamo...',
            register_payment: 'Registrando pago...',
            adjust_capital: 'Ajustando capital...',
            create_route: 'Creando ruta...',
            assign_clients_to_route: 'Asignando clientes...',
            edit_loan: 'Editando préstamo...',
            register_expense: 'Registrando gasto...',
            escalate_support: 'Conectando con soporte...',
          }
          const msg = statusMsgs[toolCall.name]
          if (msg) controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'status', text: msg })}\n\n`))

          if (toolCall.name === 'lookup_client') {
            // Búsqueda fuzzy
            const buscar = toolCall.input?.buscar || ''
            const palabras = buscar.trim().split(/\s+/).filter(Boolean)
            const condiciones = palabras.length > 1
              ? palabras.flatMap(p => [{ nombre: { contains: p } }, { cedula: { contains: p } }])
              : [{ nombre: { contains: buscar } }, { cedula: { contains: buscar } }]

            const clientes = await prisma.cliente.findMany({
              where: {
                organizationId: orgId,
                estado: { notIn: ['eliminado'] },
                OR: condiciones,
              },
              select: {
                id: true, nombre: true, cedula: true, telefono: true,
                prestamos: {
                  where: { estado: 'activo' },
                  select: { id: true, totalAPagar: true, cuotaDiaria: true, montoPrestado: true, fechaInicio: true },
                  orderBy: { fechaInicio: 'asc' },
                },
              },
              take: 5,
            })

            const fmtCOP = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

            let lookupResult
            if (clientes.length > 0) {
              lookupResult = clientes.map(c => {
                const ps = c.prestamos ?? []
                if (ps.length === 0) {
                  return `${c.nombre} (cédula: ${c.cedula}, sin préstamo activo) [id:${c.id}]`
                }
                if (ps.length === 1) {
                  const p = ps[0]
                  return `${c.nombre} (cédula: ${c.cedula}, cuota: ${fmtCOP(p.cuotaDiaria)}, saldo: ${fmtCOP(p.totalAPagar)} [pid:${p.id}]) [id:${c.id}]`
                }
                // Múltiples préstamos: listar todos con su pid
                const lista = ps.map((p, i) => `(${i + 1}) cuota ${fmtCOP(p.cuotaDiaria)}, saldo ${fmtCOP(p.totalAPagar)} [pid:${p.id}]`).join(', ')
                return `${c.nombre} (cédula: ${c.cedula}) tiene ${ps.length} préstamos activos: ${lista} [id:${c.id}]`
              }).join(' | ')
            } else {
              const sugeridos = await prisma.cliente.findMany({
                where: { organizationId: orgId, estado: { notIn: ['eliminado', 'inactivo'] }, prestamos: { some: { estado: 'activo' } } },
                select: { nombre: true, cedula: true },
                orderBy: { createdAt: 'desc' },
                take: 3,
              })
              const sugeridosTexto = sugeridos.map(c => `${c.nombre} (cédula: ${c.cedula})`).join(', ')
              lookupResult = `No encontré a nadie con "${buscar}". Clientes activos recientes: ${sugeridosTexto || 'ninguno'}.`
            }

            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'lookup_result', result: lookupResult, clientes })}\n\n`))

            // Segunda llamada con tool result
            const messagesConToolResult = [
              ...messages,
              {
                role: 'assistant',
                content: textContent || '',
                tool_calls: [{
                  id: toolCall.id,
                  type: 'function',
                  function: { name: toolCall.name, arguments: JSON.stringify(toolCall.input) },
                }],
              },
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: lookupResult,
              },
            ]

            // emitTokens=false: no stremear texto libre aqui. Si el modelo "confirma"
            // una accion sin emitir el tool_call correspondiente, el usuario veria
            // "¡Listo, registre tu pago!" sin que nada se haya guardado realmente.
            const { textContent: textContent2, toolCalls: toolCalls2 } = await runDeepSeekStream(
              { ...streamParams, messages: messagesConToolResult },
              controller, enc, false
            )

            // Si la segunda respuesta usa una herramienta (ej: register_payment tras lookup)
            if (toolCalls2.length > 0 && toolCalls2[0].name !== 'lookup_client') {
              const tc2 = toolCalls2[0]
              const displayData2 = await buildDisplayData(tc2.name, tc2.input, orgId)
              controller.enqueue(enc.encode(`data: ${JSON.stringify({
                type: 'action_proposal',
                tool: tc2.name,
                input: tc2.input,
                displayData: displayData2,
              })}\n\n`))
            } else if (textContent2.trim()) {
              // El modelo respondio con texto en vez de proponer la accion. Se
              // entrega tal cual (suele ser una pregunta de aclaracion legitima),
              // pero si "suena" a confirmacion de una accion que nunca se propuso,
              // se corrige para no engañar al usuario.
              const sonaAConfirmacion = /\b(list[oa]|registr[ée]|cre[ée]|guard[ée]|hech[oa]|complet[ao]do)\b/i.test(textContent2)
              const mensaje = sonaAConfirmacion
                ? 'Para registrar esto necesito que confirmes los datos en la tarjeta. ¿Puedes repetirme el monto y a quién es el cobro?'
                : textContent2
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: mensaje })}\n\n`))
            } else {
              // El modelo no devolvio ni accion ni texto (respuesta vacia o
              // repitio lookup_client) — sin esto el bubble queda atascado en
              // "Buscando..." para siempre.
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: '¿Puedes darme más detalles? No logré identificar bien al cliente o la acción.' })}\n\n`))
            }
          } else {
            const displayData = await buildDisplayData(toolCall.name, toolCall.input, orgId)
            controller.enqueue(
              enc.encode(`data: ${JSON.stringify({
                type: 'action_proposal',
                tool: toolCall.name,
                input: toolCall.input,
                displayData,
              })}\n\n`)
            )
          }
        } else if (textContent.trim()) {
          // Sin tool_call: es una respuesta normal (pregunta, dato, aclaracion).
          // Se emite ahora porque runDeepSeekStream no la streameo en vivo.
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: textContent })}\n\n`))
        } else {
          // Respuesta totalmente vacia (sin tool_call ni texto) — sin esto el
          // bubble queda con los puntos de "cargando" para siempre.
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ token: 'No entendí bien, ¿puedes repetirlo de otra forma?' })}\n\n`))
        }

        // fire-and-forget: extraer memoria si hay conversación larga
        if (isOwner && history.length >= 4) {
          const conversacionCompleta = [
            ...history.slice(-6),
            { role: 'user', content: message },
          ]
          setImmediate(() => extraerYGuardarMemoria(orgId, session.user.id, conversacionCompleta))
        }
      } catch (err) {
        console.error('[asistente] Error DeepSeek:', err)
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: 'Error al procesar tu consulta.' })}\n\n`)) } catch {}
      } finally {
        try { controller.enqueue(enc.encode('data: [DONE]\n\n')) } catch {}
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
