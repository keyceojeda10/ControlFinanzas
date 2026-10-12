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
import { esCarteraGrande } from '../bot/cartera-post-registro.js'
import { textoCantClientes } from '../fb-leads.js'

const OBJECION = /(?:\bcar[oa]s?\b|costos[oa]|no tengo plata|mucha plata|pensarlo|voy a pensar|no me gusta|no me convence|no me sirve|ya tengo (?:un |otro |mi )?(?:sistema|app|programa|excel|libreta|cuaderno|hoja|aplicaci[oó]n)|ya uso (?:otro|un)|me da miedo|desconfi|no s[eé] usar|dif[ií]cil|pago [uú]nico|un solo pago|no quiero mensual)/i

export function contextoDe(historial = [], { lead = {}, yaRegistrado = false, cuenta = null } = {}) {
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
    // Lo de su cuenta, solo si es un dueño ya registrado (lib/bot-v2/cuenta.js).
    cuenta: yaRegistrado ? cuenta : null,
  }
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

/* Lo que se le dice al modelo de la cuenta del dueño. Datos, no guion: el
   modelo decide si vienen al caso. */
function lineasDeCuenta(c) {
  const out = []
  const estado = c.enPrueba
    ? (c.vigente ? `en prueba gratis hasta el ${fechaCorta(c.vence)}` : `su prueba gratis se venció${c.vence ? ` el ${fechaCorta(c.vence)}` : ''}`)
    : (c.vigente ? `ya paga, al día hasta el ${fechaCorta(c.vence)}` : `ya pagó antes, pero la suscripción venció${c.vence ? ` el ${fechaCorta(c.vence)}` : ''}`)
  out.push(`- SU CUENTA (dato del sistema): plan ${c.plan}, ${estado}, ${c.clientes} ${c.clientes === 1 ? 'cliente cargado' : 'clientes cargados'}.`)
  out.push(`- Si pregunta precios o cómo pagar: dale el precio de SU plan y mándalo a ${EMPRESA.linkPago}. NO le ofrezcas prueba gratis ni el link de registro: ya tiene cuenta.`)
  if (c.ofertaNequi) out.push(`- Le aplica la oferta: si deja su Nequi guardado para el pago automático, su próximo mes le sale 35 % más barato. Se activa en ${EMPRESA.linkPago}. Menciónala solo si habla de precio o de pagar.`)
  if (c.cargaAbierta) {
    out.push('- Ya pidió que le carguemos la cartera y el equipo la está cargando: si pregunta, dile que le avisamos por aquí cuando quede lista (máximo 24 horas) y que puede mandar por aquí mismo lo que le falte.')
  } else if (c.clientes < 6) {
    out.push(`- Casi no tiene clientes cargados. Si dice que no ha tenido tiempo, que son muchos o que le da pereza pasarlos: ofrécele que se los carguemos nosotros, sin costo: sube las fotos del cuaderno o el Excel en ${EMPRESA.linkApp}/cargar-cartera y en máximo 24 horas quedan cargados.`)
  }
  return out
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
  /* Lo dijo en el formulario: preguntárselo otra vez se lee como que nadie lo
     escuchó. Se vio con el modelo real contra el espejo (12 oct 2026). */
  if (!ctx.registrado && ctx.datos?.clientes) lineas.push(`- Ya dijo en el formulario que maneja ${textoCantClientes(ctx.datos.clientes)} clientes: NO le preguntes cuántos tiene. Si vas a cerrar con una pregunta, que sea otra (por ejemplo, si los lleva en cuaderno o en Excel).`)
  if (ctx.cuenta) lineas.push(...lineasDeCuenta(ctx.cuenta))
  /* La cartera grande sin registrar: el asesor es la respuesta a «es mucho
     trabajo pasar todo» (bloque 4). Se dice solo como respuesta a eso. */
  if (!ctx.registrado && esCarteraGrande(ctx.datos?.clientes)) {
    lineas.push('- Maneja 50 clientes o más. Si pone como pega el trabajo de pasar todo al sistema, dile que al registrarse se los cargamos nosotros sin costo: manda las fotos del cuaderno o el Excel y en máximo 24 horas quedan listos.')
  }
  if (ctx.objecionesDelLead.length) lineas.push(`- Objeciones que ya puso: ${ctx.objecionesDelLead.map((o) => `«${o.slice(0, 80)}»`).join(', ')}.`)
  if (!lineas.length) return ''
  return `LO QUE YA PASÓ EN ESTA CONVERSACIÓN:\n${lineas.join('\n')}\n`
}
