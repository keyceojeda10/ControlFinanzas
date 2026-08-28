import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/* LO QUE SALIÓ POR WHATSAPP, PARA PODER MIRARLO.
 *
 * ⚠ NACIÓ DE NO PODER CONTESTAR «¿SE MANDÓ O NO?». El 28 de agosto quedó la
 * duda de si un envío a 36 organizaciones había salido, y no había forma de
 * saberlo: ni el panel, ni la base, ni los registros de la aplicación. Se tardó
 * una hora en concluir —con el syslog del servidor y la analítica de Meta por
 * medias horas— que no había salido.
 *
 * Los envíos se apuntan en `postMessage`, el cuello por donde pasan todos.
 * Aquí solo se leen.
 */
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (session?.user?.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const telefono = (searchParams.get('telefono') || '').replace(/\D/g, '')
  const plantilla = searchParams.get('plantilla') || ''
  const dias = Math.min(90, Math.max(1, Number(searchParams.get('dias')) || 7))
  const desde = new Date(Date.now() - dias * 86400000)

  /* El teléfono se busca por el final: en la base conviven «3001234567» y
     «573001234567» según por dónde entrara, y quien busca escribe el que tiene
     apuntado. Sin esto, la mitad de las búsquedas no encuentran nada. */
  const where = {
    createdAt: { gte: desde },
    ...(telefono && { telefono: { endsWith: telefono.slice(-10) } }),
    ...(plantilla && { plantilla }),
  }

  const [envios, porPlantilla, total, fallidos] = await Promise.all([
    prisma.envioWhatsapp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, telefono: true, tipo: true, plantilla: true,
        wamid: true, ok: true, error: true, createdAt: true,
      },
    }),
    prisma.envioWhatsapp.groupBy({
      by: ['plantilla'],
      where: { createdAt: { gte: desde } },
      _count: { _all: true },
      orderBy: { _count: { plantilla: 'desc' } },
    }),
    prisma.envioWhatsapp.count({ where: { createdAt: { gte: desde } } }),
    prisma.envioWhatsapp.count({ where: { createdAt: { gte: desde }, ok: false } }),
  ])

  return NextResponse.json({
    envios,
    total,
    fallidos,
    dias,
    porPlantilla: porPlantilla.map((p) => ({
      plantilla: p.plantilla || '(texto libre)',
      veces: p._count._all,
    })),
  })
}
