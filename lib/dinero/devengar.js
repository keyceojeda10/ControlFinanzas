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
import { devengosPendientes, reajusteDeDevengos, esAbiertoConDevengo, periodoEnCursoAbierto } from '@/lib/calculos'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'

/** Lo que hay que traer del préstamo para poder devengarlo. */
export const SELECT_PARA_DEVENGAR = {
  id: true, organizationId: true, montoPrestado: true, ...CAMPOS_DEL_REPARTO, tasaInteres: true,
  frecuencia: true, fechaInicio: true, modoInteres: true, sinPlazo: true,
  totalAPagar: true, diaCobroMes: true, diaCobroMes2: true, primerCobro: true, interesPorMes: true,
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
  /* La cuota no puede tumbar el asiento, que ya entró: si falla, se arregla
     con el siguiente pago o la siguiente noche. */
  if (asentados) {
    try { await refrescarCuotaAbierto(prisma, p.id, ahora) } catch (e) { console.error('[devengo] cuota de ' + p.id + ':', e?.message) }
  }
  return { asentados, interes, choques }
}

/**
 * Asienta el período que está corriendo cuando el ABONO PREVIO ya lo pagó
 * (10 nov 2026, Créditos pete). Es lo que hace un cobro de interés por
 * adelantado en la hoja de pago (`pagos/route.js`), aplicado al pasar un
 * préstamo que ya estaba en la calle: «el 5 me pagó el interés de todo el mes,
 * para dar la quincena del 20». Sin esto el servidor no aceptaba ese abono como
 * interés —solo lo ya cerrado— o, como «Cuotas», lo mandaba a capital.
 *
 * Se asienta el período ENTERO, igual que la hoja de pago: lo pagado se queda
 * como interés y la deuda sigue siendo el capital. Va DESPUÉS de
 * `devengarAlCrear`, que asienta lo ya cerrado. P2002 = ya estaba: no pasa nada.
 *
 * @returns {Promise<{periodo: string, interes: number} | null>}
 */
export async function asentarPeriodoPagadoAlCrear(prisma, prestamoId, ahora = Date.now()) {
  const p = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    select: { ...SELECT_PARA_DEVENGAR, estado: true },
  })
  if (!p || !esAbiertoConDevengo(p)) return null
  const enCurso = periodoEnCursoAbierto(p, ahora)
  if (!enCurso || !(enCurso.interesPeriodo > 0)) return null
  if ((p.devengos ?? []).some((d) => d.periodo === enCurso.periodo)) return null
  try {
    await prisma.$transaction(async (tx) => {
      await tx.devengoInteres.create({
        data: {
          prestamoId: p.id, organizationId: p.organizationId,
          periodo: enCurso.periodo, capitalBase: enCurso.capitalBase, interes: enCurso.interesPeriodo,
        },
      })
      await tx.prestamo.update({
        where: { id: p.id },
        data: { totalAPagar: { increment: enCurso.interesPeriodo } },
      })
    })
  } catch (e) {
    if (e?.code === 'P2002') return null
    throw e
  }
  try { await refrescarCuotaAbierto(prisma, p.id, ahora) } catch (e) { console.error('[devengo] cuota de ' + p.id + ':', e?.message) }
  return { periodo: enCurso.periodo, interes: enCurso.interesPeriodo }
}

/* ══ LA CUOTA DE UN ABIERTO ES EL INTERÉS DEL MES QUE CORRE (5 nov 2026) ═════
 *
 * `cuotaDiaria` se fijaba al crear el préstamo —el interés sobre el capital
 * inicial— y no volvía a moverse. Yaneris Díaz (Inversiones Jk) iba en
 * $750.000 de capital y la ficha, el WhatsApp y «lo esperado» de la caja
 * seguían diciendo «cuota $180.000» (el 12 % de $1.500.000).
 *
 * Se recalcula cuando puede cambiar: al asentar un mes (empieza otro) y al
 * registrar, mover o anular un pago (`reajustarDevengosTrasCambio`). Es el
 * mismo número que `periodoEnCursoAbierto`: capital con que empezó el mes ×
 * tasa. Recibe el cliente o la transacción. */
export async function refrescarCuotaAbierto(db, prestamoId, ahora = Date.now()) {
  const p = await db.prestamo.findUnique({
    where: { id: prestamoId },
    select: { ...SELECT_PARA_DEVENGAR, cuotaDiaria: true },
  })
  if (!p || !esAbiertoConDevengo(p)) return null
  const cuota = periodoEnCursoAbierto(p, ahora)?.interesPeriodo
  if (!(cuota > 0) || Math.round(cuota) === Math.round(Number(p.cuotaDiaria) || 0)) return null
  await db.prestamo.update({ where: { id: prestamoId }, data: { cuotaDiaria: cuota } })
  return cuota
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
  const cambios = await reajustarSoloDevengos(tx, prestamoId, armarAntes)
  // Y la cuota, que es el interés del mes que corre: un pago con fecha del corte
  // la mueve. Solo en un abierto (`null` = no lo es): el cobro de los demás no paga la consulta.
  if (cambios) await refrescarCuotaAbierto(tx, prestamoId)
  return cambios ?? []
}

async function reajustarSoloDevengos(tx, prestamoId, armarAntes) {
  const p = await tx.prestamo.findUnique({
    where: { id: prestamoId },
    select: {
      id: true, modoInteres: true, sinPlazo: true, tasaInteres: true, frecuencia: true, fechaInicio: true,
      diaCobroMes: true, diaCobroMes2: true, primerCobro: true, interesPorMes: true, montoPrestado: true,
      pagos: { select: { id: true, tipo: true, montoPagado: true, fechaPago: true } },
      devengos: { select: { periodo: true, interes: true, capitalBase: true } },
    },
  })
  if (!p || !esAbiertoConDevengo(p)) return null
  if (!(p.devengos ?? []).length) return []
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
