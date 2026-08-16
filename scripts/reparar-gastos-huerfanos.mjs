/* ══ DEVOLVER LA PLATA DE LOS GASTOS QUE SE BORRARON SIN REVERSO ═════════════
 *
 * Arreglar el código no arregla los días que ya quedaron rotos. Estos son los
 * gastos que el libro tiene asentados, cuya fila de gastos ya no existe, y a los
 * que nunca se les escribió el movimiento contrario.
 *
 * Cada uno deja la caja de ese día diciendo «gastos que no cuadran» para
 * siempre, y descuenta del saldo una plata que el prestamista decidió que no
 * era un gasto.
 *
 * ⚠ SE ESCRIBE POR EL CAMINO DE LA APP, no con SQL a pelo.
 *   `registrarMovimientoCapital` encadena `saldoAnterior`/`saldoNuevo` y mueve
 *   `Capital.saldo`. Un INSERT a mano deja el encadenado roto y el siguiente
 *   asiento arrastra el error.
 *
 * ⚠ EL REVERSO VA CON LA FECHA DEL GASTO. Con la de hoy se rompen dos días en
 *   vez de arreglar uno — que es como llegaron aquí algunos de estos.
 *
 * Solo entra el que cumple LAS TRES cosas:
 *   · el libro tiene su asiento de gasto,
 *   · la fila del gasto ya no existe,
 *   · y no hay ningún reverso suyo.
 * Y además se comprueba que el borrado quedó registrado como acción de una
 * persona: si nadie lo borró, esto no sabe qué pasó y no lo toca.
 *
 * En seco por defecto. Para escribir: `--aplicar`.
 */

/* ⚠ SE CORRE DESDE EL PORTATIL POR UN TUNEL, NO EN EL VPS.
 * Alli el cliente de Prisma esta generado en TypeScript y el alias `@/` no
 * existe fuera de Next, asi que un `node scripts/...` no arranca. Y hace falta
 * el codigo REAL de la app: `registrarMovimientoCapital` encadena los saldos y
 * mueve `Capital.saldo`. Con SQL a pelo el encadenado queda roto y el siguiente
 * asiento arrastra el error.
 *
 *   ssh -f -N -L 3307:127.0.0.1:3306 root@...
 *   DATABASE_URL='...127.0.0.1:3307/prestamos_db' npx vitest run .auditoria/reparar.test.js
 */
import { registrarMovimientoCapital, gastoAsentadoSinRevertir } from '@/lib/capital'
const { prisma } = await import('@/lib/prisma')

const APLICAR = process.env.APLICAR === 'si'
const money = (n) => '$' + Math.round(n).toLocaleString('es-CO')

const huerfanos = await prisma.$queryRawUnsafe(`
  SELECT m.id, m.organizationId, m.referenciaId AS gastoId, m.monto, m.createdAt,
         m.rutaId, m.descripcion, o.nombre AS negocio,
         (SELECT COUNT(*) FROM ActividadLog a
           WHERE a.organizationId = m.organizationId
             AND a.accion = 'eliminar_gasto' AND a.entidadId = m.referenciaId) AS borradoAMano
  FROM MovimientoCapital m
  LEFT JOIN GastoMenor g ON g.id = m.referenciaId
  JOIN Organization o ON o.id = m.organizationId
  WHERE m.tipo = 'gasto' AND m.referenciaTipo = 'gasto' AND g.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM MovimientoCapital r
      WHERE r.referenciaId = m.referenciaId AND r.referenciaTipo = 'gasto' AND r.tipo = 'ajuste')
  ORDER BY m.monto DESC
`)

console.log(`${APLICAR ? '── APLICANDO ──' : '── EN SECO (nada se escribe) ──'}\n`)
console.log(`Gastos huérfanos: ${huerfanos.length}\n`)

let devuelto = 0, saltados = 0
for (const h of huerfanos) {
  const seBorro = Number(h.borradoAMano) > 0
  const dia = new Date(h.createdAt).toISOString().slice(0, 10)
  const etiqueta = `${String(h.negocio).slice(0, 26).padEnd(27)} ${money(h.monto).padStart(12)}  ${dia}`

  if (!seBorro) {
    // Nadie registró el borrado: no sabemos qué pasó, así que no se toca.
    console.log(`${etiqueta}  ⏭  SALTADO — nadie registró que lo borrara`)
    saltados++
    continue
  }

  if (!APLICAR) {
    console.log(`${etiqueta}  →  se le devolverían ${money(h.monto)}`)
    devuelto += Number(h.monto)
    continue
  }

  await prisma.$transaction(async (tx) => {
    // Se vuelve a preguntar DENTRO de la transacción: entre la consulta de
    // arriba y este momento alguien pudo haberlo arreglado desde la app.
    const pendiente = await gastoAsentadoSinRevertir(tx, h.organizationId, h.gastoId)
    if (pendiente <= 0) {
      console.log(`${etiqueta}  ⏭  ya no hacía falta`)
      return
    }
    await registrarMovimientoCapital(tx, {
      organizationId: h.organizationId,
      tipo: 'ajuste',
      monto: pendiente,
      direccion: 'ingreso',
      descripcion: `Reverso gasto eliminado: ${String(h.descripcion).replace(/^Gasto: /, '')}`,
      referenciaId: h.gastoId,
      referenciaTipo: 'gasto',
      rutaId: h.rutaId,
      creadoPorId: null,
      fecha: h.createdAt,
    })
    devuelto += pendiente
    console.log(`${etiqueta}  ✓  devueltos ${money(pendiente)}`)
  })
}

console.log(`\n${APLICAR ? 'Devuelto' : 'Se devolvería'}: ${money(devuelto)}${saltados ? `  ·  saltados: ${saltados}` : ''}`)
