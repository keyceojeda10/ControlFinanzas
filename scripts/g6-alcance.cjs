// scripts/g6-alcance.cjs — SOLO LECTURA. Cuánta mora estaba a un abono de
// distancia de borrarse.
//
// Hasta ahora, un abono a capital reprogramaba TODA fila sin pagar, vencida o
// no. Este script no mira el pasado —ese daño ya está horneado y va en G8 con
// consentimiento— sino el riesgo VIVO: de los préstamos activos con tabla,
// cuántos tienen hoy cuotas vencidas sin pagar que un solo abono habría
// borrado, y cuánto suman.
//
//   node scripts/g6-alcance.cjs

require('dotenv').config()
const { crearPrisma } = require('../lib/prisma-cjs.cjs')
const prisma = crearPrisma()

// Mismo corte de día que `lib/dinero/esperado.js`: Colombia, UTC-5.
function inicioDia(v) {
  const d = new Date(v)
  const t = d.getTime() + (-5) * 3600000
  const s = new Date(t)
  s.setUTCHours(0, 0, 0, 0)
  return s.getTime() - (-5) * 3600000
}

async function main() {
  const hoy = inicioDia(Date.now())

  const prestamos = await prisma.prestamo.findMany({
    where: { estado: 'activo' },
    select: {
      id: true, montoPrestado: true, totalAPagar: true, modoInteres: true,
      organization: { select: { nombre: true } },
      cliente: { select: { nombre: true } },
      cuotasAmortizacion: {
        select: { numeroPeriodo: true, fechaEsperada: true, cuotaTotal: true, pagado: true, capital: true },
      },
      pagos: { where: { tipo: 'capital' }, select: { id: true } },
    },
  })

  let conTabla = 0, enRiesgo = 0, moraEnRiesgo = 0, capitalEnRiesgo = 0
  const yaAbonaron = []
  const peores = []

  for (const p of prestamos) {
    const filas = p.cuotasAmortizacion || []
    if (!filas.length) continue
    conTabla++

    const vencidasSinPagar = filas.filter(f =>
      (f.pagado || 0) < f.cuotaTotal && f.fechaEsperada && inicioDia(f.fechaEsperada) < hoy)
    if (!vencidasSinPagar.length) continue

    enRiesgo++
    const debe = vencidasSinPagar.reduce((a, f) => a + (f.cuotaTotal - (f.pagado || 0)), 0)
    const cap = vencidasSinPagar.reduce((a, f) => a + (f.capital || 0), 0)
    moraEnRiesgo += debe
    capitalEnRiesgo += cap

    const fila = {
      org: p.organization?.nombre, cliente: p.cliente?.nombre, modo: p.modoInteres,
      cuotas: vencidasSinPagar.length, debe, capital: cap,
    }
    peores.push(fila)
    if (p.pagos.length) yaAbonaron.push(fila)
  }

  peores.sort((a, b) => b.debe - a.debe)
  const money = (n) => '$' + Math.round(n).toLocaleString('es-CO')

  console.log('── G6 · cuánta mora estaba a un abono de distancia ──')
  console.log(`Préstamos activos ................ ${prestamos.length}`)
  console.log(`  con tabla de amortización ...... ${conTabla}`)
  console.log(`  CON CUOTAS VENCIDAS SIN PAGAR .. ${enRiesgo}`)
  console.log(`Mora que un abono habría borrado . ${money(moraEnRiesgo)}`)
  console.log(`  de eso, capital ................ ${money(capitalEnRiesgo)}`)
  console.log(`Y que YA hicieron un abono ....... ${yaAbonaron.length}`)
  console.log('\nLos cinco mayores:')
  for (const f of peores.slice(0, 5)) {
    console.log(`  ${f.cliente} (${f.org}) · ${f.modo} · ${f.cuotas} cuotas · ${money(f.debe)}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
