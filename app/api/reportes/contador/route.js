/* ══ EL INFORME PARA EL CONTADOR ═════════════════════════════════════════════
 *
 *   «Sería bueno tener un extracto de gastos contra utilidad y utilidades
 *    contra capital recuperado, para quienes estamos cerca a topes de declarar
 *    y así poder saber cuál es el capital recuperado y las utilidades
 *    obtenidas.»
 *      — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
 *
 * La cuenta vive en `lib/reportes/contador.js`, sin base de datos, para poderla
 * comprobar con números a mano — que es lo que hace `informe-contador.test.js`.
 * Aquí solo se leen los datos y se pinta.
 *
 * `?formato=pdf` devuelve la hoja para el contador; sin eso, el JSON.
 *
 * ⚠ SE PIDEN LOS PRÉSTAMOS QUE COBRARON EN EL PERÍODO, CON TODOS SUS PAGOS.
 *   El filtro va sobre el PRÉSTAMO (`pagos: { some: … }`) y no sobre los pagos:
 *   el interés de un pago depende de por dónde iba la tabla cuando entró, así
 *   que recortar la lista de pagos al mes hace que el primero se calcule como
 *   si fuera el primero de todos y salga de más.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset, formatMoney, formatFechaCorta, getCountryConfig } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { SELECT_PARA_INTERES } from '@/lib/dinero/interes-cobrado'
import { calcularContador, rangoDePeriodo, rangoManual, PERIODOS_CONTADOR } from '@/lib/reportes/contador'
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

  /* ⚠ LISTA BLANCA. Sin ella, `?periodo=cualquier-cosa` cae al mes por defecto
     y el papel diría «Trimestre» encima de las cifras de un mes. */
  const periodo = PERIODOS_CONTADOR[searchParams.get('periodo')] ? searchParams.get('periodo') : 'mes'
  const offsetHoras = Math.abs(getUtcOffset(country))
  /* El rango a mano manda sobre la pastilla: si el prestamista escribió dos
     fechas, es que quiere ESAS y no «el mes». */
  const { desde, hasta } = rangoManual(searchParams, offsetHoras) ?? rangoDePeriodo(periodo, offsetHoras)

  const [prestamos, gastos, org] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: { not: 'cancelado' },
        pagos: { some: { fechaPago: { gte: desde, lt: hasta }, tipo: { notIn: ['recargo', 'descuento'] } } },
      },
      select: SELECT_PARA_INTERES,
    }),
    // Solo los aprobados, igual que la caja: un gasto pendiente todavía no salió.
    prisma.gastoMenor.findMany({
      where: { organizationId: orgId, estado: 'aprobado', fecha: { gte: desde, lt: hasta } },
      select: { monto: true, fecha: true, description: true },
      orderBy: { fecha: 'asc' },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { nombre: true } }),
  ])

  const r = calcularContador({ prestamos, gastos, desde, hasta, offsetHoras })

  if (searchParams.get('formato') !== 'pdf') {
    return NextResponse.json({ periodo, desde, hasta, ...r, cantidadGastos: gastos.length })
  }

  // ── LA HOJA ───────────────────────────────────────────────────────────────
  const negocio = org?.nombre || 'Mi negocio'
  const fmt = (n) => formatMoney(n, country)
  /* ⚠ EL SEPARATOR DECIMAL ES EL DEL PAÍS. Salía «5.7%» en una hoja donde el
     dinero de al lado dice «$17.475»: en Colombia el punto son los miles, así
     que ese 5.7 se lee como cinco mil setecientos. Lo vi en la hoja impresa,
     no en el código — ahí `${v}%` parece correcto. */
  const locale = getCountryConfig(country).locale
  const pct = (v) => (v === null ? '—' : `${v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)
  const dia = (f) => formatFechaCorta(new Date(f), country)
  const doc = abrirDocumento({ pie: `Control Finanzas · ${negocio}` })

  let y = doc.cabecera({
    negocio,
    titulo: 'Para el contador',
    subtitulo: `Del ${dia(desde)} al ${dia(new Date(hasta.getTime() - 86400000))}`,
    meta: PERIODOS_CONTADOR[periodo].rotulo,
  })

  /* ⚠ LA UTILIDAD VA PRIMERA Y EL RECAUDADO NO ESTÁ ARRIBA.
     De lo que entra por la ventanilla, la mayor parte es capital que ya era del
     prestamista y está volviendo. Poner el recaudado como cifra grande es lo
     que hacía que se leyera como ganancia — el error que infló analíticas 7,9
     veces. Aquí manda la utilidad, y el recaudado se explica abajo, partido. */
  y = doc.tarjetasResumen([
    { rotulo: 'Utilidad', valor: fmt(r.utilidad), tono: r.utilidad >= 0 ? 'bueno' : 'malo' },
    { rotulo: 'Capital recuperado', valor: fmt(r.capitalRecuperado) },
    { rotulo: 'Gastos', valor: fmt(r.gastos), tono: r.gastos > 0 ? 'malo' : undefined },
  ], y)

  y = doc.seccion('De dónde sale la utilidad', y)
  y = doc.cifras([
    { rotulo: 'Entró en total', valor: fmt(r.recaudado), pie: 'interés + capital' },
    { rotulo: 'Interés cobrado', valor: fmt(r.interes), pie: 'esto es lo que ganó' },
    { rotulo: 'Menos gastos', valor: fmt(r.gastos), pie: `${r.cantidadGastos ?? gastos.length} anotados` },
    { rotulo: 'Utilidad', valor: fmt(r.utilidad), tono: r.utilidad >= 0 ? 'bueno' : 'malo' },
  ], y, { columnas: 4 })

  y = doc.seccion('Las dos proporciones', y)
  y = doc.cifras([
    { rotulo: 'Gastos sobre el interés', valor: pct(r.porcentajeGastos), pie: 'cuánto se fue en gastos' },
    { rotulo: 'Utilidad sobre capital recuperado', valor: pct(r.utilidadSobreCapital), pie: 'lo que rindió' },
  ], y, { columnas: 2 })

  if (r.meses.length > 1) {
    y = doc.seccion('Mes a mes', y)
    y = doc.tabla({
      columnas: [
        { clave: 'mes', titulo: 'Mes', ancho: 1.6 },
        { clave: 'capital', titulo: 'Capital recuperado', ancho: 2.4, fuente: 'cifra' },
        { clave: 'interes', titulo: 'Interés', ancho: 2, fuente: 'cifra' },
        { clave: 'gastos', titulo: 'Gastos', ancho: 2, fuente: 'cifra' },
        { clave: 'utilidad', titulo: 'Utilidad', ancho: 2, fuente: 'cifra' },
      ],
      filas: r.meses.map((m) => ({
        mes: m.mes,
        capital: fmt(m.capital),
        interes: fmt(m.interes),
        gastos: fmt(m.gastos),
        utilidad: fmt(m.utilidad),
      })),
    }, y)
  }

  /* ⚠ EL CERO DE GASTOS SE EXPLICA, NO SE DEJA SUELTO.
     Rincón no tiene ni un gasto registrado: su hoja diría «Gastos $0» y un
     contador lo leería como que el negocio no tiene costos. No es que falte el
     dato en el sistema — es que no se ha anotado ninguno. */
  if (r.gastos === 0) {
    y = doc.nota(
      'No hay gastos anotados en este período, así que la utilidad es todo el interés '
      + 'cobrado. Si el negocio tuvo costos —transporte, papelería, comisiones— hay que '
      + 'registrarlos en Gastos para que salgan aquí.',
      y, { tono: 'acento' },
    )
  }

  y = doc.nota(
    'La utilidad es el interés cobrado menos los gastos. El capital recuperado no es '
    + 'ganancia: es dinero que ya era del negocio y volvió.',
    y,
  )

  return respuestaPdf(await doc.cerrar(), `para-el-contador-${periodo}-${desde.toISOString().slice(0, 10)}.pdf`)
}
