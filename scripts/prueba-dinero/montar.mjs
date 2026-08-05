// Monta y desmonta el negocio de mentira DENTRO DEL ESPEJO.
//
// ── POR QUÉ POR SQL Y NO POR EL API ─────────────────────────────────────────
//
// No hay endpoint de registro alcanzable con la sesión de otra organización, y
// el registro público arrastra onboarding, verificación de correo y plan de
// prueba: tres fuentes de estado que no controlo, en algo cuya premisa entera
// es «yo definí todos los movimientos».
//
// A partir de aquí TODO va por los endpoints reales. Esto solo pone la mesa.
//
// ⚠ ESCRIBE EN LA BASE. Las tres guardas de abajo son lo único que separa esto
// de escribir en producción. No quitarlas ni «temporalmente».

import mysql from 'mysql2/promise'

export const MARCA = 'ZZ-PRUEBA-DINERO'
const BASE_ESPERADA = 'prestamos_espejo'

/* Ids fijos y reconocibles: se pueden buscar en la base a ojo, y si alguna vez
   se cuela uno en un informe se sabe al instante que es de la prueba. */
export const IDS = {
  org: 'zzpruebadinero0000000000org',
  capital: 'zzpruebadinero0000000capital',
  owner: 'zzpruebadinero000000000owner',
  cobrador: 'zzpruebadinero00000cobrador',
  ruta: 'zzpruebadinero00000000ruta1',
  cliente: (n) => `zzpruebadinero000000cliente${n}`,
}

export async function conectar() {
  const cx = await mysql.createConnection({
    host: '127.0.0.1', port: 3307,
    user: 'cf_test', password: 'cfTest2026_x7Qm',
    database: BASE_ESPERADA,
  })

  // ── LAS TRES GUARDAS ──────────────────────────────────────────────────────
  const [[{ db }]] = await cx.query('SELECT DATABASE() db')
  if (db !== BASE_ESPERADA) {
    await cx.end()
    throw new Error(`ABORTA: la base es "${db}", esperaba "${BASE_ESPERADA}"`)
  }
  // El puerto 3307 solo existe como túnel local al espejo. Si alguien lo
  // reapuntara a producción, esta comprobación no lo vería — por eso además
  // se mira que la base tenga el nombre del espejo, arriba.
  const [[{ n }]] = await cx.query('SELECT COUNT(*) n FROM Organization')
  if (n < 10) {
    await cx.end()
    throw new Error(`ABORTA: solo ${n} organizaciones. El espejo tiene cientos; esto no parece el espejo.`)
  }
  return cx
}

/* El día colombiano en formato YYYY-MM-DD.

   ⚠ NO vale `new Date().toISOString().slice(0,10)`. El VPS corre en UTC y el
   día colombiano va de las 05:00Z a las 05:00Z: entre medianoche y las 5 de la
   mañana UTC, el «hoy» de la aplicación es el día ANTERIOR. Los pagos no se
   pueden fechar (`pagos/route.js:359` escribe `new Date()`), así que la prueba
   entera tiene que caber dentro del mismo día colombiano. */
export function diaColombiano(ahora = Date.now()) {
  return new Date(ahora - 5 * 3600 * 1000).toISOString().slice(0, 10)
}

/* Cuántos minutos faltan para que cambie el día colombiano. Si son pocos, la
   prueba arrancaría en un día y leería la caja en otro: descuadre inventado. */
export function minutosParaElCambioDeDia(ahora = Date.now()) {
  const bog = new Date(ahora - 5 * 3600 * 1000)
  const finDelDia = Date.UTC(bog.getUTCFullYear(), bog.getUTCMonth(), bog.getUTCDate() + 1)
  return Math.round((finDelDia - bog.getTime()) / 60000)
}

// ── BORRAR ──────────────────────────────────────────────────────────────────
//
// En orden de dependencias. Prisma aplica `onDelete: Cascade` en la capa de
// aplicación, NO en la base (lo dice el comentario de scripts/sembrar-demo.mjs),
// así que por SQL hay que barrer a mano y en orden.
const TABLAS_EN_ORDEN = [
  'CuotaAmortizacion', 'Pago', 'MovimientoCapital', 'Prestamo',
  'GastoMenor', 'CierreCaja', 'Cliente', 'Ruta', 'Capital',
  'ActividadLog', 'User', 'Organization',
]

