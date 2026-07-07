// app/api/pagos/webhook/route.js — Webhook de MercadoPago
import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import { paymentApi, preApprovalApi } from '@/lib/mercadopago'
import crypto           from 'crypto'
import { enviarEmail, emailPagoAprobado, emailPagoFallido, emailReferidoExitoso } from '@/lib/email'
import { webhookLimiter, getClientIp } from '@/lib/rate-limit'
import { registrarAdminLog } from '@/lib/admin-log'

import { PLANES_VALIDOS } from '@/lib/planes'

function sanitizarPlan(planRaw, fallback) {
  fallback = fallback || "basic"
  if (!planRaw) return fallback
  const normalizado = String(planRaw).toLowerCase().trim()
  if (PLANES_VALIDOS.includes(normalizado)) return normalizado
  // ALERTA: metadata de MercadoPago trae un plan que no existe en PLANES_VALIDOS.
  // Se aplica el fallback para no romper el pago, pero esto requiere revision
  // manual (posible bug al generar la preferencia o cambio no sincronizado en lib/planes.js).
  console.warn(
    "\n" +
    "########## [webhook] ALERTA: PLAN INVALIDO EN METADATA DE MERCADOPAGO ##########\n" +
    "  planRecibido: " + JSON.stringify(planRaw) + "\n" +
    "  planesValidos: " + PLANES_VALIDOS.join(", ") + "\n" +
    "  fallbackAplicado: " + fallback + "\n" +
    "  ACCION REQUERIDA: revisar manualmente esta organizacion/pago en MercadoPago.\n" +
    "#################################################################################\n"
  )
  return fallback
}

function verificarFirma(req, body) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return false // rechazar si no hay secret configurado

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

  // Comparación segura contra timing attacks
  try {
    const hmacBuf = Buffer.from(hmac, 'hex')
    const v1Buf = Buffer.from(v1, 'hex')
    if (hmacBuf.length !== v1Buf.length) return false
    return crypto.timingSafeEqual(hmacBuf, v1Buf)
  } catch {
    return false
  }
}

