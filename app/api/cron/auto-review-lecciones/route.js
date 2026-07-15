// app/api/cron/auto-review-lecciones/route.js
// Corre despues de la autocritica (ej: 9:30pm COL).
// Evalua lecciones pendientes con criterio estricto y aprueba/rechaza.
// NO modifica prompts — solo clasifica y notifica al Telegram.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { llamarGemini, geminiDisponible } from '@/lib/bot/gemini'
import { sendMessage, editMessageReplyMarkup } from '@/lib/telegram'

function esc(t) {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!geminiDisponible()) {
    return NextResponse.json({ error: 'Gemini no disponible' }, { status: 500 })
  }

  const pendientes = await prisma.botLeccion.findMany({
    where: { estado: 'pendiente' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (pendientes.length === 0) {
    return NextResponse.json({ ok: true, revisadas: 0 })
  }

  const reglasActuales = await getReglasActuales()

  const lote = pendientes.map(l => ({
    id: l.id,
    tipo: l.tipo,
    leccion: (l.leccion || '').slice(0, 300),
    accion: (l.accion || '').slice(0, 300),
  }))

  const systemPrompt = `Eres un revisor de calidad para un bot de ventas WhatsApp de "Control Finanzas" (sistema de cartera para prestamistas colombianos).

Tu trabajo: evaluar sugerencias de mejora generadas por una autocritica diaria. Debes ser ESTRICTO.

REGLAS ACTUALES DEL BOT (para que no apruebes algo que ya existe o contradiga):
${reglasActuales}

CRITERIOS PARA APROBAR (deben cumplirse TODOS):
1. Es un patron REAL y repetible, no un caso aislado de un solo lead
2. La accion sugerida es CONCRETA y aplicable (no generica tipo "mejorar la respuesta")
3. NO contradice reglas existentes del bot
4. NO haria el bot mas largo o verboso (max 2-4 lineas sigue siendo la regla)
5. NO sugiere agregar funciones que no existen en el sistema
6. NO sugiere dar nombre propio al bot
7. Implementarla REALMENTE mejoraria la conversion, no solo suena bien

CRITERIOS PARA RECHAZAR (basta UNO):
- Es un caso aislado (un solo lead que no respondio no es patron)
- La sugerencia es obvia o ya esta en las reglas
- La accion es vaga ("mejorar", "ser mas empatico", "personalizar mas")
- Contradice la regla de brevedad (2-4 lineas max)
- Es redundante con otra leccion del mismo lote
- El lead simplemente no estaba interesado (no es culpa del bot)

Responde UNICAMENTE con un JSON array. Cada elemento:
{"id":"...","veredicto":"aprobada"|"rechazada","razon":"explicacion corta de 1 linea"}

Se estricto. Es mejor rechazar 8 de 10 que aprobar basura. Solo aprueba lo que genuinamente mejoraria el bot.`

  let resultados
  try {
    const resp = await llamarGemini(
      systemPrompt,
      `Evalua estas ${lote.length} sugerencias:\n\n${JSON.stringify(lote, null, 2)}`,
      { maxTokens: 4000, noThinking: true }
    )
    let raw = resp.text.trim()
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No devolvio JSON array: ' + raw.slice(0, 200))
    resultados = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('[AutoReview] Error Gemini:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  let aprobadas = 0
  let rechazadas = 0

  for (const r of resultados) {
    const leccion = pendientes.find(l => l.id === r.id)
    if (!leccion) continue

    const estado = r.veredicto === 'aprobada' ? 'aprobada' : 'rechazada'
    await prisma.botLeccion.update({
      where: { id: r.id },
      data: { estado },
    })

    if (leccion.telegramMsgId) {
      const label = estado === 'aprobada' ? '✅ AUTO-APROBADA' : '❌ AUTO-RECHAZADA'
      try {
        await editMessageReplyMarkup(leccion.telegramMsgId, {
          inline_keyboard: [[{ text: label, callback_data: 'noop:0' }]],
        }, 'notif')
      } catch {}
    }

    if (estado === 'aprobada') aprobadas++
    else rechazadas++
  }

  const fecha = new Date().toLocaleDateString('es-CO')
  const resumen = [
    `\u{1F916} <b>Auto-revision de lecciones</b> — ${fecha}`,
    ``,
    `Revisadas: ${resultados.length}`,
    `Aprobadas: ${aprobadas}`,
    `Rechazadas: ${rechazadas}`,
  ]

  if (aprobadas > 0) {
    resumen.push(``)
    resumen.push(`<b>Aprobadas:</b>`)
    for (const r of resultados.filter(r => r.veredicto === 'aprobada')) {
      const l = pendientes.find(l => l.id === r.id)
      if (l) resumen.push(`- ${esc((l.accion || '').slice(0, 120))}`)
    }
  }

  await sendMessage(resumen.join('\n'), null, 'notif')

  console.log(`[AutoReview] Aprobadas: ${aprobadas}, Rechazadas: ${rechazadas}`)
  return NextResponse.json({ ok: true, revisadas: resultados.length, aprobadas, rechazadas })
}

async function getReglasActuales() {
  return `- Max 2-4 lineas por mensaje. Una idea por mensaje. Nada de parrafos.
- NUNCA negritas, markdown, listas con guiones ni numeradas.
- NUNCA nombre propio. No es Daniela, Carlos ni nadie. Es "el asistente de Control Finanzas".
- NUNCA inventar funciones. Solo las de la lista FUNCIONES REALES en producto.js.
- NUNCA inventar que el sistema envia recordatorios automaticos de pago a los deudores. NO envia mensajes a los clientes del prestamista.
- NUNCA dar pasos tecnicos (abra Chrome, vaya a tal sitio). Eso es soporte, no ventas.
- NUNCA decir que el precio depende del numero de clientes. Cada plan tiene precio FIJO.
- NUNCA decir "descargar la app" — es web app, se abre desde el navegador.
- NUNCA calcular precios anuales. Precios anuales fijos: Inicial $390.000, Basico $590.000, Crecimiento $790.000, Profesional $1.190.000, Empresarial $2.590.000.
- Precio FIJO mensual: Inicial $39.000, Basico $59.000, Crecimiento $79.000, Profesional $119.000, Empresarial $259.000.
- Tono WhatsApp colombiano real. Usted amable. Si tutean, tutea.
- NO emojis decorativos. Si acaso un pulgar.
- 14 dias de prueba, NUNCA 15.
- PROHIBIDO: testimonios inventados, cifras inventadas, cupones, codigos de descuento, promociones inventadas.
- NUNCA prometer enviar videos, imagenes, archivos o documentos.
- Si el lead pregunta por algo que NO esta en funciones reales, decir que no lo tiene y escalar a soporte.
- Expresiones colombianas "No si quiero", "De una", "Hagale" = SI quiere.
- Plan trimestral: 10% descuento. Plan anual: 2 meses gratis (un solo pago).
- Planes Inicial y Basico NO permiten agregar cobradores ni rutas extra.
- Seguimientos deben variar contenido (no repetir mismo CTA).
- NUNCA repetir una pregunta que el lead ya contesto.
- Siempre "quedo atento", NUNCA "quedo atenta".
- Si claramente no le interesa: darPorPerdido=true.`
}
