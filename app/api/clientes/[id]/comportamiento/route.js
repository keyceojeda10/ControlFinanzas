import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { comportamiento12Meses, lecturaDe } from '@/lib/comportamiento'

// GET /api/clientes/[id]/comportamiento — los 12 meses del cliente.
//
// ══ PARA QUE ═══════════════════════════════════════════════════════════════
//
// La barra de doce meses de T15-01 y la ficha de cliente (C10) llevaban
// semanas BLOQUEADAS por esto: el dato no existia en ninguna parte. No era
// trabajo de diseño, era este endpoint.
//
// Aqui NO se calcula nada: solo se traen los datos y se los pasa a
// `lib/comportamiento.js`, que es donde vive la definicion y donde hay 21
// pruebas que la fijan. Repartir la aritmetica del dinero entre la ruta y la
// libreria es como se acaba con dos formulas que no coinciden.
//
// La definicion, resumida: `pagado en el mes ÷ (cuota × cobros que tocaban)`.
// Se eligio asi porque medido contra la cartera real solo el 8% de los
// prestamos tiene tabla de amortizacion guardada — comparar contra ella seria
// exacto y dejaria la barra vacia para el 92% de los clientes.

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const organizationId = session.user.organizationId
  if (!organizationId) return Response.json({ error: 'Sin organización' }, { status: 400 })

  const { id } = await params

  const cliente = await prisma.cliente.findFirst({
    // `organizationId` en el where y no solo el id: sin eso, cualquiera con un
    // id ajeno leeria el historial de pagos de otro negocio.
    where: { id, organizationId, eliminadoEn: null },
    select: {
      id: true,
      diasSinCobro: true,
      ruta: { select: { diasSinCobro: true } },
      prestamos: {
        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
          estado: true,
          ultimoPagoAt: true,
          cuotaDiaria: true,
          frecuencia: true,
        },
      },
    },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const hace12 = new Date()
  hace12.setMonth(hace12.getMonth() - 12)

  const [org, pagos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    // Los pagos de TODOS sus prestamos, no solo los activos: un mes en que
    // cumplio con un prestamo ya cerrado sigue siendo un mes en que cumplio.
    prisma.pago.findMany({
      where: {
        prestamo: { clienteId: cliente.id, organizationId },
        fechaPago: { gte: hace12 },
      },
      select: { fechaPago: true, montoPagado: true },
    }),
  ])

  // ── HASTA CUANDO SE ESPERABAN PAGOS DE CADA PRESTAMO ──
  //
  // No hay columna de «cerrado el». Y `fechaFin` NO sirve: es el final del
  // CALENDARIO, no el del prestamo — aqui el prestamo se cobra hasta saldar,
  // asi que uno al dia puede pasarse de su fechaFin y seguir vivo.
  //
  // Lo mas cercano que existe es `ultimoPagoAt`: cuando dejo de entrar plata.
  // Para un prestamo ya no activo es una buena marca de «hasta aqui se
  // esperaba»; si nunca tuvo pagos, se cae a `fechaFin`.
  const prestamos = cliente.prestamos.map((p) => ({
    ...p,
    fechaCierre: p.estado === 'activo' ? null : (p.ultimoPagoAt ?? p.fechaFin),
  }))

  const meses = comportamiento12Meses({
    prestamos,
    pagos,
    diasSinCobro: obtenerDiasSinCobro(cliente, cliente.ruta, org),
  })

  return Response.json({
    meses,
    lectura: lecturaDe(meses),
    // Se dice de donde sale la cifra. Es una aproximacion para leer la
    // TENDENCIA, y ninguna pantalla debe cobrar nada a partir de esto.
    comoSeCalcula: 'Lo pagado en el mes sobre lo que tocaba pagar (cuota × cobros del mes, sin los días sin cobro).',
  })
}
