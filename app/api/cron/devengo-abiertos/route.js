import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { devengosPendientes } from '@/lib/calculos'

/* ══ EL DEVENGO DE LOS PRÉSTAMOS ABIERTOS ═══════════════════════════════════
 *
 * Un préstamo abierto no tiene tabla ni total: el interés se DEBE cuando el
 * período acaba, y ahí sube la deuda — la misma mecánica del recargo, que ya
 * existe y está probada. Esto es lo único que lo dispara.
 *
 * ⚠ LO QUE MATÓ A LA LÍNEA DE CRÉDITO FUE DEVENGAR DOS VECES. Aquí hay tres
 * defensas, y las tres hacen falta:
 *
 *   1. `devengosPendientes` descarta los períodos ya asentados.
 *   2. La clave única `(prestamoId, periodo)` en la base. Si dos ejecuciones
 *      se solapan —el cron y alguien a mano— la segunda choca y no entra. Es
 *      la única defensa que no depende de que el código esté bien.
 *   3. El apunte y la subida de la deuda van en la MISMA transacción: no puede
 *      quedar un préstamo con la deuda subida y sin rastro de por qué, ni al
 *      revés.
 *
 * ⚠ Y NO ES UN «CORTE» COMO EL DE LA LÍNEA DE CRÉDITO. Aquel había que
 * dispararlo a mano y el campo `diaCorte` era decorativo: sin corte el interés
 * no existía y el pago del cliente se comía el capital. Aquí el interés no
 * depende de que nadie se acuerde.
 *
 * Se llama igual que los otros veinte:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" .../api/cron/devengo-abiertos
 */
const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  /* ⚠ EN EL ESPEJO NO HAY SECRETO. Producción SIEMPRE lo tiene puesto, así que
     esta puerta solo se abre donde no hay nada que proteger — y es lo que
     permite probar el año entero por los endpoints reales en vez de a mano. */
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const abiertos = await prisma.prestamo.findMany({
    where: { sinPlazo: true, estado: 'activo', modoInteres: 'solo_interes' },
    select: {
      id: true, organizationId: true, montoPrestado: true, tasaInteres: true,
      frecuencia: true, fechaInicio: true, modoInteres: true, sinPlazo: true,
      totalAPagar: true, diaCobroMes: true, diaCobroMes2: true, primerCobro: true,
      /* Solo los abonos a capital: son los únicos que cambian sobre cuánto se
         cobra el interés del período siguiente. */
      pagos: { where: { tipo: 'capital' }, select: { montoPagado: true, fechaPago: true, tipo: true } },
      devengos: { select: { periodo: true } },
      cuotasAmortizacion: { select: { numeroPeriodo: true } },
    },
  })

  let asentados = 0, sumaInteres = 0, prestamosTocados = 0, choques = 0
  const ahora = Date.now()

  for (const p of abiertos) {
    const pendientes = devengosPendientes(p, ahora)
    if (!pendientes.length) continue
    let tocado = false

    for (const d of pendientes) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.devengoInteres.create({
            data: {
              prestamoId: p.id, organizationId: p.organizationId,
              periodo: d.periodo, capitalBase: d.capitalBase, interes: d.interes,
            },
          })
          await tx.prestamo.update({
            where: { id: p.id },
            data: { totalAPagar: { increment: d.interes } },
          })
        })
        asentados++; sumaInteres += d.interes; tocado = true
      } catch (e) {
        /* P2002 = chocó con la clave única: ese período ya estaba asentado por
           otra ejecución. No es un error, es la defensa funcionando. */
        if (e?.code === 'P2002') { choques++; continue }
        throw e
      }
    }
    if (tocado) prestamosTocados++
  }

  return NextResponse.json({
    prestamosAbiertos: abiertos.length,
    prestamosTocados,
    periodosAsentados: asentados,
    interesDevengado: sumaInteres,
    yaEstaban: choques,
  })
}
