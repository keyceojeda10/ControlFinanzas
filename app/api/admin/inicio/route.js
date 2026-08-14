/* app/api/admin/inicio/route.js — la única pantalla de cabecera del panel.
 *
 * Sustituye a `stats` (Dashboard), `negocio` y `metricas`, que contestaban lo
 * mismo con cifras distintas. Responde CUATRO preguntas y ninguna más:
 *
 *   1. ¿Cuánto entró?          → del libro de pagos, no del MRR
 *   2. ¿Cuánto debería entrar? → MRR real + lo que vence esta semana
 *   3. ¿Quién está vivo?       → actividad y registros
 *   4. ¿Qué se está cayendo?   → a quién hay que llamar hoy
 *
 * ⚠ EL MRR VIEJO COBRABA POR GENTE QUE NO PAGA. `stats/route.js` contaba todas
 *   las organizaciones con `activo = true` por el precio de su plan, y `activo`
 *   lo tienen LAS 485 sin excepción: nadie lo ha puesto en false nunca. Daba
 *   $23.038.000 donde hay $2.570.800. Aquí el MRR sale de sumar lo que cada uno
 *   paga de verdad, en lib/admin/segmentos.js.
 *
 * ⚠ EL MES SE CORTA EN BOGOTÁ, NO EN UTC. El servidor corre en UTC y el dueño
 *   piensa en meses colombianos: lo cobrado entre las 19:00 y medianoche del
 *   último día del mes cae en el mes siguiente si se mide en UTC. Hoy es UN
 *   pago de los 102 (el del 1 de julio a las 02:47 UTC, que es del 30 de junio
 *   en Bogotá), pero es la clase de desfase que nadie encuentra después.
 */
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { segmentarOrganizaciones, SELECT_ORG_SEGMENTO } from '@/lib/admin/segmentos'

/** Los internos no son clientes: falsean el conteo de registros y el de activos. */
const EMAILS_INTERNOS = ['keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com', 'controlfinanzasgmail@gmail.com']

const DIA = 86400000
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Clave `2026-08` del mes de Bogotá al que pertenece un instante. */
function mesBogota(d) {
  const b = new Date(new Date(d).getTime() - 5 * 3600000)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(clave) {
  const [a, m] = clave.split('-')
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora = new Date()
  const hace15min = new Date(ahora - 15 * 60000)
  // El día de Bogotá empieza a las 05:00 UTC. Mismo convenio que el resto de la app.
  const hoyBogota = new Date(ahora.getTime() - 5 * 3600000)
  const inicioHoy = new Date(Date.UTC(hoyBogota.getUTCFullYear(), hoyBogota.getUTCMonth(), hoyBogota.getUTCDate(), 5))
  const inicioSemana = new Date(inicioHoy.getTime() - ((hoyBogota.getUTCDay() + 6) % 7) * DIA)
  const inicioMes = new Date(Date.UTC(hoyBogota.getUTCFullYear(), hoyBogota.getUTCMonth(), 1, 5))
  const en7Dias = new Date(ahora.getTime() + 7 * DIA)
  // Seis meses hacia atrás, con margen para que el corte de Bogotá no se coma el primero.
  const desdeSerie = new Date(Date.UTC(hoyBogota.getUTCFullYear(), hoyBogota.getUTCMonth() - 5, 1, 0))

  const sinInternos = { users: { none: { email: { in: EMAILS_INTERNOS } } } }

  const [orgsRaw, pagos, activosAhora, registrosHoy, registrosSemana, registrosMes] = await Promise.all([
    prisma.organization.findMany({ where: sinInternos, select: SELECT_ORG_SEGMENTO }),
    // El libro. Una fila por pago; esto es lo que no existía.
    prisma.pagoSuscripcion.findMany({
      where: { fecha: { gte: desdeSerie } },
      select: { montoCOP: true, fecha: true, gateway: true, origen: true },
    }),
    prisma.user.count({
      where: { rol: 'owner', lastActivityAt: { gte: hace15min }, email: { notIn: EMAILS_INTERNOS } },
    }),
    prisma.organization.count({ where: { createdAt: { gte: inicioHoy },    ...sinInternos } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioSemana }, ...sinInternos } }),
    prisma.organization.count({ where: { createdAt: { gte: inicioMes },    ...sinInternos } }),
  ])

  const { fichas, mrr, porSegmento, totalReal } = segmentarOrganizaciones(orgsRaw, ahora)

  /* ── 1 · Cuánto entró ─────────────────────────────────────────────────── */
  const porMes = {}
  for (const p of pagos) {
    const k = mesBogota(p.fecha)
    porMes[k] = (porMes[k] ?? 0) + p.montoCOP
  }
  const claves = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(hoyBogota.getUTCFullYear(), hoyBogota.getUTCMonth() - i, 1))
    claves.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const serie = claves.map((k) => ({ mes: k, rotulo: rotuloMes(k), entro: porMes[k] ?? 0 }))
  const claveEsteMes = claves[claves.length - 1]
  const clavePasado  = claves[claves.length - 2]
  const pagosEsteMes = pagos.filter((p) => mesBogota(p.fecha) === claveEsteMes)

  /* ⚠ Lo reconstruido no es lo mismo que lo registrado en vivo: el monto salió
     de leer un texto de `AdminLog`. La pantalla lo dice cuando toca. */
  const reconstruidos = pagos.filter((p) => p.origen === 'reconstruido').length

  /* ── 2 · Cuánto debería entrar ────────────────────────────────────────── */
  const vencenPronto = fichas
    .filter((f) => f.segmento === 'pagando' && f.fechaVencimiento
      && new Date(f.fechaVencimiento) <= en7Dias && new Date(f.fechaVencimiento) >= ahora)
    .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))

  /* ── 4 · Qué se está cayendo ──────────────────────────────────────────── */
  // Los que pagaban y dejaron de pagar van primero: es plata que YA era suya.
  const aLlamar = [
    ...fichas.filter((f) => f.segmento === 'churn'),
    ...fichas.filter((f) => f.segmento === 'vencido' && f.prestamos >= 3),
  ]
    .sort((a, b) => b.prestamos - a.prestamos)
    .slice(0, 12)
    .map((f) => ({
      id: f.id, nombre: f.nombre, segmento: f.segmento,
      ownerNombre: f.ownerNombre, ownerTelefono: f.ownerTelefono,
      clientes: f.clientes, prestamos: f.prestamos,
      diasSinActividad: f.diasSinActividad,
      fechaVencimiento: f.fechaVencimiento,
    }))

  return NextResponse.json({
    entro: {
      esteMes:   porMes[claveEsteMes] ?? 0,
      mesPasado: porMes[clavePasado] ?? 0,
      pagosEsteMes: pagosEsteMes.length,
      serie,
      reconstruidos,
      hayLibro: pagos.length > 0,
    },
    deberiaEntrar: {
      mrr,
      pagando: porSegmento.pagando ?? 0,
      vencenPronto: vencenPronto.length,
      montoVencePronto: vencenPronto.reduce((s, f) => s + f.precio, 0),
      proximos: vencenPronto.slice(0, 8).map((f) => ({
        id: f.id, nombre: f.nombre, precio: f.precio,
        fechaVencimiento: f.fechaVencimiento, diasRestantes: f.diasRestantes,
        ownerNombre: f.ownerNombre, ownerTelefono: f.ownerTelefono,
      })),
    },
    vivos: {
      activosAhora,
      registrosHoy, registrosSemana, registrosMes,
      totalReal,
      porSegmento,
    },
    aLlamar,
  })
}
