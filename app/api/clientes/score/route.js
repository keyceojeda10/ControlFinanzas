// app/api/clientes/score/route.js — Score crediticio cross-org
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { scoreLimiter, getClientIp } from '@/lib/rate-limit'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Rate limiting: 10 consultas de score por hora
  const ip = getClientIp(req)
  const rl = scoreLimiter(ip)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Demasiadas consultas. Intenta más tarde.' }, { status: 429 })
  }

  const orgId = session.user.organizationId
  const plan  = session.user.plan

  // Solo planes standard y professional pueden ver el score
  if (!['standard', 'professional'].includes(plan)) {
    return NextResponse.json({ error: 'Función disponible en plan Estándar o superior' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const cedula = searchParams.get('cedula')?.trim()

  if (!cedula || cedula.length < 6) {
    return NextResponse.json({ error: 'Cédula inválida' }, { status: 400 })
  }

  try {
    // Buscar clientes con esa cédula en OTRAS organizaciones
    const clientesOtrasOrgs = await prisma.cliente.findMany({
      where: {
        cedula,
        organizationId: { not: orgId },
      },
      select: {
        id: true,
        organizationId: true,
        prestamos: {
          select: {
            id:           true,
            estado:       true,
            fechaInicio:  true,
            diasPlazo:    true,
            cuotaDiaria:  true,
            frecuencia:   true,
            totalAPagar:  true,
            pagos: {
              select: { montoPagado: true },
            },
          },
        },
      },
    })

    if (!clientesOtrasOrgs.length) {
      return NextResponse.json({
        encontrado: false,
        score: 'gris',
        datos: null,
      })
    }

    // Agregar datos de todas las orgs
    const orgsUnicas = new Set(clientesOtrasOrgs.map(c => c.organizationId))
    let creditosActivos     = 0
    let creditosCompletados = 0
    let creditosEnMora      = 0
    let creditosCancelados  = 0

    for (const cliente of clientesOtrasOrgs) {
      for (const prestamo of cliente.prestamos) {
        if (prestamo.estado === 'completado') {
          creditosCompletados++
        } else if (prestamo.estado === 'cancelado') {
          creditosCancelados++
        } else if (prestamo.estado === 'activo') {
          const diasMora = calcularDiasMora(prestamo)
          if (diasMora > 0) {
            creditosEnMora++
          } else {
            creditosActivos++
          }
        }
      }
    }

    // Determinar score
    let score = 'verde'
    if (creditosEnMora > 0) {
      score = 'rojo'
    } else if (creditosActivos > 0) {
      score = 'amarillo'
    }

    return NextResponse.json({
      encontrado: true,
      score,
      datos: {
        creditosActivos,
        creditosCompletados,
        creditosEnMora,
        creditosCancelados,
        totalOrganizaciones: orgsUnicas.size,
      },
    })
  } catch (err) {
    console.error('[score] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
