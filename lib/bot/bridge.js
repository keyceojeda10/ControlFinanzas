// lib/bot/bridge.js — Procesamiento de lead nuevo desde Facebook

import { prisma } from '@/lib/prisma'
import * as wa from './whatsapp-cloud'
import { notificarEstadoLead } from './notificar-meta'

// Nombre de la plantilla aprobada en Meta para el PRIMER contacto en frio.
// Debe existir y estar "Approved" en WhatsApp Manager. Su body debe tener una
// variable {{1}} para el nombre. Ej: "Hola {{1}}, vimos tu interes en Control
// Finanzas. Como llevas el control de tu cartera hoy?"
const TEMPLATE_INICIAL = process.env.WHATSAPP_TEMPLATE_INICIAL || 'contacto_inicial'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

/**
 * Procesa un nuevo lead proveniente del webhook de Facebook.
 * Crea BotLead, verifica WhatsApp, envia mensaje inicial.
 */
// Normalizar formatos de cantClientes del formulario v17
function normalizarCantClientes(val) {
  if (!val) return val
  const map = {
    '20_a_50': '20_50',
    '50_a_100': '50_100',
    'menos_de_20_clientes': 'menos_de_20',
    'mas_de_100_clientes': 'mas_de_100',
  }
  return map[val] || val
}

export async function procesarNuevoLead(data) {
  const { cfLeadId, nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, anuncioId, esRetorno } = data

  if (!telefono) {
    console.warn('[Bot Bridge] Lead sin telefono, ignorando.')
    return { status: 'error', motivo: 'Sin teléfono' }
  }

  // Crear de forma atomica: el constraint @@unique([telefono]) en BotLead es
  // quien arbitra la concurrencia entre workers del cluster PM2 (los locks en
  // memoria no sirven porque cada worker tiene su propio proceso/heap). Si dos
  // requests llegan en paralelo (reintento de Facebook, cron leads-sync, etc),
  // solo uno logra el create(); el otro recibe P2002 y trata el lead como
  // existente — sin duplicar registro ni reenvio.
  let lead
  let yaExistia = false
  try {
    lead = await prisma.botLead.create({
      data: {
        cfLeadId: cfLeadId || undefined,
        nombre: nombre || 'Sin nombre',
        telefono,
        cantClientes: normalizarCantClientes(cantClientes) || undefined,
        esPrestamista: esPrestamista || undefined,
        metodoActual: metodoActual || undefined,
        planInteres: planInteres || undefined,
        anuncioId: anuncioId || undefined,
      },
    })
  } catch (e) {
    if (e.code === 'P2002') {
      yaExistia = true
      lead = await prisma.botLead.findUnique({ where: { telefono } })
      if (!lead) throw e // condicion imposible, pero no tragar el error original
    } else {
      throw e
    }
  }

  if (yaExistia && esRetorno) {
    // Lead que vuelve — reactivar
    lead = await prisma.botLead.update({
      where: { id: lead.id },
      data: {
        estado: 'pendiente',
        botActivo: true,
        alertado: false,
        temperatura: 60, // vuelve con interes
        proximoSeguimiento: null,
      },
    })
    console.log(`[Bot Bridge] Lead RETORNO reactivado: ${nombre} (${telefono})`)
  } else if (yaExistia) {
    console.log(`[Bot Bridge] Lead duplicado (tel ${telefono}), ignorando.`)
    return { status: 'duplicado', leadId: lead.id }
  }

  // Nota: con la Cloud API oficial no hay "check de contacto" fiable, asi que
  // ya no bloqueamos por "sin WhatsApp". Si el numero no tiene WhatsApp, el
  // envio de la plantilla fallara con error explicito (se captura abajo).

  // Leer config del bot
  const config = await prisma.botConfig.findFirst()
  const botActivo = config?.botActivo !== false

  // IMPORTANTE: si el lead YA tuvo conversacion antes, NO mandar el saludo
  // inicial en frio (pisaria su historial y le hablaria como desconocido a un
  // lead que ya estaba avanzado/caliente). Solo reactivamos el bot y dejamos
  // que responda cuando el lead vuelva a escribir.
  const yaConversado = await prisma.botConversacion.count({ where: { botLeadId: lead.id } })
  if (yaConversado > 0) {
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { botActivo: true },
    }).catch(() => {})
    console.log(`[Bot Bridge] Lead ${nombre} ya tiene conversacion (${yaConversado} msgs), NO se reenvia saludo. Solo reactivado.`)
    return { status: 'reactivado_sin_saludo', leadId: lead.id }
  }

  // Texto que el lead vera en el PRIMER contacto. Con la Cloud API el primer
  // mensaje en frio DEBE ser una plantilla aprobada (variable {{1}} = nombre).
  // Guardamos en BotConversacion el texto renderizado para el historial.
  const nombreVar = primerNombre(lead.nombre) || 'que tal'
  const textoPlantilla = `Hola ${nombreVar}, vimos tu interés en Control Finanzas. Como llevas el control de tu cartera hoy?`

  if (wa.configurado() && botActivo) {
    // Compare-and-swap atomico: el UPDATE solo afecta una fila si el estado
    // sigue siendo 'pendiente' (o fue recien creado). Si dos workers del
    // cluster llegan aqui en paralelo para el mismo lead, solo uno obtiene
    // count===1 (gana la carrera en la propia DB); el otro ve count===0 y
    // sale sin reenviar. Reemplaza al lock en memoria `sendingTo`, que no
    // funciona entre procesos distintos de PM2 cluster.
    const reservado = await prisma.botLead.updateMany({
      where: { id: lead.id, estado: { in: ['pendiente'] } },
      data: { estado: 'contactado', fechaContacto: new Date() },
    })
    if (reservado.count === 0) {
      console.log(`[Bot Bridge] Otro worker ya esta contactando a ${telefono}, ignorando duplicado.`)
      return { status: 'duplicado_envio', leadId: lead.id }
    }
    notificarEstadoLead(lead.id, 'contacted').catch(() => {})

    try {
      await wa.sendTemplate(telefono, TEMPLATE_INICIAL, { nombre: nombreVar }, TEMPLATE_LANG)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: textoPlantilla },
      })
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { proximoSeguimiento: new Date(Date.now() + 1 * 24 * 3600000) },
      })
      console.log(`[Bot Bridge] Plantilla inicial enviada a ${nombre} (${telefono})${esRetorno ? ' (RETORNO)' : ''}`)
    } catch (e) {
      console.error(`[Bot Bridge] Error enviando plantilla a ${nombre}:`, e.message)
      // Si el numero no tiene WhatsApp o la plantilla falla, marcar bloqueado
      // para no reintentar en loop.
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { estado: 'bloqueado' },
      }).catch(() => {})
      return { status: 'error_envio', leadId: lead.id, motivo: e.message }
    }
  }

  return { status: esRetorno ? 'reactivado' : 'contactado', leadId: lead.id }
}

