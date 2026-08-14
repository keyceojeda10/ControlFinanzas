import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/* Lo que la gente contestó, para el sondeo.
 *
 * ⚠ AQUÍ SÍ SE ENSEÑA EL TEXTO, y es distinto de la campaña de fotos de
 * cuadernos —que cuenta pero no muestra—. La diferencia no es de criterio, es de
 * contenido: allí lo subido eran cartulinas con nombres, cédulas y deudas de
 * terceros; aquí es lo que el usuario opina de la app, escrito por él. Las
 * imágenes van por su propio endpoint, una a una y solo para superadmin.
 */
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.rol !== 'superadmin') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limite = Math.min(Number(searchParams.get('limite')) || 200, 500)

  const filas = await prisma.sugerencia.findMany({
    orderBy: { createdAt: 'desc' },
    take: limite,
  })

  /* Los nombres se resuelven aparte porque `Sugerencia` no declara relaciones
     —ver el modelo—: son dos consultas por id, no un join. Con doscientas filas
     eso son dos consultas, no cuatrocientas. */
  const orgIds = [...new Set(filas.map((f) => f.organizationId))]
  const userIds = [...new Set(filas.map((f) => f.userId))]
  const [orgs, usuarios] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, nombre: true, plan: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nombre: true } }),
  ])
  const porOrg = Object.fromEntries(orgs.map((o) => [o.id, o]))
  const porUsuario = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))

  const sugerencias = filas.map((f) => {
    let archivos = []
    try { archivos = JSON.parse(f.archivos || '[]') } catch {}
    return {
      id: f.id,
      texto: f.texto,
      fuente: f.fuente,
      rol: f.rol,
      createdAt: f.createdAt,
      negocio: porOrg[f.organizationId]?.nombre ?? '(negocio borrado)',
      plan: porOrg[f.organizationId]?.plan ?? null,
      persona: porUsuario[f.userId] ?? '(usuario borrado)',
      // Solo cuántos y de qué tipo: el contenido se pide uno a uno.
      adjuntos: archivos.map((a, i) => ({ i, esAudio: /(^|\/)voz-/.test(a) })),
    }
  })

  return Response.json({
    total: filas.length,
    negocios: orgIds.length,
    porRol: filas.reduce((acc, f) => ({ ...acc, [f.rol]: (acc[f.rol] ?? 0) + 1 }), {}),
    sugerencias,
  })
}
