#!/usr/bin/env node
/**
 * ¿El bot de WhatsApp está bien AHORA MISMO?
 *
 * Correr en el VPS:
 *     cd /home/control-finanzas && node scripts/salud-bot.cjs
 *
 * Responde tres cosas, en orden de importancia:
 *   1. ¿Está contestando? (hay mensajes recientes)
 *   2. ¿Están LLEGANDO sus respuestas? (tasa de entrega)
 *   3. ¿Meta lo tiene bloqueado por pago o por límite?
 *
 * Existe porque el bot se cayó tres días en silencio y nadie se enteró.
 */
require('dotenv').config()
const { crearPrisma } = require('../lib/prisma-cjs.cjs')

const H = 36e5
const PID = process.env.WHATSAPP_PHONE_NUMBER_ID
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN

// Errores que significan "Meta te cortó", no "este número no existe"
const CORTE = {
  131042: 'PAGO — Meta bloqueó los envíos por facturación',
  131031: 'CUENTA RESTRINGIDA por Meta',
  368: 'CUENTA BLOQUEADA temporalmente',
}
const LIMITE = { 131049: 'Meta limitó envíos masivos (calidad de interacción)' }

const ok = s => `\x1b[32m${s}\x1b[0m`
const mal = s => `\x1b[31m${s}\x1b[0m`
const ojo = s => `\x1b[33m${s}\x1b[0m`

;(async () => {
  const prisma = crearPrisma()
  const problemas = []

  // ── 1. ¿Contesta? ──────────────────────────────────────────
  const ultimo = await prisma.botConversacion.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, rol: true },
  })
  const horas = ultimo ? (Date.now() - ultimo.createdAt.getTime()) / H : Infinity
  const msgs24 = await prisma.botConversacion.count({
    where: { createdAt: { gte: new Date(Date.now() - 24 * H) } },
  })

  console.log('\n═══ 1. ¿ESTÁ CONTESTANDO? ═══')
  if (horas > 12) {
    console.log(mal(`  ✗ Sin actividad hace ${horas.toFixed(1)} horas`))
    problemas.push('El bot lleva medio día sin mover un mensaje')
  } else {
    console.log(ok(`  ✓ Último mensaje hace ${horas.toFixed(1)}h · ${msgs24} en 24h`))
  }

  // ── 2. ¿Llegan sus respuestas? ─────────────────────────────
  const desde = new Date(Date.now() - 24 * H)
  const [total, entregados, fallidos] = await Promise.all([
    prisma.botConversacion.count({ where: { rol: 'bot', createdAt: { gte: desde }, estadoEntrega: { not: null } } }),
    prisma.botConversacion.count({ where: { rol: 'bot', createdAt: { gte: desde }, estadoEntrega: { in: ['entregado', 'leido'] } } }),
    prisma.botConversacion.count({ where: { rol: 'bot', createdAt: { gte: desde }, estadoEntrega: 'fallido' } }),
  ])
  const pct = total ? Math.round((entregados / total) * 100) : 0

  console.log('\n═══ 2. ¿LLEGAN SUS RESPUESTAS? ═══')
  if (!total) console.log(ojo('  ? Sin envíos confirmados en 24h'))
  else if (pct < 60) {
    console.log(mal(`  ✗ Solo ${pct}% entregado (${entregados}/${total}, ${fallidos} fallidos)`))
    problemas.push(`Solo ${pct}% de los mensajes está llegando`)
  } else {
    console.log(ok(`  ✓ ${pct}% entregado (${entregados}/${total})`) + (fallidos ? ojo(` · ${fallidos} fallidos`) : ''))
  }

  // ── 3. ¿Meta lo tiene cortado? ─────────────────────────────
  const errs = await prisma.botConversacion.findMany({
    where: { errorEntrega: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 24 * H) } },
    select: { errorEntrega: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const porCodigo = {}
  for (const e of errs) {
    const c = (e.errorEntrega.match(/^(\d+)/) || ['?'])[1]
    porCodigo[c] = porCodigo[c] || { n: 0, ultimo: e.createdAt }
    porCodigo[c].n++
  }

  console.log('\n═══ 3. ¿META LO TIENE BLOQUEADO? ═══')
  let hayCorte = false
  for (const [cod, info] of Object.entries(porCodigo)) {
    const h = (Date.now() - info.ultimo.getTime()) / H
    if (CORTE[cod]) {
      hayCorte = true
      const activo = h < 24
      console.log((activo ? mal('  ✗✗ ') : ojo('  ⚠  ')) + `${cod}: ${CORTE[cod]}`)
      console.log(`      ${info.n} en 7 días · último hace ${h < 48 ? h.toFixed(1) + 'h' : (h / 24).toFixed(1) + ' días'}`)
      if (activo) problemas.push(`CORTE ACTIVO por ${CORTE[cod]} — revisar business.facebook.com → Configuración de pago`)
    } else if (LIMITE[cod]) {
      console.log(ojo(`  ⚠  ${cod}: ${LIMITE[cod]} — ${info.n} en 7 días`))
    }
  }
  if (!hayCorte) console.log(ok('  ✓ Sin bloqueos por pago ni restricciones en 7 días'))

  // ── 4. Lo que dice Meta del número ─────────────────────────
  console.log('\n═══ 4. ESTADO SEGÚN META ═══')
  if (!TOKEN || !PID) console.log(ojo('  ? Faltan credenciales en .env'))
  else {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${PID}?fields=display_phone_number,quality_rating,status,messaging_limit_tier`,
        { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(10000) }
      )
      const d = await r.json()
      if (!r.ok) {
        console.log(mal(`  ✗ Meta responde error: ${d?.error?.message || r.status}`))
        problemas.push('Meta rechaza el token — el bot no puede enviar nada')
      } else {
        const calidadMal = d.quality_rating && d.quality_rating !== 'GREEN'
        console.log(`  número   ${d.display_phone_number}`)
        console.log(`  estado   ${d.status === 'CONNECTED' ? ok(d.status) : mal(d.status)}`)
        console.log(`  calidad  ${calidadMal ? mal(d.quality_rating) : ok(d.quality_rating)}`)
        if (d.messaging_limit_tier) console.log(`  límite   ${d.messaging_limit_tier}`)
        if (d.status !== 'CONNECTED') problemas.push(`El número está en estado ${d.status}`)
        if (calidadMal) problemas.push(`Calidad ${d.quality_rating}: Meta va a empezar a limitar envíos`)
      }
    } catch (e) {
      console.log(mal(`  ✗ No se pudo consultar a Meta: ${e.message}`))
    }
  }

  // ── Veredicto ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(46))
  if (!problemas.length) {
    console.log(ok('  TODO BIEN. El bot contesta y sus mensajes llegan.'))
  } else {
    console.log(mal(`  HAY ${problemas.length} PROBLEMA(S):`))
    problemas.forEach((p, i) => console.log(mal(`   ${i + 1}. ${p}`)))
  }
  console.log('═'.repeat(46) + '\n')

  await prisma.$disconnect()
  process.exit(problemas.length ? 1 : 0)
})().catch(e => { console.error('ERROR corriendo el chequeo:', e.message); process.exit(2) })
