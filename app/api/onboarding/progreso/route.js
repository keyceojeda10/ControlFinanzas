import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { debeReabrirse, motivoReapertura } from '@/lib/onboarding-reapertura'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ completado: true, misiones: [] })
  }

  const orgId = session.user.organizationId
  // Se rellena si la guia se REABRE: viaja hasta la respuesta para que la
  // pantalla pueda decir POR QUE ha vuelto.
  let reapertura = null

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { onboardingStep: true, onboardingFlujo: true, createdAt: true, plan: true },
  })

  // ══ LA GUÍA SABE VOLVER ══
  //
  // Esta puerta salía sin mirar nada: una vez en 99, el onboarding no volvía
  // NUNCA. Medido contra producción: 165 cuentas tienen la guía cerrada con
  // cinco clientes o menos, 150 de ellas llevan más de 30 días sin cobrar nada
  // y 35 no han registrado NI UN PAGO en su vida. Un préstamo sin cobros no es
  // haber arrancado: es haber probado el sistema una vez.
  //
  // ⚠ No se reabre a quien trabaja. Las 15 cuentas con pocos clientes que
  // cobran cada semana son negocios pequeños que funcionan, y las 98 con más de
  // cinco clientes no las toca el filtro.
  if ((org?.onboardingStep ?? 0) >= 99) {
    const [clientesActual, ultimo] = await Promise.all([
      prisma.cliente.count({ where: { organizationId: orgId, estado: { notIn: ['eliminado'] } } }),
      prisma.pago.findFirst({
        where: { organizationId: orgId },
        orderBy: { fechaPago: 'desc' },
        select: { fechaPago: true },
      }),
    ])
    const cuenta = {
      onboardingStep: org.onboardingStep,
      clientes: clientesActual,
      ultimoPago: ultimo?.fechaPago ?? null,
    }
    if (!debeReabrirse(cuenta)) {
      return NextResponse.json({ completado: true, misiones: [] })
    }
    // Se reabre de verdad: si solo se devolvieran las misiones sin bajar el
    // paso, la siguiente petición volvería a salir por aquí y el usuario vería
    // la guía aparecer y desaparecer.
    await prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 0 },
    }).catch(() => {})
    org.onboardingStep = 0
    reapertura = motivoReapertura(cuenta)
  }

  // Cuentas antiguas (>14 dias) que YA ARRANCARON: auto-completar.
  // Antes bastaba con tener 1 cliente cargado, asi que a los 14 dias se apagaba
  // la guia de quien nunca habia hecho un prestamo — justo el que mas la
  // necesitaba, y justo cuando se le vencia la prueba. Ahora se exige un
  // prestamo real: cargar clientes no es haber activado nada.
  const diasDesdeCreacion = org?.createdAt
    ? (Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : 0
  //
  // ⚠ Y NO SE APLICA A LO QUE SE ACABA DE REABRIR. Sin este `!reapertura`, la
  // cuenta que se reabre dos bloques más arriba se volvería a cerrar AQUÍ
  // MISMO, en la misma petición: cumple «>14 días» y «tiene un préstamo», que
  // es justo por lo que se cerró la primera vez. La guía habría vuelto y
  // desaparecido sin que nadie la viera.
  if (!reapertura && diasDesdeCreacion > 14) {
    const tienePrestamos = await prisma.prestamo.count({
      where: { organizationId: orgId },
    })
    if (tienePrestamos > 0) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingStep: 99 },
      }).catch(() => {})
      return NextResponse.json({ completado: true, misiones: [] })
    }
  }

  const [clientes, prestamos, pagos, rutas, cierres, cobradores, capital] = await Promise.all([
    prisma.cliente.count({ where: { organizationId: orgId, estado: { notIn: ['eliminado'] } } }),
    prisma.prestamo.count({ where: { organizationId: orgId } }),
    prisma.pago.count({ where: { organizationId: orgId } }),
    prisma.ruta.count({ where: { organizationId: orgId } }),
    prisma.cierreCaja.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, rol: 'cobrador' } }),
    prisma.capital.count({ where: { organizationId: orgId } }),
  ])

  const flujo = org?.onboardingFlujo ?? null
  const esSolo = flujo === 'solo'

  const misiones = [
    {
      id: 'registrar-capital',
      titulo: 'Registra tu capital inicial',
      descripcion: 'Asi la caja siempre te va a cuadrar desde el primer prestamo.',
      completada: capital > 0,
      href: '/caja',
      icono: 'capital',
    },
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

  const misionesFiltradas = esSolo
    ? misiones.filter(m => m.id !== 'crear-cobrador' && m.id !== 'crear-ruta')
    : misiones

  const completadas = misionesFiltradas.filter(m => m.completada).length
  const total = misionesFiltradas.length
  const completado = completadas === total

  // Auto-complete: core completo (cliente + prestamo + pago) => step 99
  //
  // ⚠ TAMPOCO SE APLICA A LO QUE SE ACABA DE REABRIR. Es la TERCERA puerta que
  // cierra el onboarding, y una cuenta parada con un cliente, un préstamo y un
  // pago de hace meses la cumple: sin este `!reapertura` se volvería a cerrar
  // aquí, en la misma petición, y la reapertura no serviría de nada.
  // Las tres puertas hay que abrirlas a la vez o no se abre ninguna.
  const coreCompleto = clientes > 0 && prestamos > 0 && pagos > 0
  if (!reapertura && coreCompleto && (org?.onboardingStep ?? 0) < 99) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 99 },
    }).catch(() => {})
    return NextResponse.json({ completado: true, misiones: [] })
  }

  // Wizard: solo hasta el paso 50. De 50 a 98 el wizard ya se vio y toma el
  // relevo la lista de misiones (que con el umbral viejo en 99 no se renderizo
  // NUNCA: con step<99 ganaba el wizard, y con step>=99 la respuesta salia
  // antes por completado).
  let currentStep = org?.onboardingStep ?? 0

  /* ══ EL PASO 2 SE DA POR HECHO EN CUANTO HAY CLIENTES ══════════════════════
   *
   * Reportado: «creé el cliente manual, me voy al dashboard, y me sigue
   * apareciendo como si todavía debiera crear un usuario cuando ya lo creé».
   *
   * La causa: el paso 2 es «traer tu cartera», y al elegir «escribir el
   * primero» el asistente guarda el paso 2 y manda a `/clientes/nuevo`
   * (`OnboardingWizard.jsx`, `onCero`). El cliente se crea bien… pero NADIE
   * avanza el paso, así que al volver el asistente vuelve a pedir la cartera.
   *
   * Las otras dos vías —foto y Excel— sí avanzan, porque terminan dentro del
   * propio asistente y él llama a `persistStep(3)`. La de a mano se va de la
   * pantalla y no vuelve.
   *
   * ⚠ SE ARREGLA AQUÍ Y NO EN EL FORMULARIO DE CLIENTE. Hay cinco caminos para
   * crear un cliente —el formulario, el migrador, el Excel, el asistente y la
   * carga masiva— y pedirle a cada uno que se acuerde de avisar es garantizar
   * que el sexto se olvide. El paso deja de ser algo que hay que anunciar y
   * pasa a ser algo que se comprueba: si hay clientes, la cartera está traída.
   *
   * `clientes` ya está contado arriba, así que no cuesta una consulta más. */
  const PASO_TRAER_CARTERA = 2
  if (currentStep <= PASO_TRAER_CARTERA && clientes > 0) {
    currentStep = PASO_TRAER_CARTERA + 1
    // Se guarda para que la próxima petición no tenga que volver a deducirlo, y
    // sobre todo para que el asistente no parpadee entre pasos al recargar.
    if ((org?.onboardingStep ?? 0) !== currentStep) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingStep: currentStep },
      }).catch(() => {})
    }
  }

  // ⚠ AL REABRIR NO SE LANZA EL ASISTENTE. Se reabre poniendo el paso en 0, y
  // con paso 0 el wizard se toma la pantalla entera: le saldría la bienvenida
  // —«¿cómo prestas?», «tu capital inicial»— a alguien que lleva meses con la
  // cuenta abierta. Lo que vuelve es la LISTA DE MISIONES, que se puede mirar
  // de reojo y cerrar.
  const showWizard = !reapertura && currentStep >= 0 && currentStep < 50

  let wizardInitialStep = Math.min(currentStep, 3)

  return NextResponse.json({
    completado,
    completadas,
    total,
    progreso: Math.round((completadas / total) * 100),
    misiones: misionesFiltradas,
    showWizard,
    wizardInitialStep,
    flujo,
    plan: org?.plan ?? 'basic',
    // Por qué ha vuelto la guía. Sin decirlo, reaparecer se lee como un fallo
    // del sistema —«esto ya lo hice»—; con el motivo es una mano tendida.
    reapertura,
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
