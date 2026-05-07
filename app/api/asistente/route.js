// app/api/asistente/route.js — Endpoint de streaming para el asistente Fin
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildContexto, buildSystemPrompt, detectQueryComplexity } from '@/lib/asistente'
import { asistenteLimiter } from '@/lib/rate-limit'
import { planTieneIA } from '@/lib/planes'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req) {
  // ─── Autenticacion ──────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Solo el owner puede usar el asistente
  if (session.user.rol !== 'owner') {
    return NextResponse.json(
      { error: 'Solo el administrador puede usar el asistente' },
      { status: 403 }
    )
  }

  const orgId = session.user.organizationId
  const plan = session.user.plan

  if (!orgId) {
    return NextResponse.json({ error: 'Organizacion no encontrada' }, { status: 400 })
  }

  // ─── Verificacion de plan ───────────────────────────────
  if (!planTieneIA(plan)) {
    return NextResponse.json(
      {
        error: 'plan_upgrade_required',
        minPlan: 'growth',
        message: 'El asistente IA esta disponible desde el plan Crecimiento. Actualiza tu plan para acceder.',
      },
      { status: 403 }
    )
  }

  // ─── Rate limit por orgId ───────────────────────────────
  const rl = asistenteLimiter(orgId)
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: 'rate_limit',
        message: `Alcanzaste el limite de consultas por hora. Intenta de nuevo en ${rl.retryAfter} segundos.`,
      },
      { status: 429 }
    )
  }

  // ─── Validacion de input ────────────────────────────────
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud invalido' }, { status: 400 })
  }

  const { message, history = [] } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Mensaje vacio' }, { status: 400 })
  }

  if (message.trim().length > 1000) {
    return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 400 })
  }

  // ─── Logica de negocio ──────────────────────────────────
  try {
    const ctx = await buildContexto(orgId)
    const systemPrompt = buildSystemPrompt(ctx)
    const complexity = detectQueryComplexity(message)
    const model = complexity === 'simple' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6'

    // Ultimas 6 turns del historial + mensaje actual
    const messages = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const stream = anthropic.messages.stream({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages,
    })

    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        try {
          for await (const chunk of await stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              controller.enqueue(
                enc.encode(`data: ${JSON.stringify({ token: chunk.delta.text })}\n\n`)
              )
            }
          }
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('[asistente] stream error:', err?.message ?? err)
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ error: 'Error al procesar tu consulta.' })}\n\n`)
          )
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
  } catch (err) {
    console.error('[asistente] error:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Error interno. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
