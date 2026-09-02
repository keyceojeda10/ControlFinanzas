// lib/bot/bridge.js — Procesamiento de lead nuevo desde Facebook

import { prisma } from '@/lib/prisma'
import * as wa from './whatsapp-cloud'
import { notificarEstadoLead } from './notificar-meta'

const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

// Hook unico: un solo mensaje potente que muestra valor inmediato.
// Las plantillas segmentadas por metodo (cuaderno, excel, app) tenian
// tasas bajas (excel 0% registro, app 18% respuesta). Un hook universal
// que venda la solucion en vez de preguntar por el dolor funciona mejor.
const TEMPLATES_POR_METODO = {}
const TEMPLATE_FALLBACK = 'contacto_v2'

const TEMPLATE_HOOK = 'contacto_v2'

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
        abVariante: 'B',
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

  /* ══ ⚠ «YA TUVO CONVERSACION» NO ES «EL BOT YA LE HABLO» ══════════════════
   *
   * Esto contaba TODOS los mensajes —`count({ botLeadId })`— y por eso el bot
   * tomaba su propio monologo por una conversacion y se quedaba mudo.
   *
   * El caso que lo destapo, Eliecer Anaya: volvio a llenar el formulario el 11
   * de agosto y no recibio nada. Su «conversacion» eran SEIS mensajes del bot y
   * CERO suyos, el ultimo del 17 de julio. Nunca escribio una palabra.
   *
   * La intencion original sigue siendo buena y se respeta: no pisarle el
   * historial a alguien que ya venia hablando. Lo que estaba mal es que
   * historial son los mensajes DEL LEAD; los nuestros no cuentan.
   *
   * Medido en produccion: **452 de 1.343** leads tienen «conversacion» sin una
   * sola linea suya, y **13 volvieron a llenar el formulario** —uno cuatro
   * veces— sin recibir jamas un saludo. Cada uno es un lead pagado dos veces y
   * dejado en silencio.
   *
   * ⚠ Y LA SEGUNDA CONDICION, la del reloj. `esRetorno` no tiene ventana: dos
   * formularios en la misma hora ya cuentan. Sin esto, quien llene el
   * formulario dos veces seguidas recibe dos saludos iguales, que es el defecto
   * contrario. Si le hablamos hace menos de dos dias, se queda como estaba. */
  const HORAS_PARA_VOLVER_A_SALUDAR = 48
  const [escribioElLead, ultimoDelBot] = await Promise.all([
    prisma.botConversacion.count({ where: { botLeadId: lead.id, rol: 'lead' } }),
    prisma.botConversacion.findFirst({
      where: { botLeadId: lead.id, rol: 'bot' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])
  const horasDesdeElUltimo = ultimoDelBot
    ? (Date.now() - new Date(ultimoDelBot.createdAt).getTime()) / 3600000
    : Infinity

  if (escribioElLead > 0 || horasDesdeElUltimo < HORAS_PARA_VOLVER_A_SALUDAR) {
    await prisma.botLead.update({
      where: { id: lead.id },
      data: { botActivo: true },
    }).catch(() => {})
    const motivo = escribioElLead > 0
      ? `el lead ya escribio ${escribioElLead} vez/veces`
      : `le hablamos hace ${horasDesdeElUltimo.toFixed(0)}h`
    console.log(`[Bot Bridge] Lead ${nombre}: NO se reenvia saludo (${motivo}). Solo reactivado.`)
    return { status: 'reactivado_sin_saludo', leadId: lead.id }
  }

  if (ultimoDelBot) {
    console.log(`[Bot Bridge] Lead ${nombre}: volvio a llenar el formulario y NUNCA escribio (ultimo contacto hace ${Math.round(horasDesdeElUltimo / 24)}d). Se le saluda de nuevo.`)
  }

  const nombreVar = primerNombre(lead.nombre) || 'que tal'
  const templateName = TEMPLATE_HOOK

  // Texto renderizado para guardar en el historial (lo que el lead ve)
  const textoPlantilla = construirTextoPlantilla(templateName, nombreVar)

  if (wa.configurado() && botActivo) {
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
      // Guardar el wamid: es la unica forma de correlacionar despues el ack de
      // entrega que manda Meta por el webhook. Sin el, el 77% de los mensajes de
      // APERTURA quedaba sin saber si llego (y la mitad de los fallos era
      // invisible: "[WA Cloud] Status para wamid desconocido").
      const envio = await wa.sendTemplate(telefono, templateName, { nombre: nombreVar }, TEMPLATE_LANG)
      await prisma.botConversacion.create({
        data: { botLeadId: lead.id, rol: 'bot', texto: textoPlantilla, wamid: wa.wamidDe(envio) },
      })
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { proximoSeguimiento: new Date(Date.now() + 1 * 24 * 3600000) },
      })
      console.log(`[Bot Bridge] Plantilla "${templateName}" enviada a ${nombre} (${telefono})${esRetorno ? ' (RETORNO)' : ''}`)
    } catch (e) {
      // Si la plantilla segmentada falla (no aprobada aun), intentar con la generica
      if (templateName !== TEMPLATE_FALLBACK) {
        console.warn(`[Bot Bridge] Plantilla "${templateName}" fallo, intentando fallback...`)
        try {
          const textoFallback = construirTextoPlantilla(TEMPLATE_FALLBACK, nombreVar)
          const envioFb = await wa.sendTemplate(telefono, TEMPLATE_FALLBACK, { nombre: nombreVar }, TEMPLATE_LANG)
          await prisma.botConversacion.create({
            data: { botLeadId: lead.id, rol: 'bot', texto: textoFallback, wamid: wa.wamidDe(envioFb) },
          })
          await prisma.botLead.update({
            where: { id: lead.id },
            data: { proximoSeguimiento: new Date(Date.now() + 1 * 24 * 3600000) },
          })
          console.log(`[Bot Bridge] Fallback "${TEMPLATE_FALLBACK}" enviada a ${nombre} (${telefono})`)
        } catch (e2) {
          console.error(`[Bot Bridge] Error enviando fallback a ${nombre}:`, e2.message)
          await prisma.botLead.update({
            where: { id: lead.id },
            data: { estado: 'bloqueado' },
          }).catch(() => {})
          return { status: 'error_envio', leadId: lead.id, motivo: e2.message }
        }
      } else {
        console.error(`[Bot Bridge] Error enviando plantilla a ${nombre}:`, e.message)
        await prisma.botLead.update({
          where: { id: lead.id },
          data: { estado: 'bloqueado' },
        }).catch(() => {})
        return { status: 'error_envio', leadId: lead.id, motivo: e.message }
      }
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

// Genera el texto que el lead ve segun la plantilla usada.
// Debe coincidir con el body de la plantilla aprobada en Meta.
function construirTextoPlantilla(templateName, nombre) {
  const textos = {
    contacto_v3a: `Hola ${nombre}, vimos su interes en Control Finanzas. Una pregunta rapida: usted lleva el control de sus cobros en libreta, en Excel o en alguna app?`,
    contacto_v3b: `Hola ${nombre}, le escribimos de Control Finanzas. Usted sabe exactamente cuanto le deben sus clientes hoy, o le toca sumar a mano?`,
    contacto_v2: `Hola ${nombre}, vimos tu interes en Control Finanzas. Es un sistema donde usted registra el prestamo y el sistema le calcula todo: cuotas, intereses, ganancias del dia, mora. Si tiene cobradores, cada uno entra con su usuario y usted ve en tiempo real cuanto cobro cada uno. Lo puede probar gratis 14 dias.`,
    contacto_cuaderno: `Hola ${nombre}, vimos tu interés en Control Finanzas. Vi que llevas tu cartera en cuaderno. Cuando necesitas saber cuánto te deben en total, te toca sumar todo a mano?`,
    contacto_excel: `Hola ${nombre}, vimos tu interés en Control Finanzas. Vi que usas Excel para tu cartera. Sabes exactamente cuánto estás ganando de interés este mes o te toca armar fórmulas aparte?`,
    contacto_app: `Hola ${nombre}, vimos tu interés en Control Finanzas. Vi que ya usas una app para tu cartera. Qué sientes que le falta o qué te gustaría que hiciera diferente?`,
    contacto_sin_control: `Hola ${nombre}, vimos tu interés en Control Finanzas. Vi que aún no llevas un control organizado de tu cartera. Te ha pasado que se te olvida quién te pagó o cuánto te deben?`,
    contacto_inicial: `Hola ${nombre}, vimos tu interés en Control Finanzas. Como llevas el control de tu cartera hoy?`,
  }
  return textos[templateName] || textos.contacto_v2
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
