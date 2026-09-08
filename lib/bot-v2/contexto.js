// lib/bot-v2/contexto.js — LO QUE YA PASÓ EN LA CONVERSACIÓN (BOT v3 · sprint 4).
//
// Antes cada prompt recalculaba a su manera si el enlace ya se mandó, si se
// ofreció la prueba, etc., y el modelo no sabía qué argumentos había usado.
// Aquí se saca del historial UNA vez, en una estructura, y todos los prompts
// reciben el mismo bloque. Es el «contexto» que las auditorías separan de la
// «intención» (lo que quiere ahora) y del «estado» (la etapa).
//
// Módulo puro: solo lee el historial.

import { PLANES, funcionesMencionadas, EMPRESA } from './kb.js'

const OBJECION = /(?:\bcar[oa]s?\b|costos[oa]|no tengo plata|mucha plata|pensarlo|voy a pensar|no me gusta|no me convence|no me sirve|ya tengo (?:un |otro |mi )?(?:sistema|app|programa|excel|libreta|cuaderno|hoja|aplicaci[oó]n)|ya uso (?:otro|un)|me da miedo|desconfi|no s[eé] usar|dif[ií]cil|pago [uú]nico|un solo pago|no quiero mensual)/i

export function contextoDe(historial = [], { lead = {}, yaRegistrado = false } = {}) {
  const bots = (historial || []).filter((m) => m?.rol === 'bot')
  const leads = (historial || []).filter((m) => m?.rol === 'lead')
  const textoBot = bots.map((m) => m.texto || '').join('\n')

  const precioDado = PLANES.filter((p) => new RegExp(`\\$\\s?${String(p.precio).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.')}\\b`).test(textoBot)).map((p) => p.nombre)
  const ultimoBot = bots.at(-1)?.texto || ''
  const ultimaPreguntaBot = (ultimoBot.match(/[^.!?\n]*\?/g) || []).at(-1)?.trim() || null

  const argumentosUsados = [...new Set(bots.flatMap((m) => funcionesMencionadas(m.texto)))]
  const objecionesDelLead = leads.map((m) => m.texto || '').filter((t) => OBJECION.test(t)).slice(-3)

  return {
    registrado: Boolean(yaRegistrado),
    linkEnviado: textoBot.includes('app.control-finanzas.com/registro'),
    pruebaOfrecida: /prueba gratis|d[ií]as gratis|probarlo (?:gratis|sin)/i.test(textoBot),
    precioDado,
    tutorialEnviado: textoBot.includes(EMPRESA.linkTutoriales),
    ultimaPreguntaBot,
    argumentosUsados,
    objecionesDelLead,
    turnosBot: bots.length,
    turnosLead: leads.length,
    datos: {
      metodo: lead?.metodoActual || null,
      clientes: lead?.cantClientes || null,
    },
  }
}

/** El bloque que va a los prompts. Solo dice lo que hay: sin ruido. */
export function textoContexto(ctx) {
  if (!ctx) return ''
  const lineas = []
  if (ctx.registrado) lineas.push('- El lead YA ESTÁ REGISTRADO: no le vendas ni le mandes el link de registro.')
  if (ctx.linkEnviado) lineas.push(`- El link de registro YA se le mandó. No lo repitas ni le preguntes si se registró, salvo que lo pida: entonces se lo vuelves a poner (${EMPRESA.linkRegistro}).`)
  if (ctx.pruebaOfrecida && !ctx.linkEnviado) lineas.push('- Ya le ofreciste la prueba gratis.')
  if (ctx.precioDado.length) lineas.push(`- Ya le diste el precio del plan ${ctx.precioDado.join(' y ')}. No lo cambies.`)
  if (ctx.tutorialEnviado) lineas.push('- Ya le mandaste el enlace de los tutoriales: no lo repitas.')
  if (ctx.argumentosUsados.length) lineas.push(`- Argumentos que YA usaste (no los repitas, usa otro o baja al detalle): ${ctx.argumentosUsados.join(', ')}.`)
  if (ctx.ultimaPreguntaBot) lineas.push(`- Tu última pregunta fue: «${ctx.ultimaPreguntaBot.slice(0, 120)}». Si el lead la acaba de contestar, NO la repitas: avanza con lo que dijo.`)
  if (ctx.objecionesDelLead.length) lineas.push(`- Objeciones que ya puso: ${ctx.objecionesDelLead.map((o) => `«${o.slice(0, 80)}»`).join(', ')}.`)
  if (!lineas.length) return ''
  return `LO QUE YA PASÓ EN ESTA CONVERSACIÓN:\n${lineas.join('\n')}\n`
}
