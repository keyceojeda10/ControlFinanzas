import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { META_FOTOS, CIERRA_EN, campanaViva } from '@/lib/fotos-donadas'

/* El conteo de la campaña de fotos, para el panel de superadmin.
 *
 * ⚠ CUENTA, NO ENSEÑA. Aquí no sale ni una foto ni el nombre de un cliente: se
 * devuelven totales, quién colaboró y de qué forma. Montar una galería de
 * cédulas ajenas en una pantalla web recrearía justo el agujero que estas fotos
 * evitan yéndose a `/opt/cf-fotos-donadas` — ver
 * [[uploads_publicos_sin_sesion]]. Las fotos se revisan por SSH.
 *
 * Vive dentro de Activación y no en una sección propia: la campaña ES una
 * jugada de activación, y el panel ya tiene trece secciones. Cuando la campaña
 * muera, esto se borra sin dejar un renglón huérfano en el menú.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const [total, porForma, porOrg, ultima] = await Promise.all([
      prisma.fotoDonada.count(),
      prisma.fotoDonada.groupBy({ by: ['forma'], _count: { _all: true } }),
      prisma.fotoDonada.groupBy({ by: ['organizationId'], _count: { _all: true } }),
      prisma.fotoDonada.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])

    /* Los nombres de los negocios que colaboraron, para poder darles las gracias
       y avisarles cuando el cargue por fotos esté listo — que es lo que se les
       prometió en la pantalla. */
    const negocios = porOrg.length
      ? await prisma.organization.findMany({
          where: { id: { in: porOrg.map((o) => o.organizationId) } },
          select: { id: true, nombre: true },
        })
      : []

    const nombre = Object.fromEntries(negocios.map((n) => [n.id, n.nombre]))

    return NextResponse.json({
      total,
      meta: META_FOTOS,
      viva: campanaViva(total),
      cierraEn: CIERRA_EN.toISOString(),
      ultima: ultima?.createdAt ?? null,
      porForma: Object.fromEntries(porForma.map((f) => [f.forma ?? 'sin_decir', f._count._all])),
      negocios: porOrg
        .map((o) => ({ id: o.organizationId, nombre: nombre[o.organizationId] ?? '—', fotos: o._count._all }))
        .sort((a, b) => b.fotos - a.fotos),
    })
  } catch (e) {
    console.error('[admin/fotos-donadas]', e)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
