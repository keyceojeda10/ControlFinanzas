// app/api/auth/registro/route.js — Registro de nueva organización
import { NextResponse } from 'next/server'
import bcrypt           from 'bcryptjs'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailBienvenida, emailVerificacion } from '@/lib/email'
import { sendConversionEvent } from '@/lib/facebook-capi'
import { registroLimiter, getClientIp } from '@/lib/rate-limit'
import { PLANES_VALIDOS } from '@/lib/planes'
import { COUNTRY_CODES, getCountryConfig, validatePhone } from '@/lib/i18n'
import { normalizarEmail } from '@/lib/normalizar-email'
import { sendTemplate } from '@/lib/bot/whatsapp-cloud'

function generarCodigoReferido() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CF-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
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
    const { nombreOrganizacion, nombre, email, telefono, password, ref, terminosAceptados, plan, country: countryInput, canal } = body
    const country = COUNTRY_CODES.includes(countryInput) ? countryInput : 'co'

    // Validar plan de trial: todos menos el plan interno de test
    const VALID_TRIAL_PLANS = PLANES_VALIDOS.filter((p) => p !== 'test')
    const planFinal = VALID_TRIAL_PLANS.includes(plan) ? plan : 'starter'

    // Validaciones
    if (!nombreOrganizacion?.trim() || !nombre?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ success: false, error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    const telefonoLimpio = String(telefono || '').replace(/\D/g, '')
    const phoneCfg = getCountryConfig(country)

    // Si el canal es whatsapp, el teléfono es obligatorio y debe ser válido
    const canalRegistro = canal === 'email' ? 'email' : 'whatsapp'
    if (canalRegistro === 'whatsapp') {
      if (!telefonoLimpio) {
        return NextResponse.json({ success: false, error: 'Ingresa tu numero de WhatsApp' }, { status: 400 })
      }
      if (!validatePhone(telefonoLimpio, country)) {
        return NextResponse.json({ success: false, error: `Ingresa un ${phoneCfg.phoneLabel.toLowerCase()} valido (ej: ${phoneCfg.phonePlaceholder})` }, { status: 400 })
      }
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

    // Verificar unicidad de teléfono entre owners (solo si se proporcionó)
    if (telefonoLimpio) {
      const ownerConMismoTel = await prisma.user.findFirst({
        where: { telefono: telefonoLimpio, rol: 'owner' },
        select: { id: true },
      })
      if (ownerConMismoTel) {
        return NextResponse.json({ success: false, error: 'Ya existe una cuenta registrada con ese número de WhatsApp.' }, { status: 409 })
      }
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
          country,
          codigoReferido,
          ...(orgReferidora ? { referidoPorId: orgReferidora.id } : {}),
        },
      })

      // Generar codigo OTP de 6 digitos (expira en 30 min)
      const tokenVerificacion = String(Math.floor(100000 + Math.random() * 900000))
      const tokenExpira = new Date(Date.now() + 30 * 60 * 1000)

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

    // Enviar OTP por WhatsApp si el canal elegido es whatsapp
    if (canalRegistro === 'whatsapp' && resultado.user.telefono) {
      sendTemplate(resultado.user.telefono, 'verificacion_otp', [resultado.user.tokenVerificacion], 'es')
        .catch(e => console.error('[WA OTP]', e.message))
    }

    // Siempre enviar email de verificación como respaldo
    const { subject: svf, html: hvf } = emailVerificacion({ nombre: nombre.trim(), codigo: resultado.user.tokenVerificacion })
    enviarEmail({ to: emailNorm, subject: svf, html: hvf }).catch(e => console.error('[Email] Fallo envio:', e.message))

    // Enviar email de bienvenida en background (no bloquea)
    const vencimiento = new Date()
    vencimiento.setDate(vencimiento.getDate() + 14)
    const { subject, html } = emailBienvenida({
      nombre:           nombre.trim(),
      email:            emailNorm,
      nombreOrg:        nombreOrganizacion.trim(),
      fechaVencimiento: vencimiento,
    })
    enviarEmail({ to: emailNorm, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))

    // Nota: la recompensa de referido (+30 días) se otorga cuando el referido
    // paga su primer plan, no al registrarse. Ver webhook de MercadoPago.

    // Buscar lead de Facebook Ads por teléfono del nuevo usuario y vincularlo
    const leadAsociado = await prisma.lead.findFirst({
      where: { telefono: telefonoLimpio, estado: { not: 'registrado' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, telefono: true },
    }).catch(() => null)

    if (leadAsociado) {
      prisma.lead.update({
        where: { id: leadAsociado.id },
        data: { estado: 'registrado', organizationId: resultado.org.id },
      }).catch(e => console.error('[Registro] Fallo vincular lead FB:', e.message))
    }

    // Vincular BotLead (WhatsApp) por teléfono → marcar como convertido
    prisma.botLead.updateMany({
      where: { telefono: telefonoLimpio, organizationId: null },
      data: { organizationId: resultado.org.id, estado: 'registrado' },
    }).catch(e => console.error('[Registro] Fallo vincular BotLead:', e.message))

    // Facebook CAPI: reportar conversión real con email + teléfono ingresado
    sendConversionEvent({
      eventName: 'CompleteRegistration',
      email: emailNorm,
      phone: telefonoLimpio,
    }).catch(e => console.error('[Email] Fallo envio:', e.message))

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
