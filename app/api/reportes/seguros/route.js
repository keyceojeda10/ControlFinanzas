// app/api/reportes/seguros/route.js
// Seguros cobrados POR RUTA. El seguro se genera al CREAR un prestamo con seguro,
// asi que se cuenta por fecha de creacion del prestamo. Filtro: dia/semana/mes/todo.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { rangoManual }      from '@/lib/reportes/contador'

/* ══ EL PERÍODO SE LLAMA «hoy», NO «dia» ═════════════════════════════════════
 *
 * «Dice hoy cobrado en seguros $10.000 y no fue así: esa práctica de poner
 *  seguro la hice UNA sola vez, y no fue hoy, fue hace mucho tiempo.»
 *                                                    — el dueño, 18 ago 2026
 *
 * Tenía razón y la causa era una palabra. Esta función esperaba `dia` y la
 * pantalla manda `hoy` —así se llama en `PERIODOS` del catálogo, y así dice el
 * chip—. Ninguna condición casaba, se caía al `return null` del final… **y
 * `null` significa SIN FILTRO**. O sea que «Hoy» enseñaba TODO: su único
 * préstamo con seguro, del 28 de junio, contado como cobrado hoy.
 *
 * ⚠ EL FALLO NO ESTÁ EN LO QUE FILTRA, SINO EN LO QUE HACE CUANDO NO ENTIENDE.
 * Un período desconocido caía en «todo», que es la respuesta más grande
 * posible. Ahora lo desconocido cae en `mes`, que es el defecto declarado
 * arriba: equivocarse hacia un mes enseña de más en un tramo acotado; caer en
 * «todo» convierte cualquier error de nombre en una cifra inventada.
 *
 * Y los períodos se leen del catálogo, no de una lista escrita aquí: era eso
 * justamente lo que se había desincronizado.
 */
function rangoFecha(periodo) {
  // Fechas en hora Colombia (UTC-5) -> convertir a UTC para el query
  const ahora = new Date(Date.now() - 5 * 3600 * 1000)
  const hoy0 = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 5, 0, 0))
  const atras = (dias) => {
    const d = new Date(hoy0); d.setUTCDate(d.getUTCDate() - dias); return { gte: d }
  }
  if (periodo === 'todo') return null
  if (periodo === 'hoy' || periodo === 'dia') return { gte: hoy0 }   // «dia» por si queda algún enlace viejo
  if (periodo === 'semana') return atras(7)
  if (periodo === 'trimestre') return atras(90)
  if (periodo === 'semestre') return atras(180)
  if (periodo === 'anio') return atras(365)
  return atras(30)   // «mes» y cualquier cosa que no se entienda
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  /* El plan del JWT no se refresca sin volver a entrar: quien acaba de
     pagar seguia viendo que su plan no alcanza. `exigeNivelReportes`
     usa el token como atajo y solo pregunta a la base cuando va a
     decir que no. Ver lib/plan-servidor.js. */
  const veto = await exigeNivelReportes(session, 2)
  if (veto) return veto

  const orgId = session.user.organizationId
  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || 'mes'
  /* El tramo escrito a mano manda sobre la pastilla, igual que en «Para el
     contador» y «Movimientos por cuenta»: si alguien escribió dos fechas, es que
     quiere ESAS. Lo pidió el dueño en el mismo reporte donde vio el fallo. */
  const aMano = rangoManual(searchParams)
  const rango = aMano ? { gte: aMano.desde, lt: aMano.hasta } : rangoFecha(periodo)

  const wherePrestamo = {
    seguro: true,
    montoSeguro: { gt: 0 },
    esClavo: false,
    ...(rango ? { createdAt: rango } : {}),
  }

  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      nombre: true,
      cobrador: { select: { nombre: true } },
      clientes: {
        select: {
          prestamos: {
            where: wherePrestamo,
            select: { montoSeguro: true },
          },
        },
      },
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })

  let totalGeneral = 0
  let cantGeneral = 0
  const items = rutas.map(r => {
    let totalSeguro = 0
    let cant = 0
    for (const c of r.clientes) {
      for (const p of c.prestamos) {
        totalSeguro += p.montoSeguro || 0
        cant++
      }
    }
    totalGeneral += totalSeguro
    cantGeneral += cant
    return {
      rutaId: r.id,
      ruta: r.nombre,
      cobrador: r.cobrador?.nombre || 'Sin cobrador',
      cantPrestamosConSeguro: cant,
      totalSeguro: Math.round(totalSeguro),
    }
  }).filter(x => x.cantPrestamosConSeguro > 0)
    .sort((a, b) => b.totalSeguro - a.totalSeguro)

  // Prestamos sin ruta (cliente sin rutaId) con seguro
  const sinRuta = await prisma.prestamo.aggregate({
    where: { organizationId: orgId, ...wherePrestamo, cliente: { rutaId: null } },
    _sum: { montoSeguro: true },
    _count: true,
  })
  if (sinRuta._count > 0) {
    items.push({
      rutaId: null, ruta: 'Sin ruta', cobrador: '—',
      cantPrestamosConSeguro: sinRuta._count,
      totalSeguro: Math.round(sinRuta._sum.montoSeguro || 0),
    })
    totalGeneral += sinRuta._sum.montoSeguro || 0
    cantGeneral += sinRuta._count
  }

  return NextResponse.json({
    periodo,
    items,
    totalGeneral: Math.round(totalGeneral),
    cantGeneral,
  })
}
