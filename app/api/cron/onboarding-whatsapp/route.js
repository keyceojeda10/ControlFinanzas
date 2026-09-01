// app/api/cron/onboarding-whatsapp/route.js
// Secuencia WhatsApp post-registro: día 1, 3, 10, trial vencido
// Criterio principal: lastLoginAt (¿volvió el usuario o no?)
// Independiente del wizard (usa waOnboardingStep, no onboardingStep)
// Corre diariamente a las 9am Colombia.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { ventanaAbierta } from '@/lib/bot/telefono'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE_ONBOARDING = 'onboarding_seguimiento'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const SOPORTE = '301 199 3001'

// Errores de Meta que NO se arreglan reintentando: telefono invalido, numero no
// existe, permiso. Mismo criterio que lib/bot-v2/sender.js.
const ERRORES_PERMANENTES_WA = ['#131009', '#131008', '#131026', '#100', 'TELEFONO_INVALIDO']

function enmascararTel(tel) {
  const d = String(tel || '').replace(/\D/g, '')
  if (d.length < 6) return d || 'sin-telefono'
  return `${d.slice(0, 5)}***${d.slice(-4)}`
}

function primerNombre(nombre) {
  if (!nombre || nombre === 'Sin nombre') return ''
  const limpio = nombre.trim()
  if (/\d|club|store|shop|tienda|empresa|negocio|corp|sas|ltda|s\.a/i.test(limpio)) return ''
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return ''
  return partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase()
}

