// lib/bot/bridge.js — Procesamiento de lead nuevo desde Facebook

import { prisma } from '@/lib/prisma'
import * as openwa from './openwa-client'

/**
 * Procesa un nuevo lead proveniente del webhook de Facebook.
 * Crea BotLead, verifica WhatsApp, envia mensaje inicial.
 */
export async function procesarNuevoLead(data) {
  const { cfLeadId, nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres, anuncioId } = data

  if (!telefono) {
    console.warn('[Bot Bridge] Lead sin telefono, ignorando.')
    return { status: 'error', motivo: 'Sin telefono' }
  }

  // Dedup por telefono
  const existe = await prisma.botLead.findFirst({ where: { telefono } })
  if (existe) {
    console.log(`[Bot Bridge] Lead duplicado (tel ${telefono}), ignorando.`)
    return { status: 'duplicado', leadId: existe.id }
  }

  // Crear BotLead
  const lead = await prisma.botLead.create({
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

  // Construir y enviar mensaje inicial
  const mensaje = construirMensajeInicial(lead)

  if (openwa.configurado() && botActivo) {
    try {
      await openwa.sendText(telefono, mensaje)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: mensaje },
      })
      // Marcar como contactado + programar primer seguimiento (1 dia)
      await prisma.botLead.update({
        where: { id: lead.id },
        data: {
          estado: 'contactado',
          fechaContacto: new Date(),
          proximoSeguimiento: new Date(Date.now() + 1 * 24 * 3600000),
        },
      })
      console.log(`[Bot Bridge] Mensaje enviado a ${nombre} (${telefono})`)
    } catch (e) {
      console.error(`[Bot Bridge] Error enviando a ${nombre}:`, e.message)
    }
  }

  return { status: 'contactado', leadId: lead.id }
}

function construirMensajeInicial(lead) {
  const nombre = lead.nombre && lead.nombre !== 'Sin nombre' ? ` ${lead.nombre}` : ''
  const metodo = (lead.metodoActual || '').toLowerCase()
  const cantClientes = lead.cantClientes || ''

  if (metodo.includes('libreta') || metodo.includes('cuaderno')) {
    return `Hola${nombre}, gracias por su interes en Control Finanzas. Vi que lleva su cartera en libreta. Una pregunta rapida: usted sabe hoy exactamente cuanto esta ganando de intereses y cuanto tiene disponible para prestar? Porque eso es lo primero que el sistema le resuelve.`
  }

  if (metodo.includes('excel') || metodo.includes('hoja')) {
    return `Hola${nombre}, gracias por registrarse. Vi que usa Excel para su cartera. Una pregunta: usted puede saber en este momento cuanto le cobro cada cobrador hoy, o le toca esperar a que le reporten? Con Control Finanzas eso lo ve en tiempo real desde el celular.`
  }

  if (metodo.includes('sistema') || metodo.includes('app') || metodo.includes('software')) {
    return `Hola${nombre}, gracias por su interes. Vi que ya usa un sistema. Que tal le ha funcionado? Le pregunto porque muchos se pasan a Control Finanzas por Lucas, un asistente con inteligencia artificial al que usted le habla y el le registra pagos, crea clientes, y le dice cuanto esta ganando. En que siente que su sistema se queda corto?`
  }

  if (cantClientes && parseInt(cantClientes) > 100) {
    return `Hola${nombre}, gracias por su interes en Control Finanzas. Vi que maneja alrededor de ${cantClientes} clientes, eso ya es una operacion seria. Le cuento: nuestro sistema incluye un asistente con IA al que usted le dice "cuanto estoy ganando?" o "registrame este pago" y el lo hace al instante. Como lleva su cartera hoy?`
  }

  if (cantClientes) {
    return `Hola${nombre}, gracias por su interes en Control Finanzas. Vi que maneja ${cantClientes} clientes. Nuestro sistema le permite llevar toda su cartera desde el celular: prestamos, cobros, cobradores con su propio acceso, y recibos automaticos por WhatsApp para sus clientes. Como lleva su cartera hoy?`
  }

  return `Hola${nombre}, gracias por su interes en Control Finanzas. Somos un sistema hecho para prestamistas: cartera, cobros, cobradores, rutas, recibos por WhatsApp y hasta un asistente con IA que le dice cuanto esta ganando y le registra pagos por voz. Como maneja su cartera actualmente?`
}