// Extrae solo el primer nombre natural (no empresas, no nombres raros)
function primerNombre(nombre) {
  if (!nombre || nombre === 'Sin nombre') return ''
  const limpio = nombre.trim()
  // Si parece nombre de empresa (tiene números, "club", "store", etc), no usar
  if (/\d|club|store|shop|tienda|empresa|negocio|corp|sas|ltda|s\.a/i.test(limpio)) return ''
  // Si tiene más de 4 palabras probablemente no es un nombre personal
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return ''
  // Usar solo el primer nombre, capitalizado
  const primer = partes[0]
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()
}

// Convierte códigos de cantClientes a texto legible
function cantClientesTexto(cant) {
  if (!cant) return ''
  const map = {
    'menos_de_20': 'menos de 20',
    '20_50': 'entre 20 y 50',
    '20_–_50': 'entre 20 y 50',
    '50_100': 'entre 50 y 100',
    '50_–_100': 'entre 50 y 100',
    'mas_de_100': 'mas de 100',
    'más_de_100': 'mas de 100',
  }
  return map[cant] || cant.replace(/_/g, ' ')
}

function construirMensajeRetorno(lead) {
  const nombre = primerNombre(lead.nombre)
  const saludo = nombre ? `${nombre}, ` : ''
  return `Hola! ${saludo}vi que volvio a dejarnos sus datos. En que le puedo ayudar?`
}

function construirMensajeInicial(lead) {
  const nombre = primerNombre(lead.nombre)
  const saludo = nombre ? ` ${nombre}` : ''
  const metodo = (lead.metodoActual || '').toLowerCase()
  const cantRaw = lead.cantClientes || ''
  const esMuchos = cantRaw.includes('100') || cantRaw.includes('mas') || cantRaw.includes('más')

  if (metodo.includes('libreta') || metodo.includes('cuaderno')) {
    return `Hola${saludo}! Vi que lleva su cartera en libreta. Usted sabe hoy cuanto esta ganando de intereses? Eso es lo primero que le resolvemos.`
  }

  if (metodo.includes('excel') || metodo.includes('hoja')) {
    return `Hola${saludo}! Vi que usa Excel para su cartera. Le pregunto: puede saber en tiempo real cuanto le cobro cada cobrador hoy?`
  }

  if (metodo.includes('sistema') || metodo.includes('app') || metodo.includes('software')) {
    return `Hola${saludo}! Vi que ya usa un sistema. Que tal le ha funcionado? En que siente que se queda corto?`
  }

  if (esMuchos) {
    return `Hola${saludo}! Vi que maneja bastantes clientes. Como lleva el control de su cartera hoy?`
  }

  return `Hola${saludo}! Gracias por su interés en Control Finanzas. Como lleva el control de su cartera hoy?`
}
