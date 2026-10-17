/* ══ ASENTAR EL INTERÉS DE UN PRÉSTAMO ABIERTO ═══════════════════════════════
 *
 * Un préstamo abierto no tiene tabla ni total: el interés se DEBE cuando el
 * período acaba, y ahí sube la deuda — la misma mecánica del recargo. Esto es
 * lo único que lo dispara.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO DENTRO DEL CRON ─────────────────────────────────
 *
 * Reportado por Rhoders (FACIL) el 19 ago 2026, con la captura tomada un minuto
 * después de crear el préstamo:
 *
 *   «Debería salir en mora los intereses que se deben, y debajo de Yeison
 *    AGUDELO en mora y no al día, porque aún no ha pagado los intereses.»
 *
 * Tenía razón. Prestó $690.000 al 10% mensual con fecha de inicio del 1 de
 * julio, así que el período que cerró el 1 de agosto ya se debía: $69.000. La
 * pantalla decía «Al día · atraso $0».
 *
 * Y no era el cron: el cron funciona. Corrió ese mismo día a las 00:05 y no
 * había nada que asentar, porque **el préstamo se creó diez horas después**.
 * Hasta el amanecer siguiente, un préstamo abierto con fecha retroactiva enseña
 * una deuda que no es y un «al día» que es mentira.
 *
 * Por eso el asiento se hace también AL CREARLO. La misma función para los dos
 * caminos: dos copias de una cuenta que sube deudas es la forma conocida de que
 * un día devenguen distinto.
 *
 * ⚠ LO QUE MATÓ A LA LÍNEA DE CRÉDITO FUE DEVENGAR DOS VECES, y ahora hay dos
 *   disparadores en vez de uno. Las tres defensas siguen siendo las mismas:
 *
 *     1. `devengosPendientes` descarta los períodos ya asentados.
 *     2. La clave única `(prestamoId, periodo)`. Si el cron y la creación se
 *        cruzan, la segunda choca y no entra. Es la única defensa que no
 *        depende de que el código esté bien.
 *     3. El apunte y la subida de la deuda van en la MISMA transacción.
 */
import { devengosPendientes, reajusteDeDevengos, esAbiertoConDevengo } from '@/lib/calculos'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'

/** Lo que hay que traer del préstamo para poder devengarlo. */
export const SELECT_PARA_DEVENGAR = {
  id: true, organizationId: true, montoPrestado: true, ...CAMPOS_DEL_REPARTO, tasaInteres: true,
  frecuencia: true, fechaInicio: true, modoInteres: true, sinPlazo: true,
  totalAPagar: true, diaCobroMes: true, diaCobroMes2: true, primerCobro: true,
  /* TODOS los pagos y el interés de cada período asentado: un «completo» que
     sobra después de cubrir el interés también es capital, y el interés del
     mes va sobre el capital con que EMPEZÓ (`capitalAbiertoAlDia`). Con solo
     los abonos «capital», a Jaquelin Pitre (Inversiones Jk) el cron le iba a
     cobrar noviembre sobre $3.700.000 cuando debía $2.400.000. */
  pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } },
  devengos: { select: { periodo: true, interes: true } },
  cuotasAmortizacion: { select: { numeroPeriodo: true } },
}

/**
 * Asienta los períodos vencidos de UN préstamo abierto.
 *
 * @param {object} prisma  cliente Prisma (no una transacción: abre las suyas)
 * @param {object} p       préstamo con `SELECT_PARA_DEVENGAR`
 * @param {number} [ahora]
 * @returns {Promise<{asentados:number, interes:number, choques:number}>}
 */
export async function devengarPrestamoAbierto(prisma, p, ahora = Date.now()) {
  const vacio = { asentados: 0, interes: 0, choques: 0 }
  if (!p?.sinPlazo || p.modoInteres !== 'solo_interes' || p.estado === 'cancelado') return vacio

  const pendientes = devengosPendientes(p, ahora)
  if (!pendientes.length) return vacio

  let asentados = 0, interes = 0, choques = 0
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
      asentados++
      interes += d.interes
    } catch (e) {
      /* P2002 = chocó con la clave única: ese período ya estaba asentado por
         otra ejecución. No es un error, es la defensa funcionando. */
      if (e?.code === 'P2002') { choques++; continue }
      throw e
    }
  }
  return { asentados, interes, choques }
}

/**
 * Lo mismo, pero sin reventar la operación que lo llamó.
 *
 * Al crear el préstamo, el préstamo YA está creado y guardado: si el asiento
 * falla, lo que no puede pasar es que el prestamista vea un error y crea que no
 * se guardó nada. El cron lo recoge esa misma noche.
 */
export async function devengarAlCrear(prisma, prestamoId) {
  try {
    const p = await prisma.prestamo.findUnique({
      where: { id: prestamoId },
      select: { ...SELECT_PARA_DEVENGAR, estado: true },
    })
    if (!p) return
    const r = await devengarPrestamoAbierto(prisma, p)
    if (r.asentados) {
      console.log(`[devengo] préstamo abierto ${prestamoId}: ${r.asentados} período(s) al crearlo, $${r.interes}`)
    }
  } catch (e) {
    console.error('[devengo] no se pudo asentar al crear ' + prestamoId + ':', e?.message)
  }
}

/**
 * Tras registrar, cambiar de fecha o anular un pago de un préstamo abierto,
 * corrige el interés de los meses ya asentados que empezaron después de ese
 * pago (ver `reajusteDeDevengos`) y mueve la deuda en la misma cifra.
 *
 * `armarAntes(p)` recibe el préstamo como queda DESPUÉS del cambio (leído aquí,
 * dentro de la transacción) y devuelve cómo estaba ANTES: sin el pago nuevo,
 * con la fecha vieja, o con el pago anulado todavía dentro.
 *
 * @returns {Promise<{periodo, capitalBase, interes, diferencia}[]>}
 */
export async function reajustarDevengosTrasCambio(tx, prestamoId, armarAntes) {
  const p = await tx.prestamo.findUnique({
    where: { id: prestamoId },
    select: {
      id: true, modoInteres: true, sinPlazo: true, tasaInteres: true, frecuencia: true, fechaInicio: true,
      diaCobroMes: true, diaCobroMes2: true, primerCobro: true, montoPrestado: true,
      pagos: { select: { id: true, tipo: true, montoPagado: true, fechaPago: true } },
      devengos: { select: { periodo: true, interes: true, capitalBase: true } },
    },
  })
  if (!p || !esAbiertoConDevengo(p) || !(p.devengos ?? []).length) return []
  const cambios = reajusteDeDevengos(armarAntes(p), p)
  if (!cambios.length) return []
  for (const c of cambios) {
    await tx.devengoInteres.update({
      where: { prestamoId_periodo: { prestamoId, periodo: c.periodo } },
      data: { capitalBase: c.capitalBase, interes: c.interes },
    })
  }
  const total = cambios.reduce((a, c) => a + c.diferencia, 0)
  if (total) await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar: { increment: total } } })
  return cambios
}
