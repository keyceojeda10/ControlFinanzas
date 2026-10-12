// app/api/seguimiento/aviso-del-dia/route.js — ¿se le abre hoy «Hoy le toca cobrar»?
//
// Bloque 3 del plan de seguimiento (12 oct 2026): SOLO a quien está en prueba.
// El que ya paga tiene el hábito y un aviso diario lo cansa; su señal es la
// inactividad (lib/seguimiento/motor.js, «en riesgo»).
//
// Sale si hoy le tocan cobros y todavía no registró ninguno. Los cobros y el
// monto son la MISMA cuenta de «Cobrar hoy» (`cobrosDeHoy`).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cobrosDeHoy, diasConCobro } from '@/lib/seguimiento/prueba'
import { diaBogota } from '@/lib/seguimiento/reglas'
import { DIAS_COBRO_PARA_REGALO, DIAS_PRUEBA, DIAS_PRUEBA_BASE } from '@/lib/planes'

const NO = { mostrar: false }

export async function GET() {
  const session = await getServerSession(authOptions)
  const orgId = session?.user?.organizationId
  if (!orgId || session.user.rol !== 'owner') return NextResponse.json(NO)

  const ahora = new Date()
  const [prueba, pago, marca, premio] = await Promise.all([
    prisma.suscripcion.findFirst({ where: { organizationId: orgId, estado: 'activa', montoCOP: 0, fechaVencimiento: { gt: ahora } }, select: { id: true } }),
    prisma.pagoSuscripcion.count({ where: { organizationId: orgId, montoCOP: { gt: 0 } } }),
    prisma.envioSeguimiento.count({ where: { organizationId: orgId, caso: 'prueba', paso: 'inicio' } }),
    prisma.envioSeguimiento.count({ where: { organizationId: orgId, caso: 'prueba', paso: 'premio' } }),
  ])
  if (!prueba || pago > 0) return NextResponse.json(NO)

  const { dias } = await diasConCobro(orgId, ahora)
  if (dias.includes(diaBogota(ahora))) return NextResponse.json(NO) // ya cobró hoy
  const hoy = await cobrosDeHoy(orgId, ahora)
  if (hoy.cobros === 0) return NextResponse.json(NO)

  return NextResponse.json({
    mostrar: true,
    dia: diaBogota(ahora),
    cobros: hoy.cobros,
    monto: hoy.monto,
    // El progreso hacia el regalo, solo si va con 7 + 7 y aún no lo ganó.
    regalo: marca > 0 && premio === 0
      ? { dias: dias.length, meta: DIAS_COBRO_PARA_REGALO, diasRegalo: DIAS_PRUEBA - DIAS_PRUEBA_BASE }
      : null,
  })
}
