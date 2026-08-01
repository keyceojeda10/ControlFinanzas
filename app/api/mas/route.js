// app/api/mas/route.js
//
// Las cifras de la pantalla "Más" (turno 41·03) en una sola petición.
//
// POR QUÉ UN ENDPOINT Y NO SEIS FETCH:
// la pantalla necesita seis cifras de seis sitios distintos. Seis peticiones
// desde un teléfono en la calle son seis oportunidades de que una llegue tarde
// y la fila salga sin su número — y una fila sin cifra es justo lo que esta
// pantalla existe para evitar.
//
// NO SE REDERIVA PLATA. Cada cifra sale del mismo sitio que ya la calcula:
// `Capital.saldo` es el mismo campo que /api/caja publica como `saldoActual`,
// y los clavos salen de la misma bandera `esClavo` que usa /api/clavos. Volver
// a calcularlas aquí seria abrir una segunda version de la verdad, que es
// exactamente el defecto que este rediseño vino a corregir.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset } from '@/lib/i18n'

/** Primer día del mes en curso, en la hora local del negocio. */
function inicioDeMes(country = 'co') {
  const ahora = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1, 5, 0, 0))
}

/** Medianoche de hoy, mismo convenio de fechas que el resto del sistema. */
function hoyLocal(country = 'co') {
  const ahora = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 5, 0, 0))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  // Un superadmin no tiene organizationId: sin esta guarda, las consultas de
  // abajo se lo llevan por delante.
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { organizationId } = session.user

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { country: true },
  })
  const pais = org?.country || 'co'
  const desdeMes = inicioDeMes(pais)
  const hoy = hoyLocal(pais)

  const [capital, gastosMes, cobradores, cobradoresConCobroHoy, clavos, socios, usuarios] =
    await Promise.all([
      prisma.capital.findFirst({
        where: { organizationId },
        select: { saldo: true },
      }),

      prisma.gastoMenor.aggregate({
        where: { organizationId, estado: 'aprobado', fecha: { gte: desdeMes } },
        _sum: { monto: true },
      }),

      prisma.user.count({ where: { organizationId, rol: 'cobrador', activo: true } }),

      // Cobradores que SÍ registraron algo hoy. Lo que la pantalla enseña es su
      // complemento, porque el problema son los que no.
      prisma.pago.findMany({
        // OJO: el campo es `fechaPago`, no `fecha`. Un nombre inexistente aqui
        // es un 500 en runtime que el build no detecta.
        where: { organizationId, fechaPago: { gte: hoy } },
        select: { cobradorId: true },
        distinct: ['cobradorId'],
      }),

      prisma.prestamo.aggregate({
        where: { organizationId, esClavo: true },
        _count: { _all: true },
        _sum: { montoPrestado: true },
      }),

      prisma.socio.count({ where: { organizationId, activo: true } }),

      prisma.user.count({ where: { organizationId, activo: true } }),
    ])

  const conCobro = cobradoresConCobroHoy.filter((p) => p.cobradorId).length

  return Response.json({
    pais,
    plataLista: Math.round(capital?.saldo || 0),
    gastosMes: Math.round(gastosMes._sum.monto || 0),
    cobradores,
    // Nunca negativo: si hubiera más cobradores con cobro que cobradores
    // activos (uno desactivado que cobró esta mañana), la resta daría -1 y la
    // pantalla mostraría "-1 sin registrar nada".
    cobradoresSinRegistrar: Math.max(0, cobradores - conCobro),
    perdidos: { cantidad: clavos._count._all, monto: Math.round(clavos._sum.montoPrestado || 0) },
    socios,
    usuarios,
  })
}
