// app/api/cron/seguimiento-manana/route.js
// Seguimiento puntual (one-shot) a leads que quedaron pendientes el dia anterior:
//   - "dijo_despues": dijeron "manana lo hago / a las 8am" -> recordatorio de registro
//   - "problema_tecnico": se enredaron usando la app -> preguntar si resolvio + ofrecer soporte
//   - "media_conversacion": interesados cuya charla quedo a medias -> retomar
// Solo escribe a leads con la VENTANA de 24h abierta (Meta no deja texto libre fuera).
// Pensado para dispararse una vez (8:30am Col). Despues se quita del crontab.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'

const VENTANA_MS = 24 * 3600 * 1000
const ult10 = (t) => (t || '').replace(/\D/g, '').slice(-10)

const NUM_SOPORTE = '301 199 3001'

function primerNombre(n) {
  if (!n) return ''
  const p = n.trim().split(/\s+/)[0]
  if (/\d|club|store|tienda|centro|distri|360|naturavital/i.test(p)) return ''
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

function clasificar(textoLead) {
  const t = textoLead.toLowerCase()
  if (/no me deja|no me aparece|no me sale|no abre|no funciona|no puedo|problema|error|no carga|desactualizada|no veo/.test(t)) return 'problema_tecnico'
  if (/manana|mañana|mas tarde|luego|despues|8 ?am|8 ?de la|al rato|ahorita|ya lo hago|lo hago|mandeme|video/.test(t)) return 'dijo_despues'
  return 'media_conversacion'
}

function mensajePara(tipo, nombre) {
  const saludo = nombre ? `${nombre}, ` : ''
  if (tipo === 'problema_tecnico') {
    return `Buenos dias ${saludo}quedo pendiente lo que estaba configurando ayer en el sistema. Pudo resolverlo?\n\nSi sigue con dudas, escribale a nuestro equipo de soporte al ${NUM_SOPORTE} (atienden de 7am a 10pm) y le ayudan paso a paso. Aqui tambien estoy si necesita algo.`
  }
  if (tipo === 'dijo_despues') {
    return `Buenos dias ${saludo}retomando lo de ayer. Quedo en probar el sistema, le ayudo a registrarse y dejarlo funcionando?\n\nSe registra aqui: https://app.control-finanzas.com/registro?r=2\n\nMe avisa cuando entre y lo acompano.`
  }
  // media_conversacion
  return `Buenos dias ${saludo}ayer quedamos a mitad de la conversacion. Sigue interesado en organizar sus prestamos y cobros desde el celular?\n\nLo puede probar gratis 14 dias: https://app.control-finanzas.com/registro?r=2`
}

export async function POST(req) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Registrados -> excluir
  const users = await prisma.user.findMany({ select: { telefono: true } })
  const reg = new Set(users.map(u => ult10(u.telefono)).filter(Boolean))

  const desde = new Date('2026-06-02T00:00:00Z')
  const leads = await prisma.botLead.findMany({
    where: { createdAt: { gte: desde }, botActivo: true, estado: { notIn: ['cerrado', 'bloqueado', 'no_interesado'] } },
    include: { conversaciones: { orderBy: { createdAt: 'asc' } } },
  })

  const ahora = Date.now()
  const res = { enviados: 0, omitidos_registrado: 0, omitidos_ventana: 0, omitidos_sin_respuesta: 0, detalle: [] }

  for (const l of leads) {
    if (reg.has(ult10(l.telefono))) { res.omitidos_registrado++; continue }
    const msgsLead = l.conversaciones.filter(c => c.rol === 'lead')
    if (msgsLead.length === 0) { res.omitidos_sin_respuesta++; continue }
    const ultLead = msgsLead[msgsLead.length - 1]
    // Ventana 24h en el momento del envio
    if (ahora - new Date(ultLead.createdAt).getTime() >= VENTANA_MS) { res.omitidos_ventana++; continue }

    const textoLead = msgsLead.map(m => m.texto || '').join(' ')
    const tipo = clasificar(textoLead)
    const nombre = primerNombre(l.nombre)
    const texto = mensajePara(tipo, nombre)

    try {
      const envio = await wa.sendText(l.telefono, texto)
      await prisma.botConversacion.create({
        data: { botLeadId: l.id, rol: 'bot', texto, wamid: wa.wamidDe(envio) },
      })
      res.enviados++
      res.detalle.push({ tel: ult10(l.telefono).slice(-4), tipo })
      await new Promise(r => setTimeout(r, 1500)) // pequeno respiro entre envios
    } catch (e) {
      res.detalle.push({ tel: ult10(l.telefono).slice(-4), tipo, error: e.message })
    }
  }

  return NextResponse.json(res)
}