function mismoDia(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

async function enviarWA(telefono, texto, nombre) {
  /* ⚠ `owner.telefono` trae diez dígitos y el lead doce, así que el
     `findUnique` por igualdad que había aquí devolvía `null` SIEMPRE. La
     ventana salía cerrada aunque estuviera abierta y esto mandaba una plantilla
     de marketing —que se paga y que Meta limita con el 131049— en vez del texto
     libre, que es gratis. `ventanaAbierta` cruza por los últimos diez. */
  const ventana = await ventanaAbierta(telefono)
  if (ventana) {
    await wa.sendText(telefono, texto)
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

  const ahora = new Date()
  const res = { dia1: 0, dia3: 0, dia10: 0, vencido: 0, errores: 0, omitidos: 0, telefonosInvalidos: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: { activo: true },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true, lastLoginAt: true, createdAt: true },
          take: 1,
        },
        _count: { select: { clientes: true, prestamos: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' },
          select: { montoCOP: true, estado: true },
        },
      },
    })

    for (const org of orgs) {
      const owner = org.users[0]
      if (!owner?.telefono) continue

      // Telefono que Meta nunca va a aceptar (basura tipo '0000000000', longitud
      // imposible): sacar la org de la cola en vez de reintentar todos los dias.
      if (!wa.telefonoEnviable(owner.telefono)) {
        res.telefonosInvalidos++
        console.warn(`[Onboarding WA] Telefono no enviable ${enmascararTel(owner.telefono)} (org ${org.id}) — se marca y no se reintenta`)
        await prisma.organization.update({
          where: { id: org.id },
          data: { waOnboardingStep: 4, waRecoverySent: true },
        }).catch(() => {})
        continue
      }

      const algunVezPago = org.suscripciones.some(s => s.montoCOP > 0)
      if (algunVezPago) continue

      const dias = Math.floor((ahora.getTime() - org.createdAt.getTime()) / 86400000)
      const nombre = primerNombre(owner.nombre) || 'amigo'
      const clientes = org._count.clientes
      const prestamos = org._count.prestamos
      const step = org.waOnboardingStep || 0

      const noVolvio = !owner.lastLoginAt || mismoDia(new Date(owner.lastLoginAt), new Date(owner.createdAt))
      const demo = org.planDemoHasta ? new Date(org.planDemoHasta) : null
      const demoVencida = demo && demo <= ahora

      try {
        // DÍA 1: Se registró ayer y no ha vuelto
        if (dias >= 1 && dias < 3 && step < 1) {
          let msg
          if (noVolvio && clientes === 0) {
            msg = `Hola ${nombre}, soy del equipo de Control Finanzas. Vi que se registró pero no alcanzó a configurar nada.\n\nEs normal, le toma 2 minutos. Si quiere le ayudo: puede mandarme una foto de una cartulina de un cliente y se la subo al sistema, o si prefiere me escribe al ${SOPORTE} y lo asistimos en vivo.`
          } else if (noVolvio) {
            msg = `Hola ${nombre}, soy del equipo de Control Finanzas. Vi que empezó a configurar el sistema pero no ha vuelto a entrar.\n\nSi tuvo algún problema o duda, me escribe y le ayudo. También puede llamar al ${SOPORTE} y lo asistimos en vivo.`
          } else {
            res.omitidos++
            continue
          }
          await enviarWA(owner.telefono, msg, nombre)
          await prisma.organization.update({ where: { id: org.id }, data: { waOnboardingStep: 1 } })
          res.dia1++
        }

        // DÍA 3: Segundo intento si no volvió
        else if (dias >= 3 && dias < 10 && step < 2) {
          if (prestamos === 0) {
            const msg = clientes === 0
              ? `${nombre}, no quiero ser insistente, pero vi que no ha podido arrancar con el sistema.\n\nSi tiene su cartera en cartulinas o en un cuaderno, me puede mandar una foto y yo se la subo al sistema. Así ve cómo funciona con sus datos reales.\n\nO si prefiere una llamada rápida: ${SOPORTE}.`
              : `${nombre}, ya tiene ${clientes} cliente${clientes > 1 ? 's' : ''} registrado${clientes > 1 ? 's' : ''}. Solo le falta crear un préstamo para ver la magia — el sistema le calcula las cuotas, los intereses, todo.\n\nSi necesita ayuda: ${SOPORTE}.`
            await enviarWA(owner.telefono, msg, nombre)
            await prisma.organization.update({ where: { id: org.id }, data: { waOnboardingStep: 2 } })
            res.dia3++
          } else {
            await prisma.organization.update({ where: { id: org.id }, data: { waOnboardingStep: 2 } })
            res.omitidos++
          }
        }

        // DÍA 10: Pre-vencimiento
        else if (dias >= 10 && dias < 14 && step < 3 && demo) {
          const diasParaVencer = Math.ceil((demo.getTime() - ahora.getTime()) / 86400000)
          if (diasParaVencer > 0 && diasParaVencer <= 5) {
            const msg = prestamos >= 3
              ? `${nombre}, le quedan ${diasParaVencer} días de prueba y ya tiene ${prestamos} préstamos registrados. Se nota que le sirve.\n\nEl plan inicial son $39.000/mes. Si quiere activar, escríbanos al ${SOPORTE}.`
              : `${nombre}, le quedan ${diasParaVencer} días de prueba gratis.\n\nSi no ha podido probar bien, todavía tiene tiempo. Puede subir su cartera con foto de cartulinas y ver el sistema funcionando con sus datos reales.\n\nDudas: ${SOPORTE}.`
            await enviarWA(owner.telefono, msg, nombre)
          }
          await prisma.organization.update({ where: { id: org.id }, data: { waOnboardingStep: 3 } })
          res.dia10++
        }

        // TRIAL VENCIDO: Recuperación
        else if (demoVencida && step < 4 && !org.waRecoverySent && prestamos >= 1) {
          const msg = `${nombre}, se le venció la prueba de Control Finanzas pero sus datos siguen guardados.\n\nSi quiere seguir usando el sistema, el plan inicial son $39.000/mes. Escríbanos al ${SOPORTE} para activar su plan.`
          await enviarWA(owner.telefono, msg, nombre)
          await prisma.organization.update({
            where: { id: org.id },
            data: { waOnboardingStep: 4, waRecoverySent: true },
          })
          res.vencido++
        }

      } catch (e) {
        res.errores++
        // Telefono mal guardado o rechazado de forma permanente por Meta: NO tiene
        // sentido reintentar mañana ni pasado. Se avanza el estado para que esta org
        // salga de la cola. Sin esto, un telefono '0000000000' genero el mismo
        // #131009 dos veces al dia durante 17 dias seguidos.
        const msgErr = String(e?.message || '')
        const esPermanente = e?.permanente === true ||
          ERRORES_PERMANENTES_WA.some((c) => msgErr.includes(c))
        if (esPermanente) {
          res.telefonosInvalidos++
          await prisma.organization.update({
            where: { id: org.id },
            data: { waOnboardingStep: 4, waRecoverySent: true },
          }).catch(() => {})
        }
        // Loguear el telefono enmascarado: con solo el nombre este bug fue
        // imposible de atribuir durante 17 dias.
        console.error(
          `[Onboarding WA] Error ${owner.nombre} (${enmascararTel(owner.telefono)})${esPermanente ? ' [PERMANENTE - org marcada, no se reintenta]' : ''}:`,
          msgErr
        )
      }
    }

    console.log(`[Onboarding WA] Resultados:`, res)
    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[Onboarding WA] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
