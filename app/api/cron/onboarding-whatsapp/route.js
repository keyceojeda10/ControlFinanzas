// app/api/cron/onboarding-whatsapp/route.js
// Onboarding post-registro por WhatsApp — secuencia día 1, 3, 10, trial vencido
// Corre 3 veces al día (8am, 2pm, 8pm Colombia). Solo envía en horario decente.
// Usa texto libre si la ventana de 24h está abierta, plantilla si no.
// Todos los mensajes dirigen al usuario a Carlos (cal.com + 301 199 3001).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE_ONBOARDING = 'onboarding_seguimiento'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const CAL_LINK = 'https://cal.com/control-finanzas'
const SOPORTE = '301 199 3001'

function enHorarioDecente() {
  const horaCol = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours()
  return horaCol >= 8 && horaCol < 21
}

function primerNombre(nombre) {
  if (!nombre || nombre === 'Sin nombre') return ''
  const limpio = nombre.trim()
  if (/\d|club|store|shop|tienda|empresa|negocio|corp|sas|ltda|s\.a/i.test(limpio)) return ''
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return ''
  const primer = partes[0]
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()
}

async function ventanaAbierta(telefono) {
  const botLead = await prisma.botLead.findUnique({ where: { telefono } })
  if (!botLead) return false
  const ultimoMsg = await prisma.botConversacion.findFirst({
    where: { botLeadId: botLead.id, rol: 'lead' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!ultimoMsg) return false
  return Date.now() - new Date(ultimoMsg.createdAt).getTime() < 24 * 3600 * 1000
}

async function enviarMensaje(telefono, textoLibre, nombre) {
  const abierta = await ventanaAbierta(telefono)
  if (abierta) {
    await wa.sendText(telefono, textoLibre)
  } else {
    await wa.sendTemplate(telefono, TEMPLATE_ONBOARDING, { nombre: nombre || 'amigo' }, TEMPLATE_LANG)
  }
}

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 500 })
  }

  if (!enHorarioDecente()) {
    return NextResponse.json({ ok: true, omitido: 'fuera_de_horario' })
  }

  const ahora = new Date()
  const resultados = { dia1: 0, dia3: 0, dia10: 0, vencido: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: { activo: true },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true },
          take: 1,
        },
        _count: { select: { clientes: true, prestamos: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' },
          select: { fechaVencimiento: true, montoCOP: true, estado: true },
        },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner?.telefono) continue

      const diasDesdeRegistro = Math.floor((ahora.getTime() - org.createdAt.getTime()) / 86400000)
      const nombre = primerNombre(owner.nombre) || 'amigo'
      const clientes = org._count.clientes
      const prestamos = org._count.prestamos
      const step = org.onboardingStep || 0

      // Skip si alguna vez pagó (cualquier suscripción con monto > 0)
      const algunVezPago = org.suscripciones.some(s => s.montoCOP > 0)
      if (algunVezPago) continue

      // Skip usuarios en trial con alto uso (20+ clientes = ya saben usar el sistema)
      if (clientes >= 20) continue

      const demo = org.planDemoHasta ? new Date(org.planDemoHasta) : null
      const enDemo = demo && demo > ahora
      const demoVencida = demo && demo <= ahora
      const diasParaVencer = demo ? Math.ceil((demo.getTime() - ahora.getTime()) / 86400000) : null

      try {
        // ═══ DÍA 1: Bienvenida + oferta de llamada ═══
        if (diasDesdeRegistro >= 1 && diasDesdeRegistro < 3 && step < 1) {
          let msg
          if (clientes === 0) {
            msg = `Hola ${nombre}, soy Carlos del equipo de Control Finanzas. Vi que se registró y quería saber si necesita ayuda para arrancar.\n\nSi quiere, le puedo mostrar el sistema en una llamada rápida. Escoja el horario que le quede bien aquí:\n${CAL_LINK}\n\nO si prefiere, me escribe al ${SOPORTE} y le ayudo por ahí.`
          } else {
            msg = `Hola ${nombre}, soy Carlos de Control Finanzas. Vi que ya empezó a usar el sistema, bien!\n\nSi quiere que le muestre las funciones avanzadas o tiene alguna duda, agendemos una llamada rápida:\n${CAL_LINK}\n\nO me escribe al ${SOPORTE}, como le quede mejor.`
          }
          await enviarMensaje(owner.telefono, msg, nombre)
          await prisma.organization.update({ where: { id: org.id }, data: { onboardingStep: 1 } })
          resultados.dia1++
        }

        // ═══ DÍA 3: Seguimiento según progreso ═══
        else if (diasDesdeRegistro >= 3 && diasDesdeRegistro < 10 && step < 2) {
          let msg
          if (clientes === 0) {
            msg = `${nombre}, soy Carlos de Control Finanzas. Vi que todavía no ha agregado clientes al sistema.\n\nSi no ha tenido tiempo, le propongo algo: agendamos una llamada y yo mismo le ayudo a configurar todo.\n${CAL_LINK}\n\nEs gratis y sin compromiso. O me escribe al ${SOPORTE}.`
          } else if (prestamos === 0) {
            msg = `${nombre}, ya tiene ${clientes} cliente${clientes > 1 ? 's' : ''} registrado${clientes > 1 ? 's' : ''}. El siguiente paso es crear su primer préstamo — el sistema le calcula las cuotas solo.\n\nSi quiere le muestro cómo en una llamada rápida:\n${CAL_LINK}\n\nO al ${SOPORTE}.`
          } else {
            msg = `${nombre}, va muy bien — ${clientes} clientes y ${prestamos} préstamos registrados.\n\nSabía que puede enviar recibos por WhatsApp? Si quiere le muestro eso y más en una llamada:\n${CAL_LINK}\n\nO me escribe al ${SOPORTE}.`
          }
          await enviarMensaje(owner.telefono, msg, nombre)
          await prisma.organization.update({ where: { id: org.id }, data: { onboardingStep: 2 } })
          resultados.dia3++
        }

        // ═══ DÍA 10: Pre-vencimiento ═══
        else if (diasDesdeRegistro >= 10 && diasDesdeRegistro < 14 && step < 3 && enDemo) {
          let msg
          if (clientes >= 5) {
            msg = `${nombre}, le quedan ${diasParaVencer} días de prueba y ya tiene ${clientes} clientes — se nota que le está sirviendo.\n\nEl plan inicial son $39,000/mes. Si quiere le explico los planes en una llamada:\n${CAL_LINK}\n\nO escriba al ${SOPORTE} para activar su plan de una.`
          } else {
            msg = `${nombre}, le quedan ${diasParaVencer} días de prueba gratis.\n\nSi no ha podido probar bien, agendemos una llamada y le muestro todo lo que puede hacer con su cartera:\n${CAL_LINK}\n\nAsí decide con toda la información. También me puede escribir al ${SOPORTE}.`
          }
          await enviarMensaje(owner.telefono, msg, nombre)
          await prisma.organization.update({ where: { id: org.id }, data: { onboardingStep: 3 } })
          resultados.dia10++
        }

        // ═══ TRIAL VENCIDO: Recuperación ═══
        else if (demoVencida && step < 4 && !org.waRecoverySent) {
          if (clientes >= 3) {
            const msg = `${nombre}, vi que tenía ${clientes} clientes registrados en Control Finanzas. Se le venció la prueba pero sus datos siguen guardados.\n\nEl plan inicial son $39,000/mes. Si quiere seguir, agendemos una llamada y le reactivo todo:\n${CAL_LINK}\n\nO escriba al ${SOPORTE} para activar su plan.`
            await enviarMensaje(owner.telefono, msg, nombre)
            await prisma.organization.update({
              where: { id: org.id },
              data: { onboardingStep: 4, waRecoverySent: true },
            })
            resultados.vencido++
          }
        }

      } catch (e) {
        resultados.errores++
        console.error(`[Onboarding WA] Error ${owner.nombre} (${org.nombre}):`, e.message)
      }
    }

    console.log(`[Onboarding WA] Resultados:`, resultados)
    return NextResponse.json({ ok: true, ...resultados })
  } catch (error) {
    console.error('[Onboarding WA] Error general:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
