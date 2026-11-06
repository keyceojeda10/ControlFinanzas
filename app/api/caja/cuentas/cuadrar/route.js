// app/api/caja/cuentas/cuadrar/route.js — DEJAR CADA CUENTA EN LO QUE EL DUEÑO TIENE.
//
// El dueño dice cuánto hay hoy en cada cuenta y la diferencia se pasa desde el
// capital sin repartir (o vuelve a él). Son traslados: el capital del negocio no
// cambia, solo dónde está. Es la única forma exacta de repartir lo que se guardó
// sin cuenta: nadie más sabe cuánto hay en su Bancolombia (lib/dinero/sin-repartir.js).

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSaldosPorCuenta, pasarEntreCuentas } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { formatMoney } from '@/lib/i18n'
import { SIN_REPARTIR, cuadreDeCuentas, capitalSinRepartir } from '@/lib/dinero/sin-repartir'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede cuadrar las cuentas' }, { status: 403 })
  }
  const { organizationId } = session.user
  const pais = session.user.country || 'co'

  const body = await request.json().catch(() => ({}))
  const dice = Array.isArray(body.cuentas) ? body.cuentas.slice(0, 50) : []
  if (!dice.length) return Response.json({ error: 'Escribe cuánto tienes en al menos una cuenta' }, { status: 400 })

  /* Los saldos se leen DENTRO de la transacción: si entra un cobro mientras tanto,
     la diferencia se calcula sobre lo de ese momento. */
  const resultado = await prisma.$transaction(async (tx) => {
    const cuentas = await getSaldosPorCuenta(tx, organizationId)
    const cambios = cuadreDeCuentas(cuentas, dice)
    for (const c of cambios) {
      const entra = c.diferencia > 0
      await pasarEntreCuentas(tx, {
        organizationId,
        desde: entra ? SIN_REPARTIR : c.key,
        hacia: entra ? c.key : SIN_REPARTIR,
        monto: Math.abs(c.diferencia),
        descripcion: `Cuadre: ${c.nombre} queda en lo que tienes`,
        creadoPorId: session.user.id,
      })
    }
    const despues = await getSaldosPorCuenta(tx, organizationId)
    return { cambios, sinRepartir: capitalSinRepartir(despues) }
  }, { timeout: 30000, maxWait: 10000 })

  if (resultado.cambios.length) {
    logActividad({
      session,
      accion: 'cuadre_de_cuentas',
      entidadTipo: 'capital',
      entidadId: organizationId,
      detalle: resultado.cambios.map((c) => `${c.nombre}: ${formatMoney(c.antes, pais)} → ${formatMoney(c.ahora, pais)}`).join(' · '),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
  }
  return Response.json({ ok: true, ...resultado })
}