export async function limpiar(cx, { silencioso = false } = {}) {
  const [orgs] = await cx.execute('SELECT id, nombre FROM Organization WHERE nombre = ?', [MARCA])
  if (!orgs.length) {
    if (!silencioso) console.log('  (no hay restos que barrer)')
    return 0
  }

  let filas = 0
  for (const org of orgs) {
    for (const tabla of TABLAS_EN_ORDEN) {
      // CuotaAmortizacion cuelga del préstamo, no de la organización.
      const sql = tabla === 'CuotaAmortizacion'
        ? `DELETE FROM CuotaAmortizacion WHERE prestamoId IN (SELECT id FROM Prestamo WHERE organizationId = ?)`
        : tabla === 'Organization'
          ? 'DELETE FROM Organization WHERE id = ?'
          : `DELETE FROM ${tabla} WHERE organizationId = ?`
      try {
        const [r] = await cx.execute(sql, [org.id])
        filas += r.affectedRows
      } catch (e) {
        // Una tabla que no exista o que no tenga organizationId no debe tumbar
        // la limpieza: se avisa y se sigue, o quedarían huérfanos en silencio.
        if (!silencioso) console.log(`  ⚠ ${tabla}: ${e.sqlMessage || e.message}`)
      }
    }
  }

  // Comprobar que no quedó nada. Sin esto, un modelo nuevo añadido al esquema
  // en el futuro dejaría filas huérfanas sin que nadie se entere.
  const restos = []
  for (const tabla of TABLAS_EN_ORDEN) {
    if (tabla === 'CuotaAmortizacion') continue
    try {
      const [[{ n }]] = await cx.execute(
        `SELECT COUNT(*) n FROM ${tabla} WHERE organizationId = ?`, [IDS.org])
      if (n > 0) restos.push(`${tabla}: ${n}`)
    } catch { /* la tabla no tiene organizationId */ }
  }
  if (restos.length) console.log('  ⚠ QUEDARON FILAS:', restos.join(', '))
  if (!silencioso) console.log(`  barridas ${filas} filas de ${orgs.length} organización(es)`)
  return filas
}

// ── MONTAR ──────────────────────────────────────────────────────────────────
/**
 * @param {object} cx conexión ya guardada
 * @param {object} banderas las de Organization que CAMBIAN LAS FÓRMULAS. Se
 *   fijan siempre explícitamente: dejarlas al default deja la prueba a merced
 *   de que alguien cambie el default.
 */
export async function montar(cx, banderas = {}) {
  await limpiar(cx, { silencioso: true })

  const {
    capitalEsEfectivo = false,
    renovacionesEnCobrado = false,
    requiereAprobacionPrestamos = false,
    capitalEstricto = false,
  } = banderas

  await cx.execute(
    `INSERT INTO Organization
       (id, nombre, plan, activo, country, capitalEsEfectivo, renovacionesEnCobrado,
        requiereAprobacionPrestamos, capitalEstricto, createdAt)
     VALUES (?, ?, 'professional', 1, 'co', ?, ?, ?, ?, NOW())`,
    [IDS.org, MARCA, capitalEsEfectivo, renovacionesEnCobrado,
      requiereAprobacionPrestamos, capitalEstricto])

  // Hash bcrypt de cualquier cosa: no se usa, se entra por JWT firmado.
  const HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

  await cx.execute(
    `INSERT INTO User (id, email, password, nombre, rol, organizationId, activo, createdAt)
     VALUES (?, 'prueba-dinero-owner@test.invalid', ?, 'Dueño de prueba', 'owner', ?, 1, NOW())`,
    [IDS.owner, HASH, IDS.org])

  // El cobrador con TODOS los permisos: si le falta uno, un 403 a mitad de
  // recorrido parecería un fallo de la aplicación y no lo sería.
  await cx.execute(
    `INSERT INTO User (id, email, password, nombre, rol, organizationId, activo,
        puedeGestionarPrestamos, puedeAplicarDescuentos, puedeCrearPrestamos,
        puedeVerSaldoCaja, puedeReportarGastos, createdAt)
     VALUES (?, 'prueba-dinero-cobrador@test.invalid', ?, 'Cobrador de prueba', 'cobrador', ?, 1,
        1, 1, 1, 1, 1, NOW())`,
    [IDS.cobrador, HASH, IDS.org])

  await cx.execute(
    `INSERT INTO Ruta (id, nombre, organizationId, cobradorId, activo, orden, createdAt)
     VALUES (?, 'Ruta de prueba', ?, ?, 1, 1, NOW())`,
    [IDS.ruta, IDS.org, IDS.cobrador])

  // ⚠ CAPITAL EN CERO Y SIN NINGÚN MOVIMIENTO. Es el punto de partida que pidió
  // el dueño: «empieza con una caja en cero». El primer préstamo lo deja en
  // negativo, y eso es correcto — hace visible el desembolso.
  await cx.execute(
    `INSERT INTO Capital (id, organizationId, saldo, createdAt, updatedAt)
     VALUES (?, ?, 0, NOW(), NOW())`,
    [IDS.capital, IDS.org])

  // Uno por modo de interés: así los cuatro flujos no se pisan entre sí.
  const clientes = []
  for (let i = 1; i <= 5; i++) {
    const id = IDS.cliente(i)
    await cx.execute(
      `INSERT INTO Cliente (id, nombre, cedula, telefono, direccion, organizationId, rutaId,
          ordenRuta, estado, createdAt)
       VALUES (?, ?, ?, ?, 'Calle de prueba', ?, ?, ?, 'activo', NOW())`,
      [id, `ZZ Prueba ${i}`, `ZZP-${i}`, `3009900000${i}`, IDS.org, IDS.ruta, i])
    clientes.push(id)
  }

  return { organizationId: IDS.org, rutaId: IDS.ruta, clientes, banderas }
}
