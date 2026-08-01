// ¿POR QUE 1.130 CIERRES DE CAJA DICEN «esperado = 0»?
//
// ── Para que sirve ────────────────────────────────────────────────────────
//
// Medido en produccion: 1.130 de los 2.728 cierres de caja de la plataforma
// (41%) tienen `totalEsperado = 0`. Leyendo el codigo se explican dos causas
// —el cuadre escribe un 0 literal, y el cierre automatico devuelve 0 si el
// cobrador no tiene ruta activa— pero quedaban 492 filas de cobradores que SI
// tienen ruta y a los que igual les salio cero.
//
// Este script coge esas filas y le pregunta a `lib/dinero/esperado.js` —la
// funcion nueva, que si sabe de fechas— cuanto tocaba cobrar ESE dia. Si la
// funcion nueva devuelve una cifra donde la vieja dio cero, el cero era un
// fallo y ahora tiene nombre y tamaño.
//
// SOLO LECTURA. No escribe una sola fila.
//
//   node scripts/explicar-esperado-cero.mjs            # toda la plataforma
//   node scripts/explicar-esperado-cero.mjs --org=xxx  # una sola
//   node scripts/explicar-esperado-cero.mjs --limite=200
//
// Usa el driver de mariadb directo, como los demas scripts de analisis: el
// cliente de Prisma emite TypeScript y node pelado no lo puede importar.

import 'dotenv/config'
import mariadb from 'mariadb'
import { esperadoDeCartera } from '../lib/dinero/esperado.js'

const args = process.argv.slice(2)
const orgFiltro = args.find((a) => a.startsWith('--org='))?.slice(6) || null
const LIMITE = Number(args.find((a) => a.startsWith('--limite='))?.slice(9)) || 500

const url = new URL(process.env.DATABASE_URL)
const pool = mariadb.createPool({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 3,
})

const plata = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

const c = await pool.getConnection()
try {
  // Las filas sospechosas: esperado 0 y el cobrador SI tiene ruta activa.
  const cierres = await c.query(
    `SELECT cc.id, cc.organizationId, cc.cobradorId, DATE_FORMAT(cc.fecha,'%Y-%m-%d') AS fecha,
            cc.totalRecogido, o.nombre AS negocio, o.diasSinCobro AS orgDias, u.nombre AS cobrador
       FROM CierreCaja cc
       JOIN Organization o ON o.id = cc.organizationId
       JOIN User u ON u.id = cc.cobradorId
      WHERE cc.totalEsperado = 0
        ${orgFiltro ? 'AND cc.organizationId = ?' : ''}
        AND EXISTS (SELECT 1 FROM Ruta r WHERE r.cobradorId = cc.cobradorId AND r.activo = 1)
      ORDER BY cc.fecha DESC
      LIMIT ${LIMITE}`,
    orgFiltro ? [orgFiltro] : [],
  )

  console.log(`\n══ ${cierres.length} cierres con «esperado 0» cuyo cobrador SI tiene ruta ══\n`)

  // Los festivos y la cartera se cachean por organizacion: recorrer 500 cierres
  // pidiendo la cartera cada vez seria una consulta por fila.
  const carteraPorCobrador = new Map()
  const festivosPorOrg = new Map()

  async function cartera(organizationId, cobradorId) {
    const clave = `${organizationId}·${cobradorId}`
    if (carteraPorCobrador.has(clave)) return carteraPorCobrador.get(clave)

    const filas = await c.query(
      `SELECT cl.id AS clienteId, cl.diasSinCobro AS cliDias, r.diasSinCobro AS rutaDias,
              p.id, p.cuotaDiaria, p.frecuencia, p.fechaInicio, p.diasPlazo,
              p.diaCobroSemana, p.diaCobroMes, p.diaCobroMes2, p.diasSinCobro AS presDias,
              p.totalAPagar, p.totalPagado, p.modoInteres
         FROM Cliente cl
         JOIN Ruta r ON r.id = cl.rutaId AND r.cobradorId = ? AND r.activo = 1
         JOIN Prestamo p ON p.clienteId = cl.id AND p.estado = 'activo' AND p.esClavo = 0
        WHERE cl.organizationId = ? AND cl.estado <> 'eliminado'`,
      [cobradorId, organizationId],
    )

    // Se agrupa por cliente, que es la forma que espera esperadoDeCartera.
    const porCliente = new Map()
    for (const f of filas) {
      if (!porCliente.has(f.clienteId)) {
        porCliente.set(f.clienteId, {
          diasSinCobro: f.cliDias,
          ruta: { diasSinCobro: f.rutaDias },
          prestamos: [],
        })
      }
      porCliente.get(f.clienteId).prestamos.push({
        id: f.id,
        cuotaDiaria: Number(f.cuotaDiaria),
        frecuencia: f.frecuencia,
        fechaInicio: f.fechaInicio,
        diasPlazo: f.diasPlazo,
        diaCobroSemana: f.diaCobroSemana,
        diaCobroMes: f.diaCobroMes,
        diaCobroMes2: f.diaCobroMes2,
        diasSinCobro: f.presDias,
        totalAPagar: Number(f.totalAPagar),
        totalPagado: Number(f.totalPagado),
        modoInteres: f.modoInteres,
        cuotasAmortizacion: [],
      })
    }
    const lista = [...porCliente.values()]
    carteraPorCobrador.set(clave, lista)
    return lista
  }

  async function festivos(organizationId) {
    if (festivosPorOrg.has(organizationId)) return festivosPorOrg.get(organizationId)
    const f = await c.query('SELECT fecha FROM Festivo WHERE organizationId = ?', [organizationId])
    festivosPorOrg.set(organizationId, f)
    return f
  }

  let deberianTenerCifra = 0
  let ceroCorrecto = 0
  let sumaPerdida = 0
  const porNegocio = new Map()

  for (const cierre of cierres) {
    const clientes = await cartera(cierre.organizationId, cierre.cobradorId)
    const fest = await festivos(cierre.organizationId)
    const org = { diasSinCobro: cierre.orgDias }

    const r = esperadoDeCartera({ clientes, org, festivos: fest }, cierre.fecha + 'T12:00:00Z')

    if (r.esperado > 0) {
      deberianTenerCifra += 1
      sumaPerdida += r.esperado
      const k = cierre.negocio
      if (!porNegocio.has(k)) porNegocio.set(k, { n: 0, monto: 0, ejemplo: null })
      const e = porNegocio.get(k)
      e.n += 1
      e.monto += r.esperado
      if (!e.ejemplo) e.ejemplo = `${cierre.fecha} · ${cierre.cobrador} · decia 0, eran ${plata(r.esperado)} (${r.conCobro} cobros)`
    } else {
      // Cero de verdad: ese dia el calendario no pedia nada. Pasa mucho en
      // carteras semanales, donde solo un dia de cada siete tiene cobro.
      ceroCorrecto += 1
    }
  }

  console.log(`   el cero era CORRECTO ....... ${ceroCorrecto}`)
  console.log(`   el cero era un FALLO ....... ${deberianTenerCifra}`)
  console.log(`   meta que nunca se comparo .. ${plata(sumaPerdida)}`)
  console.log('')

  if (porNegocio.size) {
    console.log('── por negocio ──')
    for (const [nombre, e] of [...porNegocio.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, 12)) {
      console.log(`   ${nombre.slice(0, 30).padEnd(30)} ${String(e.n).padStart(4)} cierres · ${plata(e.monto).padStart(16)}`)
      console.log(`      ej: ${e.ejemplo}`)
    }
  }
  console.log('')
} finally {
  c.release()
  await pool.end()
}
