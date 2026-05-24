// lib/bot/bridge.js — Procesamiento de lead nuevo desde Facebook

import { prisma } from '@/lib/prisma'
import * as openwa from './openwa-client'

// Lock para evitar envío doble al mismo teléfono
const sendingTo = new Set()

/**
 * Procesa un nuevo lead proveniente del webhook de Facebook.
 * Crea BotLead, verifica WhatsApp, envia mensaje inicial.
 */
export async function procesarNuevoLead(data) {
  const { cfLeadId, nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, anuncioId, esRetorno } = data

  if (!telefono) {
    console.warn('[Bot Bridge] Lead sin telefono, ignorando.')
    return { status: 'error', motivo: 'Sin telefono' }
  }

  // Buscar si ya existe como BotLead
  const existe = await prisma.botLead.findFirst({ where: { telefono } })

  let lead
  if (existe && esRetorno) {
    // Lead que vuelve — reactivar
    lead = await prisma.botLead.update({
      where: { id: existe.id },
      data: {
        estado: 'pendiente',
        botActivo: true,
        alertado: false,
        temperatura: 60, // vuelve con interes
        proximoSeguimiento: null,
      },
    })
    console.log(`[Bot Bridge] Lead RETORNO reactivado: ${nombre} (${telefono})`)
  } else if (existe) {
    console.log(`[Bot Bridge] Lead duplicado (tel ${telefono}), ignorando.`)
    return { status: 'duplicado', leadId: existe.id }
  } else {
    // Lead completamente nuevo
    lead = await prisma.botLead.create({
      data: {
        cfLeadId: cfLeadId || undefined,
        nombre: nombre || 'Sin nombre',
        telefono,
        cantClientes: cantClientes || undefined,
        esPrestamista: esPrestamista || undefined,
        metodoActual: metodoActual || undefined,
        planInteres: planInteres || undefined,
        anuncioId: anuncioId || undefined,
      },
    })
  }

  // Verificar si tiene WhatsApp
  const tiene = await openwa.tieneWhatsApp(telefono)
  if (tiene === false) {
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { estado: 'bloqueado' },
    })
    console.log(`[Bot Bridge] ${nombre} (${telefono}) — sin WhatsApp, bloqueado.`)
    return { status: 'bloqueado', leadId: lead.id, motivo: 'Sin WhatsApp' }
  }

  // Leer config del bot
  const config = await prisma.botConfig.findFirst()
  const botActivo = config?.botActivo !== false

  // Construir mensaje: diferente si es retorno vs nuevo
  const mensaje = esRetorno
    ? construirMensajeRetorno(lead)
    : construirMensajeInicial(lead)

  if (openwa.configurado() && botActivo) {
    // Lock: evitar envío doble al mismo número
    if (sendingTo.has(telefono)) {
      console.log(`[Bot Bridge] Ya se está enviando a ${telefono}, ignorando duplicado.`)
      return { status: 'duplicado_envio', leadId: lead.id }
    }
    sendingTo.add(telefono)

    try {
      await openwa.sendText(telefono, mensaje)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: mensaje },
      })
      await prisma.botLead.update({
        where: { id: lead.id },
        data: {
          estado: 'contactado',
          fechaContacto: new Date(),
          proximoSeguimiento: new Date(Date.now() + 1 * 24 * 3600000),
        },
      })
      console.log(`[Bot Bridge] Mensaje enviado a ${nombre} (${telefono})${esRetorno ? ' (RETORNO)' : ''}`)
    } catch (e) {
      console.error(`[Bot Bridge] Error enviando a ${nombre}:`, e.message)
    } finally {
      sendingTo.delete(telefono)
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

  return `Hola${saludo}! Gracias por su interes en Control Finanzas. Como lleva el control de su cartera hoy?`
}