export async function POST(req) {
  const rl = webhookLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

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

  // ─── Suscripción recurrente: cambio de estado ─────────────
  if (type === 'subscription_preapproval') {
    try {
      const preapproval = await preApprovalApi.get({ id: data.id })
      const mpStatus = preapproval.status // authorized, paused, cancelled, pending

      const sub = await prisma.suscripcion.findFirst({
        where: { preapprovalId: String(data.id) },
      })
      if (!sub) {
        console.warn('[webhook] subscription_preapproval sin suscripción local:', data.id)
        return NextResponse.json({ ok: true })
      }

      console.log('[webhook] subscription_preapproval id=' + data.id + ' status=' + mpStatus + ' org=' + sub.organizationId)

      await prisma.suscripcion.update({
        where: { id: sub.id },
        data: { mpStatus },
      })

      // Si MP canceló la suscripción (no el usuario)
      if (mpStatus === 'cancelled' && !sub.canceladaAt) {
        await prisma.suscripcion.update({
          where: { id: sub.id },
          data: { canceladaAt: new Date(), motivoCancelacion: 'Cancelada por MercadoPago' },
        })
      }

      // Si fue autorizada (primer pago exitoso), activar la org y extender
      if (mpStatus === 'authorized' && sub.mpStatus === 'pending') {
        const ahora = new Date()
        const nuevaFecha = new Date(ahora)
        nuevaFecha.setMonth(nuevaFecha.getMonth() + sub.frecuenciaMeses)

        const plan = sanitizarPlan(sub.plan)
        await prisma.suscripcion.update({
          where: { id: sub.id },
          data: {
            estado:           'activa',
            fechaInicio:      ahora,
            fechaVencimiento: nuevaFecha,
            ultimoCobroAt:    ahora,
            proximoCobroAt:   nuevaFecha,
          },
        })
        await prisma.organization.update({
          where: { id: sub.organizationId },
          data: { plan, activo: true },
        })
        console.log('[webhook] suscripción autorizada para org=' + sub.organizationId + ' plan=' + plan)

        // Email de confirmación
        const owner = await prisma.user.findFirst({
          where: { organizationId: sub.organizationId, rol: 'owner' },
          select: { nombre: true, email: true },
        })
        if (owner) {
          const { subject, html } = emailPagoAprobado({
            nombre: owner.nombre,
            plan,
            monto: sub.montoCOP,
            fechaVencimiento: nuevaFecha,
          })
          enviarEmail({ to: owner.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
        }
      }

      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('[webhook] Error procesando subscription_preapproval:', err)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
  }

  // ─── Suscripción recurrente: cobro periódico ──────────────
  if (type === 'subscription_authorized_payment') {
    try {
      // Consultar el cobro de suscripción
      const res = await fetch(
        `https://api.mercadopago.com/authorized_payments/${data.id}`,
        { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` } }
      )
      const invoice = await res.json()

      const preapprovalId = invoice.preapproval_id
      const status = invoice.payment?.status || invoice.status // approved, rejected

      console.log('[webhook] subscription_authorized_payment id=' + data.id + ' preapproval=' + preapprovalId + ' status=' + status)

      const sub = await prisma.suscripcion.findFirst({
        where: { preapprovalId: String(preapprovalId) },
      })
      if (!sub) {
        console.warn('[webhook] cobro de suscripción sin registro local, preapproval=' + preapprovalId)
        return NextResponse.json({ ok: true })
      }

      if (status === 'approved') {
        const ahora = new Date()
        const baseDate = sub.fechaVencimiento && new Date(sub.fechaVencimiento) > ahora
          ? new Date(sub.fechaVencimiento)
          : ahora
        const nuevaFecha = new Date(baseDate)
        nuevaFecha.setMonth(nuevaFecha.getMonth() + sub.frecuenciaMeses)

        const plan = sanitizarPlan(sub.plan)
        await prisma.suscripcion.update({
          where: { id: sub.id },
          data: {
            estado:           'activa',
            mpStatus:         'authorized',
            fechaVencimiento: nuevaFecha,
            ultimoCobroAt:    ahora,
            proximoCobroAt:   nuevaFecha,
            montoCOP:         invoice.transaction_amount ?? sub.montoCOP,
            mercadopagoId:    String(data.id),
          },
        })
        await prisma.organization.update({
          where: { id: sub.organizationId },
          data: { plan, activo: true },
        })

        await registrarAdminLog({
          organizacionId: sub.organizationId,
          accion:         'cobro_recurrente_aprobado',
          detalle:        `Cobro recurrente aprobado. Suscripción #${preapprovalId}. Monto: $${invoice.transaction_amount}`,
        })

        // Email al owner
        const owner = await prisma.user.findFirst({
          where: { organizationId: sub.organizationId, rol: 'owner' },
          select: { nombre: true, email: true },
        })
        if (owner) {
          const { subject, html } = emailPagoAprobado({
            nombre: owner.nombre,
            plan,
            monto: invoice.transaction_amount ?? sub.montoCOP,
            fechaVencimiento: nuevaFecha,
          })
          enviarEmail({ to: owner.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
        }
      } else if (status === 'rejected') {
        // No desactivar — MP reintenta automáticamente
        await registrarAdminLog({
          organizacionId: sub.organizationId,
          accion:         'cobro_recurrente_fallido',
          detalle:        `Cobro recurrente rechazado. Suscripción #${preapprovalId}. MP reintentará.`,
        })
        const ownerFallido = await prisma.user.findFirst({
          where: { organizationId: sub.organizationId, rol: 'owner' },
          select: { nombre: true, email: true },
        })
        if (ownerFallido) {
          const { subject, html } = emailPagoFallido({
            nombre: ownerFallido.nombre,
            plan: sub.plan,
            monto: invoice.transaction_amount ?? sub.montoCOP,
          })
          enviarEmail({ to: ownerFallido.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
        }
      }

      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('[webhook] Error procesando subscription_authorized_payment:', err)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
  }

  // Solo procesar eventos de pago único
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
        await registrarAdminLog({
          organizacionId: orgId,
          accion:         'cobrador_extra_comprado',
          detalle:        `Cobrador extra comprado. MercadoPago #${data.id}. Monto: $${payment.transaction_amount}`,
        })
        console.log('[webhook] cobrador extra agregado para org=' + orgId)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Ruta extra ───────────────────────────────────────
    if (tipo === 'ruta_extra') {
      if (status === 'approved') {
        await prisma.organization.update({
          where: { id: orgId },
          data: { rutasExtra: { increment: 1 } },
        })
        await registrarAdminLog({
          organizacionId: orgId,
          accion:         'ruta_extra_comprada',
          detalle:        `Ruta extra comprada. MercadoPago #${data.id}. Monto: $${payment.transaction_amount}`,
        })
        console.log('[webhook] ruta extra agregada para org=' + orgId)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Pago de plan normal ────────────────────────────────
    if (status === 'approved') {
      const plan = sanitizarPlan(planRaw)
      console.log('[webhook] plan sanitizado: ' + planRaw + ' -> ' + plan)

      const ahora     = new Date()
      const diasExtension = periodo === 'anual' ? 365 : periodo === 'trimestral' ? 90 : 30
      const vencimiento = new Date(ahora)
      vencimiento.setDate(vencimiento.getDate() + diasExtension)

      // ─── Sección crítica: check-then-act de idempotencia ────
      // Dos notificaciones "approved" idénticas de MP pueden llegar casi
      // simultáneamente. Sin aislamiento, ambas pasarían el findFirst antes
      // de que cualquiera cree/actualice el registro, duplicando la
      // extensión de la suscripción (+30/90/365 días aplicados dos veces).
      // Serializable fuerza a que la segunda transacción vea los cambios
      // de la primera (o falle con conflicto de serialización, que se
      // trata como "ya procesado" más abajo).
      let subExistente = null
      let yaProcesado = false
      try {
        subExistente = await prisma.$transaction(async (tx) => {
          const procesado = await tx.suscripcion.findFirst({
            where: { mercadopagoId: String(data.id) },
          })
          if (procesado) {
            yaProcesado = true
            return procesado
          }

          // Buscar suscripción existente (ignorar pending de MP nunca completadas)
          const sub = await tx.suscripcion.findFirst({
            where: {
              organizationId: orgId,
              OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
            },
            orderBy: { fechaVencimiento: 'desc' },
          })

          if (sub) {
            // Si la suscripción actual aún no venció, extender desde la fecha actual de vencimiento
            const baseDate = sub.estado === 'activa' && new Date(sub.fechaVencimiento) > ahora
              ? new Date(sub.fechaVencimiento)
              : ahora
            const nuevaFecha = new Date(baseDate)
            nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension)

            const actualizada = await tx.suscripcion.update({
              where: { id: sub.id },
              data: {
                plan:             plan,
                estado:           'activa',
                fechaVencimiento: nuevaFecha,
                mercadopagoId:    String(data.id),
                montoCOP:         payment.transaction_amount ?? 0,
              },
            })
            await tx.organization.update({
              where: { id: orgId },
              data: { plan: plan, activo: true },
            })
            return actualizada
          }

          const creada = await tx.suscripcion.create({
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
          await tx.organization.update({
            where: { id: orgId },
            data: { plan: plan, activo: true },
          })
          return creada
        }, { isolation: 'Serializable' })
      } catch (txErr) {
        // Conflicto de serialización (dos transacciones concurrentes
        // pisandose) o deadlock de MySQL/MariaDB: la otra notificación
        // concurrente ya completó el trabajo, así que tratamos esta como
        // procesada y no reintentamos para no duplicar la extensión.
        console.warn('[webhook] conflicto de concurrencia procesando payment ' + data.id + ', tratando como ya procesado: ' + txErr.message)
        return NextResponse.json({ ok: true })
      }

      if (yaProcesado) {
        console.log('[webhook] payment ' + data.id + ' ya procesado, ignorando reenvio')
        return NextResponse.json({ ok: true })
      }

      // ─── Recompensa de referido ──────────────────────────────
      // Si esta org fue referida, verificar si es su primer pago y recompensar al referidor
      const orgData = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { referidoPorId: true },
      })
      if (orgData?.referidoPorId) {
        // Contar pagos aprobados previos de esta org (excluyendo el actual)
        const pagosAnteriores = await prisma.suscripcion.count({
          where: { organizationId: orgId },
        })
        // Si solo hay 1 suscripción (la que acabamos de crear/actualizar), es el primer pago
        if (pagosAnteriores <= 1) {
          const subReferidor = await prisma.suscripcion.findFirst({
            where: {
              organizationId: orgData.referidoPorId,
              OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
            },
            orderBy: { fechaVencimiento: 'desc' },
          })
          if (subReferidor) {
            const baseRef = subReferidor.estado === 'activa' && new Date(subReferidor.fechaVencimiento) > ahora
              ? new Date(subReferidor.fechaVencimiento)
              : ahora
            const nuevaFechaRef = new Date(baseRef)
            nuevaFechaRef.setDate(nuevaFechaRef.getDate() + 30)
            await prisma.suscripcion.update({
              where: { id: subReferidor.id },
              data: { fechaVencimiento: nuevaFechaRef },
            })
            console.log('[webhook] +30 días para referidor org=' + orgData.referidoPorId + ' por referido org=' + orgId)

            // Notificar al referidor por email
            const ownerRef = await prisma.user.findFirst({
              where: { organizationId: orgData.referidoPorId, rol: 'owner' },
              select: { id: true, nombre: true, email: true, emailsMarketing: true },
            })
            if (ownerRef && ownerRef.emailsMarketing) {
              const orgReferida = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { nombre: true },
              })
              const { subject: sRef, html: hRef } = emailReferidoExitoso({
                nombre: ownerRef.nombre,
                nombreReferido: orgReferida?.nombre || 'Un referido',
                userId: ownerRef.id,
              })
              enviarEmail({ to: ownerRef.email, subject: sRef, html: hRef }).catch(e => console.error('[Email] Fallo envio:', e.message))
            }
          }
        }
      }

      await registrarAdminLog({
        organizacionId: orgId,
        accion:         'pago_aprobado',
        detalle:        `Pago aprobado por MercadoPago #${data.id}. Plan: ${plan}. Monto: $${payment.transaction_amount}`,
      })
      // Enviar email de confirmación al owner
      const owner = await prisma.user.findFirst({
        where: { organizationId: orgId, rol: 'owner' },
        select: { nombre: true, email: true },
      })
      if (owner) {
        const fechaVenc = subExistente
          ? (await prisma.suscripcion.findFirst({ where: { organizationId: orgId, OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] }, orderBy: { fechaVencimiento: 'desc' } }))?.fechaVencimiento
          : vencimiento
        const { subject, html } = emailPagoAprobado({
          nombre: owner.nombre,
          plan: plan,
          monto: payment.transaction_amount ?? 0,
          fechaVencimiento: fechaVenc,
        })
        enviarEmail({ to: owner.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      const plan = sanitizarPlan(planRaw)
      await registrarAdminLog({
        organizacionId: orgId,
        accion:         'pago_fallido',
        detalle:        `Pago ${status} en MercadoPago #${data.id}. Plan: ${plan}`,
      })
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
        enviarEmail({ to: ownerFallido.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
      }
    }
    // pending e in_process: no hacer nada, esperar siguiente notificación

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error procesando webhook:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
