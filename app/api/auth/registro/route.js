// app/api/auth/registro/route.js — Registro de nueva organización
import { NextResponse } from 'next/server'
import bcrypt           from 'bcryptjs'
import crypto           from 'crypto'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailBienvenida, emailVerificacion } from '@/lib/email'
import { sendConversionEvent } from '@/lib/facebook-capi'
import { registroLimiter, getClientIp } from '@/lib/rate-limit'
import { PLANES_VALIDOS } from '@/lib/planes'

function generarCodigoReferido() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CF-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Normaliza email: minúsculas + elimina puntos antes del @ (previene duplicados tipo Gmail)
function normalizarEmail(email) {
  const lower = email.trim().toLowerCase()
  const [local, domain] = lower.split('@')
  if (!domain) return lower
  // Quitar puntos solo en la parte local (antes del @)
  return `${local.replace(/\./g, '')}@${domain}`
}

export async function POST(req) {
  try {
    // Rate limiting: 3 registros por IP por hora
    const ip = getClientIp(req)
    const rl = registroLimiter(ip)
    if (!rl.ok) {
      return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
    }

    const body = await req.json()
    const { nombreOrganizacion, nombre, email, telefono, password, ref, terminosAceptados, plan } = body

    // Validar plan de trial: todos menos el plan interno de test
    const VALID_TRIAL_PLANS = PLANES_VALIDOS.filter((p) => p !== 'test')
    const planFinal = VALID_TRIAL_PLANS.includes(plan) ? plan : 'starter'

    // Validaciones
    if (!nombreOrganizacion?.trim() || !nombre?.trim() || !email?.trim() || !password || !telefono?.trim()) {
      return NextResponse.json({ success: false, error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    // Validar telefono colombiano: 10 digitos, empieza en 3
    const telefonoLimpio = String(telefono).replace(/\D/g, '')
    if (!/^3\d{9}$/.test(telefonoLimpio)) {
      return NextResponse.json({ success: false, error: 'Ingresa un celular colombiano valido (10 digitos, empieza en 3)' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    if (!terminosAceptados) {
      return NextResponse.json({ success: false, error: 'Debes aceptar los términos y condiciones' }, { status: 400 })
    }

    // Normalizar email (elimina puntos antes del @ para prevenir duplicados tipo Gmail)
    const emailNorm = normalizarEmail(email)

    // Verificar email único (con email normalizado)
    const existente = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (existente) {
      return NextResponse.json({ success: false, error: 'Este email ya está registrado' }, { status: 400 })
    }

    // Buscar organización referidora antes de la transacción
    let orgReferidora = null
    if (ref?.trim()) {
      orgReferidora = await prisma.organization.findUnique({
        where: { codigoReferido: ref.trim().toUpperCase() },
        select: { id: true, nombre: true },
      })
    }

    const hash = await bcrypt.hash(password, 10)

    // Generar código de referido único para la nueva organización
    let codigoReferido = generarCodigoReferido()
    // Reintentar si hay colisión (extremadamente improbable)
    let intentos = 0
    while (intentos < 5) {
      const existeCodigo = await prisma.organization.findUnique({ where: { codigoReferido } })
      if (!existeCodigo) break
      codigoReferido = generarCodigoReferido()
      intentos++
    }

    // Crear organización + owner + suscripción de prueba en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          nombre:        nombreOrganizacion.trim(),
          plan:          planFinal,
          activo:        true,
          telefono:      telefonoLimpio,
          codigoReferido,
          ...(orgReferidora ? { referidoPorId: orgReferidora.id } : {}),
        },
      })

      // Generar token de verificación de email (expira en 24h)
      const tokenVerificacion = crypto.randomBytes(32).toString('hex')
      const tokenExpira = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const user = await tx.user.create({
        data: {
          nombre:                  nombre.trim(),
          email:                   emailNorm,
          telefono:                telefonoLimpio,
          password:                hash,
          rol:                     'owner',
          organizationId:          org.id,
          emailVerificado:         false,
          tokenVerificacion,
          tokenExpira,
          terminosAceptados:       true,
          fechaAceptacionTerminos: new Date(),
        },
      })

      // Suscripción de prueba: 14 días gratis
      const ahora = new Date()
      const vencimiento = new Date(ahora)
      vencimiento.setDate(vencimiento.getDate() + 14)

      await tx.suscripcion.create({
        data: {
          organizationId:   org.id,
          plan:             planFinal,
          estado:           'activa',
          fechaInicio:      ahora,
          fechaVencimiento: vencimiento,
          montoCOP:         0,
        },
      })

      return { org, user, vencimiento }
    })

    // Enviar email de verificación (obligatorio antes de usar la app)
    const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'
    const linkVerif = `${BASE}/api/auth/verificar-email?token=${resultado.user.tokenVerificacion}`
    const { subject: svf, html: hvf } = emailVerificacion({ nombre: nombre.trim(), link: linkVerif })
    enviarEmail({ to: emailNorm, subject: svf, html: hvf }).catch(() => {})

    // Enviar email de bienvenida en background (no bloquea)
    const vencimiento = new Date()
    vencimiento.setDate(vencimiento.getDate() + 14)
    const { subject, html } = emailBienvenida({
      nombre:           nombre.trim(),
      email:            emailNorm,
      nombreOrg:        nombreOrganizacion.trim(),
      fechaVencimiento: vencimiento,
    })
    enviarEmail({ to: emailNorm, subject, html }).catch(() => {})

    // Nota: la recompensa de referido (+30 días) se otorga cuando el referido
    // paga su primer plan, no al registrarse. Ver webhook de MercadoPago.

    // Buscar lead asociado para vincular y obtener teléfono para CAPI
    const leadAsociado = await prisma.lead.findFirst({
      where: { telefono: { not: '' }, estado: { not: 'registrado' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, telefono: true },
    }).catch(() => null)

    // Si hay un lead reciente sin registrar, vincularlo a esta organización
    if (leadAsociado) {
      prisma.lead.update({
        where: { id: leadAsociado.id },
        data: { estado: 'registrado', organizationId: resultado.org.id },
      }).catch(() => {})
    }

    // Facebook CAPI: reportar conversión real con email + teléfono ingresado
    sendConversionEvent({
      eventName: 'CompleteRegistration',
      email: emailNorm,
      phone: telefonoLimpio,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        ok:             true,
        email:          resultado.user.email,
        organizationId: resultado.org.id,
      },
    })
  } catch (err) {
    console.error('[registro] Error:', err)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
