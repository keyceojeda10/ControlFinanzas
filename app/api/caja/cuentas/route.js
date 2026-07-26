// app/api/caja/cuentas/route.js
// Desglose de dinero POR CUENTA (efectivo, Nequi, Daviplata...).
// Muestra ENTRO / SALIO / NETO por cada cuenta usada. Solo owner.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSaldosPorCuenta } from '@/lib/capital'
import { getLocalDayRange, getLocalDateStr } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver el dinero por cuenta' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || 'todo' // 'hoy' | 'mes' | 'todo'
  const country = session.user.country || 'co'

  let desde
  let hasta
  if (periodo === 'hoy') {
    const hoy = getLocalDateStr(country)
    const rango = getLocalDayRange(hoy, country)
    desde = rango.inicio
    hasta = rango.fin
  } else if (periodo === 'mes') {
    const hoyStr = getLocalDateStr(country)
    const primerDia = `${hoyStr.slice(0, 7)}-01`
    desde = getLocalDayRange(primerDia, country).inicio
    // hasta = ahora (fin del dia de hoy)
    hasta = getLocalDayRange(hoyStr, country).fin
  }
  // 'todo' -> sin rango (histórico completo)

  try {
    const cuentas = await getSaldosPorCuenta(prisma, session.user.organizationId, { desde, hasta })
    return Response.json({ periodo, cuentas })
  } catch (e) {
    return Response.json({ error: 'No se pudo calcular el desglose por cuenta' }, { status: 500 })
  }
}
