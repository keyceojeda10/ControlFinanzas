// app/api/caja/ajustes/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital } from '@/lib/capital'
import { getLocalDateStr, getUtcOffset } from '@/lib/i18n'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const getHoyLocal = (country = 'co') => getLocalDateStr(country)

const getFechaOperacionLocal = (fechaLocal, country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  return new Date(`${fechaLocal}T12:00:00-${pad(absOffset)}:00`)
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede registrar ajustes de caja' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const body = await request.json()
  const monto = Number(body?.monto)
  const direccion = body?.direccion === 'egreso' ? 'egreso' : 'ingreso'
  const movimientoSolicitado = typeof body?.movimiento === 'string' ? body.movimiento : null
  const descripcion = (body?.descripcion || '').trim()
  const fechaSolicitada = typeof body?.fecha === 'string' && FECHA_REGEX.test(body.fecha)
    ? body.fecha
    : getHoyLocal()

  if (fechaSolicitada > getHoyLocal()) {
    return Response.json({ error: 'No se pueden registrar movimientos en fechas futuras' }, { status: 400 })
  }

  const createdAtOperacion = getFechaOperacionLocal(fechaSolicitada)

  const tipoMovimiento = ['inyeccion', 'retiro', 'ajuste'].includes(movimientoSolicitado)
    ? movimientoSolicitado
    : (direccion === 'ingreso' ? 'inyeccion' : 'retiro')

  if (!Number.isFinite(monto) || monto <= 0) {
    return Response.json({ error: 'El monto del ajuste debe ser mayor a 0' }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const descripcionPorDefecto = tipoMovimiento === 'inyeccion'
        ? 'Inyección manual desde caja'
        : tipoMovimiento === 'retiro'
          ? 'Retiro manual desde caja'
          : `Ajuste de caja manual (${direccion === 'ingreso' ? 'entrada' : 'salida'})`

      return registrarMovimientoManualCapital(tx, {
        organizationId,
        tipo: tipoMovimiento,
        monto,
        direccion: tipoMovimiento === 'ajuste' ? direccion : undefined,
        descripcion: descripcion || descripcionPorDefecto,
        referenciaTipo: tipoMovimiento === 'ajuste' ? 'caja_ajuste' : 'caja_capital_manual',
        creadoPorId: userId,
        createdAt: createdAtOperacion,
        permitirNegativo: false,
      })
    })

    logActividad({
      session,
      accion: 'movimiento_caja_manual',
      entidadTipo: 'caja',
      entidadId: resultado.movimiento.id,
      detalle: `${tipoMovimiento} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${Math.round(monto).toLocaleString('es-CO')} (${fechaSolicitada})${descripcion ? ` - ${descripcion}` : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ok: true,
      movimiento: {
        id: resultado.movimiento.id,
        tipo: resultado.movimiento.tipo,
        monto: resultado.movimiento.monto,
        descripcion: resultado.movimiento.descripcion,
        createdAt: resultado.movimiento.createdAt,
        direccion: resultado.direccion,
        fecha: fechaSolicitada,
      },
      saldo: resultado.capital.saldo,
    }, { status: 201 })
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo registrar el ajuste de caja' }, { status: 400 })
  }
}

/* ══ DESHACER UN AJUSTE HECHO A MANO ═════════════════════════════════════════
 *
 * Un cliente se fue por esto, el 16 de agosto de 2026.
 *
 * Registró la cicla de su mamá como GASTO del negocio, vio que la caja no
 * cerraba y —para cuadrarla— metió un ajuste manual de +$282.000. Después le
 * borramos el gasto, y el borrado asienta su propio reverso de +$282.000. Con
 * los dos, su caja pasó a decir $1.564.000 cuando tenía $1.282.000.
 *
 * Se le contestó por WhatsApp: «puedes borrar los ajustes manuales que fuiste
 * metiendo esta mañana, ya no hacen falta».
 *
 * ⚠ ESO NO SE PODÍA HACER. Este archivo solo tenía `POST`. Él contestó «entiendo
 * hermano, pero sigue lo mismo», mandó otra captura con la misma cifra mal, y
 * esa noche escribió «mano ya no voy a seguir con el sistema».
 *
 * ── POR QUÉ UN ASIENTO INVERSO Y NO UN `DELETE` ───────────────────────────
 *
 * `MovimientoCapital` es el libro. Borrar un renglón reescribe la historia y
 * deja al prestamista sin poder explicar por qué su saldo cambió — que es
 * justo lo que hace que deje de confiar en la pantalla. El borrado de gastos
 * ya lo hace así («Reverso gasto eliminado»), y se sigue el mismo camino.
 *
 * ── QUÉ SE DEJA DESHACER, Y QUÉ NO ────────────────────────────────────────
 *
 * SOLO lo que esta misma pantalla creó: `caja_ajuste` y `caja_capital_manual`.
 * Un recaudo, un desembolso o un gasto NO se deshacen desde aquí: cada uno
 * tiene su propia pantalla, con sus propias consecuencias (la deuda del
 * cliente, la cartera). Dejarlos aquí sería una puerta trasera para mover
 * plata sin tocar lo que esa plata representa.
 */
const DESHACIBLES = ['caja_ajuste', 'caja_capital_manual']
const REVERSO = 'caja_ajuste_reverso'

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede deshacer ajustes de caja' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') || (await request.json().catch(() => ({})))?.id
  if (!id) return Response.json({ error: 'Falta cuál ajuste' }, { status: 400 })

  const { organizationId, id: userId } = session.user

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimientoCapital.findFirst({
        where: { id, organizationId },
      })
      if (!mov) throw new Error('Ese ajuste no existe')
      if (!DESHACIBLES.includes(mov.referenciaTipo)) {
        throw new Error('Eso no es un ajuste de caja. Los cobros, préstamos y gastos se deshacen desde su propia pantalla.')
      }

      /* Sin esto, dos toques seguidos —o el botón pulsado dos veces por una red
         lenta— restarían el doble. El libro guarda a quién deshace cada reverso,
         así que la comprobación es una consulta y no una suposición. */
      const yaDeshecho = await tx.movimientoCapital.findFirst({
        where: { organizationId, referenciaTipo: REVERSO, referenciaId: id },
      })
      if (yaDeshecho) throw new Error('Ese ajuste ya estaba deshecho')

      /* Al revés que el original: si sumó, ahora resta. `esIngreso` no se
         adivina —se lee del propio asiento, comparando sus dos saldos—, porque
         un `ajuste` puede ir en las dos direcciones y el tipo no lo dice. */
      const sumó = mov.saldoNuevo > mov.saldoAnterior
      const r = await registrarMovimientoManualCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: mov.monto,
        direccion: sumó ? 'egreso' : 'ingreso',
        descripcion: `Deshecho: ${mov.descripcion || 'ajuste de caja'}`,
        referenciaTipo: REVERSO,
        referenciaId: mov.id,
        creadoPorId: userId,
        /* Cae en el día del ORIGINAL, no en hoy. Si cayera hoy, la caja de
           aquel día seguiría descuadrada para siempre en los informes y el
           prestamista vería un agujero en una fecha que ya cerró. */
        createdAt: mov.createdAt,
        permitirNegativo: true,
      })
      return { original: mov, reverso: r.movimiento, saldo: r.capital.saldo }
    })

    logActividad({
      session,
      accion: 'movimiento_caja_deshecho',
      entidadTipo: 'caja',
      entidadId: resultado.original.id,
      detalle: `Deshecho ajuste de $${Math.round(resultado.original.monto).toLocaleString('es-CO')}: ${resultado.original.descripcion ?? ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ok: true,
      mensaje: `Deshecho. Tu caja queda en $${Math.round(resultado.saldo).toLocaleString('es-CO')}.`,
      saldo: resultado.saldo,
    })
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo deshacer el ajuste' }, { status: 400 })
  }
}
