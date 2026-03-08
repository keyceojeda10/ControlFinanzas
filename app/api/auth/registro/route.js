// app/api/auth/registro/route.js — Registro de nueva organización
import { NextResponse } from 'next/server'
import bcrypt           from 'bcryptjs'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailBienvenida, emailReferidoExitoso } from '@/lib/email'

function generarCodigoReferido() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CF-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { nombreOrganizacion, nombre, email, password, ref } = body

    // Validaciones
    if (!nombreOrganizacion?.trim() || !nombre?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ success: false, error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Verificar email único
    const existente = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
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
          plan:          'basic',
          activo:        true,
          codigoReferido,
          ...(orgReferidora ? { referidoPorId: orgReferidora.id } : {}),
        },
      })

      const user = await tx.user.create({
        data: {
          nombre:         nombre.trim(),
          email:          email.trim().toLowerCase(),
          password:       hash,
          rol:            'owner',
          organizationId: org.id,
        },
      })

      // Suscripción de prueba: 7 días gratis
      const ahora = new Date()
      const vencimiento = new Date(ahora)
      vencimiento.setDate(vencimiento.getDate() + 7)

      await tx.suscripcion.create({
        data: {
          organizationId:   org.id,
          plan:             'basic',
          estado:           'activa',
          fechaInicio:      ahora,
          fechaVencimiento: vencimiento,
          montoCOP:         0,
        },
      })

      return { org, user, vencimiento }
    })

    // Enviar email de bienvenida al nuevo usuario (no bloquea la respuesta)
    const vencimiento = new Date()
    vencimiento.setDate(vencimiento.getDate() + 7)
    const { subject, html } = emailBienvenida({
      nombre:           nombre.trim(),
      email:            email.trim().toLowerCase(),
      nombreOrg:        nombreOrganizacion.trim(),
      fechaVencimiento: vencimiento,
    })
    enviarEmail({ to: email.trim().toLowerCase(), subject, html }).catch(() => {})

    // Si hubo referido: extender suscripción del referidor y notificarle
    if (orgReferidora) {
      try {
        const subRef = await prisma.suscripcion.findFirst({
          where:   { organizationId: orgReferidora.id },
          orderBy: { createdAt: 'desc' },
        })

        if (subRef) {
          const baseDate =
            subRef.estado === 'activa' && new Date(subRef.fechaVencimiento) > new Date()
              ? new Date(subRef.fechaVencimiento)
              : new Date()
          const nuevaFecha = new Date(baseDate)
          nuevaFecha.setDate(nuevaFecha.getDate() + 30)
          await prisma.suscripcion.update({
            where: { id: subRef.id },
            data:  { fechaVencimiento: nuevaFecha, estado: 'activa' },
          })
        }

        // Notificar al owner de la organización referidora
        const ownerRef = await prisma.user.findFirst({
          where:  { organizationId: orgReferidora.id, rol: 'owner' },
          select: { nombre: true, email: true },
        })
        if (ownerRef) {
          const { subject: subRef2, html: htmlRef } = emailReferidoExitoso({
            nombre:         ownerRef.nombre,
            nombreReferido: nombreOrganizacion.trim(),
          })
          enviarEmail({ to: ownerRef.email, subject: subRef2, html: htmlRef }).catch(() => {})
        }
      } catch (errRef) {
        // El error en el flujo del referido no debe bloquear el registro exitoso
        console.error('[registro] Error procesando recompensa de referido:', errRef)
      }
    }

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
