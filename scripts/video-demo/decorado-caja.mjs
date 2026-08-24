// scripts/video-demo/decorado-caja.mjs
//
// EL DÍA DE LA CAJA, SIEMPRE IGUAL
//
// Los tres vídeos de caja —11 cobrador, 18 dueño solo, 19 dueño con
// cobradores— enseñan EL MISMO DÍA desde tres sitios distintos, y las cifras
// que dice la voz son estas:
//
//     cobrado    $92.600    los cuatro cobros de la ruta
//     prestado  $450.000    un desembolso de hoy
//     en la mano −$357.400  la resta, que es de lo que va la explicación
//
// Si el decorado cambia, la voz miente. Por eso se monta aquí y no en cada
// guion: tres copias de la misma preparación acaban divergiendo, y el día que
// una cambie el vídeo que la use dirá otra cosa.
//
// ── ⚠ LO QUE HAY QUE BORRAR ANTES, Y POR QUÉ NO ES OBVIO ───────────────────
//
// Grabando el vídeo 18 me encontré la caja del dueño con un aviso rojo:
//
//     «Hoy la cuenta no cierra: $400.000 de préstamos que no cuadran»
//
// No era un fallo del sistema: era MI PROPIA GRABACIÓN. El vídeo 5 crea
// préstamos de verdad y su limpieza borraba la fila de `Prestamo` pero **no sus
// movimientos de capital**. El libro se quedaba con un desembolso cuyo préstamo
// ya no existe, que es exactamente lo que esa comprobación caza.
//
// Un tutorial que abre con una alarma roja es peor que no tener tutorial, así
// que aquí se limpian las dos cosas: la fila y su rastro.

import { conectar, IDS } from './montar-demo.mjs'

/** Deja el día en cero: sin cobros, sin gastos, sin cierres y sin desembolsos. */
export async function borrarElDia() {
  const cx = await conectar()

  // Los préstamos que hayan creado las grabaciones hoy, con su rastro.
  const [creadosHoy] = await cx.query(
    `SELECT id FROM Prestamo WHERE organizationId = ? AND DATE(createdAt) = CURDATE()`, [IDS.org])
  const ids = creadosHoy.map((x) => x.id)
  if (ids.length) {
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids])
    await cx.query('DELETE FROM MovimientoCapital WHERE referenciaId IN (?)', [ids])
    await cx.query('DELETE FROM Prestamo WHERE id IN (?)', [ids])
  }

  /* ⚠ Y LOS MOVIMIENTOS HUÉRFANOS, que son los que encienden la alarma.
     Un desembolso cuyo préstamo ya no existe deja la comprobación del libro sin
     cuadrar para siempre, y el aviso sale en TODOS los vídeos de caja que se
     graben después. */
  await cx.query(
    `DELETE m FROM MovimientoCapital m
      LEFT JOIN Prestamo p ON p.id = m.referenciaId
      WHERE m.organizationId = ? AND m.referenciaTipo = 'prestamo' AND p.id IS NULL`, [IDS.org])

  const [todos] = await cx.query(
    `SELECT p.id FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId WHERE c.organizationId = ?`,
    [IDS.org])
  const vivos = todos.map((x) => x.id)
  if (vivos.length) {
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [vivos])
    await cx.query("UPDATE Prestamo SET totalPagado = 0, estado = 'activo' WHERE id IN (?)", [vivos])
  }
  await cx.query('DELETE FROM GastoMenor WHERE organizationId = ?', [IDS.org]).catch(() => {})
  await cx.query('DELETE FROM CierreCaja WHERE organizationId = ?', [IDS.org]).catch(() => {})
  await cx.query(
    `DELETE FROM MovimientoCapital WHERE organizationId = ? AND tipo = 'recaudo'`, [IDS.org])

  await cx.end()
}

/**
 * Monta el día: cuatro cobros y un desembolso, por los endpoints de verdad.
 *
 * ⚠ POR EL ENDPOINT Y NO POR SQL. Las cifras que salen en pantalla tienen que
 *   ser las que el sistema calcula, no las que yo escriba en la base: si un día
 *   cambia cómo se reparte un pago, el vídeo tiene que enseñar lo nuevo o dejar
 *   de ser cierto.
 *
 * @param base   la URL del espejo contra el que se graba
 * @param cookie sesión de QUIEN cobra (el cobrador, o el dueño en el vídeo 18)
 */
