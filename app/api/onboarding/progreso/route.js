import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Auto-detect onboarding progress based on actual data
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ completado: true, misiones: [] })
  }

  const orgId = session.user.organizationId

  // Check if onboarding was dismissed
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { onboardingStep: true },
  })

  if (org?.onboardingStep >= 99) {
    return NextResponse.json({ completado: true, misiones: [] })
  }

  // Count actual data to auto-detect progress
  const [clientes, prestamos, pagos, rutas, cierres] = await Promise.all([
    prisma.cliente.count({ where: { organizationId: orgId, estado: { notIn: ['eliminado'] } } }),
    prisma.prestamo.count({ where: { organizationId: orgId } }),
    prisma.pago.count({ where: { organizationId: orgId } }),
    prisma.ruta.count({ where: { organizationId: orgId } }),
    prisma.cierreCaja.count({ where: { organizationId: orgId } }),
  ])

  const misiones = [
    {
      id: 'crear-cliente',
      titulo: 'Crea tu primer cliente',
      descripcion: 'Registra nombre, cedula y telefono',
      completada: clientes > 0,
      href: '/clientes/nuevo',
      icono: 'cliente',
    },
    {
      id: 'crear-prestamo',
      titulo: 'Crea tu primer prestamo',
      descripcion: 'Define monto, tasa y plazo',
      completada: prestamos > 0,
      href: '/prestamos/nuevo',
      icono: 'prestamo',
    },
    {
      id: 'registrar-pago',
      titulo: 'Registra un pago',
      descripcion: 'Cobra la primera cuota',
      completada: pagos > 0,
      href: '/prestamos',
      icono: 'pago',
    },
    {
      id: 'crear-ruta',
      titulo: 'Crea una ruta de cobro',
      descripcion: 'Organiza tus clientes por zona',
      completada: rutas > 0,
      href: '/rutas',
      icono: 'ruta',
    },
    {
      id: 'cierre-caja',
      titulo: 'Haz un cierre de caja',
      descripcion: 'Cuadra los numeros del dia',
      completada: cierres > 0,
      href: '/caja',
      icono: 'caja',
    },
  ]

  const completadas = misiones.filter(m => m.completada).length
  const total = misiones.length
  const completado = completadas === total

  // Auto-complete onboarding when all missions done
  if (completado && org?.onboardingStep < 99) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 99 },
    }).catch(() => {})
  }

  // Wizard shows only for brand-new orgs with zero clients
  const showWizard = org?.onboardingStep === 0 && clientes === 0

  // If user created a client in the wizard but left before creating a loan
  const wizardInitialStep = (org?.onboardingStep === 0 && clientes > 0 && prestamos === 0) ? 2 : 0

  return NextResponse.json({
    completado,
    completadas,
    total,
    progreso: Math.round((completadas / total) * 100),
    misiones,
    showWizard,
    wizardInitialStep,
  })
}

// Dismiss onboarding
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { action } = await request.json().catch(() => ({}))

  if (action === 'dismiss') {
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { onboardingStep: 99 },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
}
