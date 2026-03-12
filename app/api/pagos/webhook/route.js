// app/api/pagos/webhook/route.js — Webhook de MercadoPago
import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { paymentApi }   from '@/lib/mercadopago'
import crypto           from 'crypto'
import { enviarEmail, emailPagoAprobado, emailPagoFallido } from '@/lib/email'

// Valores válidos del enum Plan en Prisma/DB
const PLANES_VALIDOS = ["test", "basic", "standard", "professional"]

function sanitizarPlan(planRaw, fallback) {
  fallback = fallback || "basic"
  if (!planRaw) return fallback
  const normalizado = String(planRaw).toLowerCase().trim()
  if (PLANES_VALIDOS.includes(normalizado)) return normalizado
  console.warn("[webhook] Plan desconocido: " + planRaw + " - usando fallback: " + fallback)
  return fallback
}

function verificarFirma(req, body) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true // en dev sin secret, aceptar todo

  const signature = req.headers.get('x-signature')
  const requestId = req.headers.get('x-request-id')
  if (!signature) return false

  // MercadoPago v2 signature format: ts=xxx,v1=xxx
  const parts = {}
  for (const part of signature.split(',')) {
    const [key, val] = part.split('=')
    parts[key.trim()] = val?.trim()
  }

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  // Construir el template para HMAC
  const dataId = body?.data?.id
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  return hmac === v1
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verificar firma
  if (!verificarFirma(req, body)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const { type, data } = body

  // Solo procesar eventos de pago
  if (type !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  try {
    // Consultar el pago completo a MercadoPago
    const payment = await paymentApi.get({ id: data.id })

    const metadata = payment.metadata || {}
    const orgId    = metadata.organization_id  // MP convierte camelCase a snake_case
    const tipo     = metadata.tipo             // 'cobrador_extra' o undefined (plan normal)
    const planRaw  = metadata.plan
    const periodo  = metadata.periodo || 'mensual'
    const status   = payment.status // approved, rejected, cancelled, pending, in_process

    console.log('[webhook] id=' + data.id + ' status=' + status + ' org=' + orgId + ' tipo=' + tipo + ' planRaw=' + planRaw)

    if (!orgId) {
      console.warn('Webhook: pago sin organizationId en metadata', data.id)
      return NextResponse.json({ ok: true })
    }

    // ─── Cobrador extra ─────────────────────────────────────
    if (tipo === 'cobrador_extra') {
      if (status === 'approved') {
        await prisma.organization.update({
          where: { id: orgId },
          data: { cobradoresExtra: { increment: 1 } },
        })
        const admin = await prisma.user.findFirst({ where: { rol: 'superadmin' } })
        if (admin) {
          await prisma.adminLog.create({
            data: {
              adminId:        admin.id,
              organizacionId: orgId,
              accion:         'cobrador_extra_comprado',
              detalle:        `Cobrador extra comprado. MercadoPago #${data.id}. Monto: $${payment.transaction_amount}`,
            },
          })
        }
        console.log('[webhook] cobrador extra agregado para org=' + orgId)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Pago de plan normal ────────────────────────────────
    if (status === 'approved') {
      const plan = sanitizarPlan(planRaw)
      console.log('[webhook] plan sanitizado: ' + planRaw + ' -> ' + plan)

      const ahora     = new Date()
      const diasExtension = periodo === 'trimestral' ? 90 : 30
      const vencimiento = new Date(ahora)
      vencimiento.setDate(vencimiento.getDate() + diasExtension)

      // Buscar suscripción existente o crear nueva
      const subExistente = await prisma.suscripcion.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      })

      if (subExistente) {
        // Si la suscripción actual aún no venció, extender desde la fecha actual de vencimiento
        const baseDate = subExistente.estado === 'activa' && new Date(subExistente.fechaVencimiento) > ahora
          ? new Date(subExistente.fechaVencimiento)
          : ahora
        const nuevaFecha = new Date(baseDate)
        nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension)

        await prisma.suscripcion.update({
          where: { id: subExistente.id },
          data: {
            plan:             plan,
            estado:           'activa',
            fechaVencimiento: nuevaFecha,
            mercadopagoId:    String(data.id),
            montoCOP:         payment.transaction_amount ?? 0,
          },
        })
      } else {
        await prisma.suscripcion.create({
          data: {
            organizationId:   orgId,
            plan:             plan,
            estado:           'activa',
            fechaInicio:      ahora,
            fechaVencimiento: vencimiento,
            mercadopagoId:    String(data.id),
            montoCOP:         payment.transaction_amount ?? 0,
          },
        })
      }

      // Actualizar plan de la organización y activarla
      await prisma.organization.update({
        where: { id: orgId },
        data: { plan: plan, activo: true },
      })

      // Registrar en AdminLog (buscar un superadmin para el log)
      const admin = await prisma.user.findFirst({ where: { rol: 'superadmin' } })
      if (admin) {
        await prisma.adminLog.create({
          data: {
            adminId:        admin.id,
            organizacionId: orgId,
            accion:         'pago_aprobado',
            detalle:        `Pago aprobado por MercadoPago #${data.id}. Plan: ${plan}. Monto: $${payment.transaction_amount}`,
          },
        })
      }
      // Enviar email de confirmación al owner
      const owner = await prisma.user.findFirst({
        where: { organizationId: orgId, rol: 'owner' },
        select: { nombre: true, email: true },
      })
      if (owner) {
        const fechaVenc = subExistente
          ? (await prisma.suscripcion.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }))?.fechaVencimiento
          : vencimiento
        const { subject, html } = emailPagoAprobado({
          nombre: owner.nombre,
          plan: plan,
          monto: payment.transaction_amount ?? 0,
          fechaVencimiento: fechaVenc,
        })
        enviarEmail({ to: owner.email, subject, html }).catch(() => {})
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      const plan = sanitizarPlan(planRaw)
      // Registrar intento fallido
      const admin = await prisma.user.findFirst({ where: { rol: 'superadmin' } })
      if (admin) {
        await prisma.adminLog.create({
          data: {
            adminId:        admin.id,
            organizacionId: orgId,
            accion:         'pago_fallido',
            detalle:        `Pago ${status} en MercadoPago #${data.id}. Plan: ${plan}`,
          },
        })
      }
      // Enviar email de pago fallido
      const ownerFallido = await prisma.user.findFirst({
        where: { organizationId: orgId, rol: 'owner' },
        select: { nombre: true, email: true },
      })
      if (ownerFallido) {
        const { subject, html } = emailPagoFallido({
          nombre: ownerFallido.nombre,
          plan: plan,
          monto: payment.transaction_amount ?? 0,
        })
        enviarEmail({ to: ownerFallido.email, subject, html }).catch(() => {})
      }
    }
    // pending e in_process: no hacer nada, esperar siguiente notificación

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error procesando webhook:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