export async function montarElDia(base, cookie) {
  const cx = await conectar()
  const [ps] = await cx.query(
    `SELECT p.id, p.cuotaDiaria FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId
      WHERE c.rutaId = ? ORDER BY c.ordenRuta LIMIT 4`, [IDS.ruta])
  const [[cli]] = await cx.query(
    `SELECT id FROM Cliente WHERE rutaId = ? ORDER BY ordenRuta LIMIT 1`, [IDS.ruta])
  await cx.end()

  const H = { cookie: `next-auth.session-token=${cookie}`, 'Content-Type': 'application/json' }

  for (const p of ps) {
    const r = await fetch(`${base}/api/prestamos/${p.id}/pagos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ montoPagado: p.cuotaDiaria, tipo: 'completo', metodoPago: 'efectivo' }),
    })
    if (!r.ok) console.warn(`   ⚠ cobro no registrado: ${r.status} ${(await r.text()).slice(0, 120)}`)
  }

  if (cli) {
    const r = await fetch(`${base}/api/prestamos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        clienteId: cli.id, montoPrestado: 450000, tasaInteres: 20, diasPlazo: 30,
        frecuencia: 'diario', modoInteres: 'plano', metodoPago: 'efectivo',
        // ⚠ Obligatoria: sin ella el endpoint responde 400 y el renglón «Lo que
        //   prestaste» se queda en $0 sin que nada avise.
        fechaInicio: new Date().toISOString().slice(0, 10),
        nombreProducto: 'VIDEO-CAJA',
      }),
    })
    if (!r.ok) console.warn(`   ⚠ desembolso no creado: ${r.status} ${(await r.text()).slice(0, 120)}`)
  }
}

/**
 * Enciende o apaga al cobrador de la demo.
 *
 * El vídeo 18 es «la caja cuando cobras tú solo», y esa pantalla solo existe si
 * el negocio NO tiene cobradores: «Cuadre» aparece con
 * `cobradoresParaFiltro.length > 0` (`caja/page.jsx:1537`) y «Mi cierre del
 * día» sale cuando no hay ninguno (`:1972`).
 *
 * ⚠ NO BASTA CON APAGARLO. El API lista también a los inactivos que tuvieron
 *   movimiento ese día (`api/caja/route.js:1097`) — se hizo a propósito, para
 *   que al reemplazar un cobrador no desapareciera su caja de ayer. Así que el
 *   día del vídeo 18 lo tiene que cobrar el DUEÑO, no él.
 *
 * ⚠ Y SE DEVUELVE COMO ESTABA. Dejar la demo sin cobrador rompe los vídeos 8,
 *   11 y 19, y el fallo aparecería en la siguiente grabación, no en esta.
 */
export async function cobradorActivo(encendido) {
  const cx = await conectar()
  await cx.query('UPDATE User SET activo = ? WHERE id = ?', [encendido ? 1 : 0, IDS.cobrador])
  await cx.end()
}

/**
 * Se lleva el decorado al terminar.
 *
 * ⚠ HACE FALTA, y me lo enseñó el vídeo 15: el préstamo de 450.000 que monta
 *   `montarElDia` se quedó vivo después de grabar la caja, y al volver a grabar
 *   préstamos la lista abría con un cliente «NUEVO» de $540.000 que no es del
 *   negocio de mentira. El decorado de un vídeo no puede aparecer en otro.
 */
export async function quitarElDecorado() {
  const cx = await conectar()
  const [ps] = await cx.query(
    `SELECT id FROM Prestamo WHERE organizationId = ? AND nombreProducto = 'VIDEO-CAJA'`, [IDS.org])
  const ids = ps.map((x) => x.id)
  if (ids.length) {
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids])
    await cx.query('DELETE FROM MovimientoCapital WHERE referenciaId IN (?)', [ids])
    await cx.query('DELETE FROM Prestamo WHERE id IN (?)', [ids])
  }
  await cx.query(
    `DELETE m FROM MovimientoCapital m
      LEFT JOIN Prestamo p ON p.id = m.referenciaId
      WHERE m.organizationId = ? AND m.referenciaTipo = 'prestamo' AND p.id IS NULL`, [IDS.org])
  await cx.end()
}
