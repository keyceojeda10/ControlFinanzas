// app/api/auth/registro/route.js — Registro de nueva organización
import { NextResponse } from 'next/server'
import bcrypt           from 'bcryptjs'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailBienvenida } from '@/lib/email'

export async function POST(req) {
  const body = await req.json()
  const { nombreOrganizacion, nombre, email, password } = body

  // Validaciones
  if (!nombreOrganizacion?.trim() || !nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  // Verificar email único
  const existente = await prisma.user.findUnique({ where: { email } })
  if (existente) {
    return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 10)

  // Crear organización + owner + suscripción de prueba en transacción
  const resultado = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        nombre: nombreOrganizacion.trim(),
        plan:   'basic',
        activo: true,
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

  // Enviar email de bienvenida (no bloquea la respuesta)
  const vencimiento = new Date()
  vencimiento.setDate(vencimiento.getDate() + 7)
  const { subject, html } = emailBienvenida({
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    nombreOrg: nombreOrganizacion.trim(),
    fechaVencimiento: vencimiento,
  })
  enviarEmail({ to: email.trim().toLowerCase(), subject, html }).catch(() => {})

  return NextResponse.json({
    ok: true,
    email: resultado.user.email,
    organizationId: resultado.org.id,
  })
}
