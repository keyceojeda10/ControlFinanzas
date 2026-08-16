/* ══ MOVIMIENTOS POR CUENTA ══════════════════════════════════════════════════
 *
 *   «Un extracto de movimientos por cuenta bancaria o efectivo.»
 *      — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
 *
 * Él lleva cuatro cuentas configuradas y hasta ahora solo podía ver el SALDO de
 * cada una, no qué entró y qué salió por cada una en un período.
 *
 * ⚠ NO SE VUELVE A CALCULAR NADA. `getSaldosPorCuenta` ya reparte los
 *   movimientos por cuenta y acepta `desde`/`hasta`; escribir la suma otra vez
 *   aquí es cómo la misma cifra acaba diciendo dos cosas según la pantalla —que
 *   es justo lo que pasó con la ganancia del mes.
 *
 * ⚠ EL LIBRO ES `MovimientoCapital`, NO LOS PAGOS. Los pagos no llevan las
 *   inyecciones, los retiros ni los desembolsos, así que sumarlos daría un
 *   extracto al que le falta la mitad del movimiento de la cuenta.
 *
 * `?formato=pdf` devuelve la hoja; sin eso, el JSON.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset, formatMoney, formatFechaCorta } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { getSaldosPorCuenta } from '@/lib/capital'
import { rangoDePeriodo, PERIODOS_CONTADOR } from '@/lib/reportes/contador'
import { abrirDocumento, respuestaPdf } from '@/lib/papel/documento'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  }
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const periodo = PERIODOS_CONTADOR[searchParams.get('periodo')] ? searchParams.get('periodo') : 'mes'
  const { desde, hasta } = rangoDePeriodo(periodo, Math.abs(getUtcOffset(country)))

  const [cuentas, org] = await Promise.all([
    getSaldosPorCuenta(prisma, orgId, { desde, hasta }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
  ])

  const totales = cuentas.reduce(
    (a, c) => ({ entradas: a.entradas + c.entradas, salidas: a.salidas + c.salidas, neto: a.neto + c.neto }),
    { entradas: 0, salidas: 0, neto: 0 },
  )

  if (searchParams.get('formato') !== 'pdf') {
    return NextResponse.json({ periodo, desde, hasta, cuentas, totales })
  }

  // ── LA HOJA ───────────────────────────────────────────────────────────────
  const negocio = org?.name || 'Mi negocio'
  const fmt = (n) => formatMoney(n, country)
  const dia = (f) => formatFechaCorta(new Date(f), country)
  const doc = abrirDocumento({ pie: `Control Finanzas · ${negocio}` })

  let y = doc.cabecera({
    negocio,
    titulo: 'Movimientos por cuenta',
    subtitulo: `Del ${dia(desde)} al ${dia(new Date(hasta.getTime() - 86400000))}`,
    meta: PERIODOS_CONTADOR[periodo].rotulo,
  })

  y = doc.tarjetasResumen([
    { rotulo: 'Entró', valor: fmt(totales.entradas), tono: 'bueno' },
    { rotulo: 'Salió', valor: fmt(totales.salidas), tono: 'malo' },
    { rotulo: 'Quedó', valor: fmt(totales.neto), tono: totales.neto >= 0 ? 'bueno' : 'malo' },
  ], y)

  if (!cuentas.length) {
    /* ⚠ Un extracto en blanco parece un fallo del sistema. Decir por qué está
       vacío es la diferencia entre «no funciona» y «no hubo movimiento». */
    y = doc.nota('No hubo movimientos en este período.', y, { tono: 'acento' })
    return respuestaPdf(await doc.cerrar(), `cuentas-${periodo}-${desde.toISOString().slice(0, 10)}.pdf`)
  }

  y = doc.seccion('Cuenta por cuenta', y)
  y = doc.tabla({
    columnas: [
      // `identidad`: el nombre de la cuenta no se recorta con puntos suspensivos.
      { clave: 'cuenta', titulo: 'Cuenta', ancho: 2.6, identidad: true },
      { clave: 'entradas', titulo: 'Entró', ancho: 2, fuente: 'cifra' },
      { clave: 'salidas', titulo: 'Salió', ancho: 2, fuente: 'cifra' },
      { clave: 'neto', titulo: 'Quedó', ancho: 2, fuente: 'cifra' },
    ],
    filas: cuentas.map((c) => ({
      cuenta: c.nombre,
      entradas: fmt(c.entradas),
      salidas: fmt(c.salidas),
      neto: fmt(c.neto),
    })),
  }, y)

  y = doc.seccion('En qué se movió cada una', y)
  y = doc.tabla({
    columnas: [
      { clave: 'cuenta', titulo: 'Cuenta', ancho: 2.6, identidad: true },
      { clave: 'recaudado', titulo: 'Cobrado', ancho: 1.8, fuente: 'cifra' },
      { clave: 'inyectado', titulo: 'Metido', ancho: 1.8, fuente: 'cifra' },
      { clave: 'prestado', titulo: 'Prestado', ancho: 1.8, fuente: 'cifra' },
      { clave: 'gastos', titulo: 'Gastos', ancho: 1.6, fuente: 'cifra' },
      { clave: 'retirado', titulo: 'Sacado', ancho: 1.6, fuente: 'cifra' },
    ],
    filas: cuentas.map((c) => ({
      cuenta: c.nombre,
      recaudado: fmt(c.recaudado),
      inyectado: fmt(c.inyectado),
      prestado: fmt(c.prestado),
      gastos: fmt(c.gastos),
      retirado: fmt(c.retirado),
    })),
  }, y)

  /* La fila «Sin registrar» aparece cuando un movimiento viejo no dice por
     dónde entró. Sin explicarla, se lee como una cuenta que nadie reconoce. */
  if (cuentas.some((c) => c.tipoCuenta === 'sin_registrar')) {
    y = doc.nota(
      '«Sin registrar» son movimientos anotados antes de que el sistema pidiera la cuenta. '
      + 'No están perdidos: solo no se sabe por dónde entraron o salieron.',
      y,
    )
  }

  return respuestaPdf(await doc.cerrar(), `cuentas-${periodo}-${desde.toISOString().slice(0, 10)}.pdf`)
}
