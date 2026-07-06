import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ completado: true, misiones: [] })
  }

  const orgId = session.user.organizationId

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { onboardingStep: true, onboardingFlujo: true, createdAt: true, plan: true },
  })

  if ((org?.onboardingStep ?? 0) >= 99) {
    return NextResponse.json({ completado: true, misiones: [] })
  }

  // Cuentas antiguas (>14 dias) con datos: auto-completar
  const diasDesdeCreacion = org?.createdAt
    ? (Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : 0
  if (diasDesdeCreacion > 14) {
    const tieneClientes = await prisma.cliente.count({
      where: { organizationId: orgId, estado: { notIn: ['eliminado'] } },
    })
    if (tieneClientes > 0) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingStep: 99 },
      }).catch(() => {})
      return NextResponse.json({ completado: true, misiones: [] })
    }
  }

  const [clientes, prestamos, pagos, rutas, cierres, cobradores] = await Promise.all([
    prisma.cliente.count({ where: { organizationId: orgId, estado: { notIn: ['eliminado'] } } }),
    prisma.prestamo.count({ where: { organizationId: orgId } }),
    prisma.pago.count({ where: { organizationId: orgId } }),
    prisma.ruta.count({ where: { organizationId: orgId } }),
    prisma.cierreCaja.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, rol: 'cobrador' } }),
  ])

  const misiones = [
    {
      id: 'crear-cliente',
      titulo: 'Sube tu cartera de clientes',
      descripcion: 'Usa el migrador, tómale foto a tu cuaderno, o sube un Excel.',
      completada: clientes > 0,
      href: '/migrador',
      icono: 'cliente',
    },
    {
      id: 'crear-prestamo',
      titulo: 'Crea un préstamo',
      descripcion: 'El sistema calcula la cuota y lleva el saldo automáticamente.',
      completada: prestamos > 0,
      href: clientes > 0 ? '/prestamos/nuevo' : '/migrador',
      icono: 'prestamo',
    },
    {
      id: 'registrar-pago',
      titulo: 'Registra el primer cobro',
      descripcion: 'Abre el préstamo y toca "Registrar pago". Funciona sin internet.',
      completada: pagos > 0,
      href: '/prestamos',
      icono: 'pago',
    },
    {
      id: 'crear-ruta',
      titulo: 'Crea una ruta de cobro',
      descripcion: 'Agrupa clientes por zona. El cobrador ve su recorrido del día.',
      completada: rutas > 0,
      href: '/rutas',
      icono: 'ruta',
    },
    {
      id: 'crear-cobrador',
      titulo: 'Agrega un cobrador',
      descripcion: 'Crea su cuenta. El cobra desde su celular y tu ves el reporte en tiempo real.',
      completada: cobradores > 0,
      href: '/cobradores/nuevo',
      icono: 'cobrador',
    },
    {
      id: 'instalar-app',
      titulo: 'Instala la app en tu celular',
      descripcion: 'Accede mas rápido y cobra sin internet. Instala desde el navegador.',
      completada: false,
      href: '#',
      icono: 'instalar',
      clientCheck: 'pwa-installed',
    },
    {
      id: 'cierre-caja',
      titulo: 'Haz tu primer cierre de caja',
      descripcion: 'Cuadra lo recaudado del día y lleva tu contabilidad al día.',
      completada: cierres > 0,
      href: '/caja',
      icono: 'caja',
    },
  ]

  const completadas = misiones.filter(m => m.completada).length
  const total = misiones.length
  const completado = completadas === total

  // Auto-complete: core completo (cliente + prestamo + pago) => step 99
  const coreCompleto = clientes > 0 && prestamos > 0 && pagos > 0
  if (coreCompleto && (org?.onboardingStep ?? 0) < 99) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 99 },
    }).catch(() => {})
    return NextResponse.json({ completado: true, misiones: [] })
  }

  // Wizard: se muestra para cualquier step entre 0 y 98
  const currentStep = org?.onboardingStep ?? 0
  const showWizard = currentStep >= 0 && currentStep < 99

  // Calcular paso efectivo del wizard cruzando con datos reales
  const flujo = org?.onboardingFlujo ?? null
  let wizardInitialStep = currentStep

  // Si ya hay datos creados, avanzar el paso efectivo
  if (flujo === 'solo') {
    if (wizardInitialStep < 3 && clientes > 0) wizardInitialStep = 3
    if (wizardInitialStep < 4 && prestamos > 0) wizardInitialStep = 4
  } else if (flujo === 'equipo') {
    if (wizardInitialStep < 4 && cobradores > 0 && rutas > 0) wizardInitialStep = 4
    if (wizardInitialStep < 4 && clientes > 0) wizardInitialStep = 4
    if (wizardInitialStep < 5 && prestamos > 0) wizardInitialStep = 5
  }

  return NextResponse.json({
    completado,
    completadas,
    total,
    progreso: Math.round((completadas / total) * 100),
    misiones,
    showWizard,
    wizardInitialStep,
    flujo,
    plan: org?.plan ?? 'basic',
  })
}

// Persist onboarding step + flujo, or dismiss
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { action, step, flujo } = body

  if (action === 'dismiss') {
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { onboardingStep: 99 },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'progress') {
    const data = {}
    if (typeof step === 'number' && step >= 0 && step <= 99) {
      data.onboardingStep = step
    }
    if (flujo === 'solo' || flujo === 'equipo') {
      data.onboardingFlujo = flujo
    }
    if (Object.keys(data).length > 0) {
      await prisma.organization.update({
        where: { id: session.user.organizationId },
        data,
      })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción invalida' }, { status: 400 })
}
