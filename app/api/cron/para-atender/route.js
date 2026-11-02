// app/api/cron/para-atender/route.js — el aviso de las 9 a. m. (2 nov 2026).
//
// Un WhatsApp a cada persona de `ATENDER_WHATSAPP` (el dueño y quien le ayuda)
// con cuántos negocios serios hay para atender hoy y el enlace firmado a la
// lista (/atender). Si no hay nadie, no manda nada: «me llega un montón de
// cosas que hasta las ignoro porque es pura basura».
//
// Va por la plantilla UTILITY propia `lista_para_atender` (creada el 2 nov; la
// de escalamiento decía «Escalamiento: X necesita atención» y se leía raro).
// Si Meta todavía no la aprobó o la rechaza, cae a `alerta_escalamiento`, que
// ya estaba aprobada: el aviso nunca se queda sin salir. Las dos son UTILITY y
// se pueden mandar fuera de la ventana de 24 h. Una vez al día por persona: lo
// que ya salió hoy queda en `Evento` y no se repite si el cron corre dos veces.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { paraAtender, pendientes } from '@/lib/seguimiento/para-atender'
import { destinatarios, enlace, diaBogota } from '@/lib/seguimiento/enlace-atender'

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export async function POST(req) {
  if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const ahora = new Date()
  const lista = pendientes(await paraAtender({ ahora }), ahora)
  const resumen = { pendientes: lista.length, enviados: [], omitidos: [] }
  if (lista.length === 0) return NextResponse.json(resumen)

  const calientes = lista.filter((f) => f.nivel === 'caliente').length
  const decidir = lista.filter((f) => f.momento === 'decidir').length
  const primero = lista.find((f) => f.telefono) ?? null
  const dia = diaBogota(ahora)

  for (const { quien, numero } of destinatarios()) {
    const clave = `aviso_atender:${dia}:${quien}`
    const ya = await prisma.evento.findFirst({ where: { evento: 'aviso_atender', pagina: clave }, select: { id: true } })
    if (ya) { resumen.omitidos.push(quien); continue }
    const detalle = [
      calientes > 0 ? plural(calientes, 'caliente', 'calientes') : null,
      decidir > 0 ? `${decidir} por decidir hoy` : null,
    ].filter(Boolean).join(', ')
    const link = enlace(BASE, quien, ahora)
    const resumenTxt = `${plural(lista.length, 'negocio serio', 'negocios serios')} para atender${detalle ? ` (${detalle})` : ''}`
    let r = await wa.sendTemplate(numero, 'lista_para_atender', { quien, resumen: resumenTxt, enlace: link })
      .catch((e) => ({ error: e?.message ?? 'error' }))
    if (r?.error) {
      r = await wa.sendTemplate(numero, 'alerta_escalamiento', {
        nombre: `${quien}, hoy ${plural(lista.length, 'negocio serio', 'negocios serios')}`,
        motivo: `Para atender hoy${detalle ? ` (${detalle})` : ''}. La lista con el mensaje para cada uno: ${link}`,
        telefono: primero ? String(primero.telefono).replace(/\D/g, '').replace(/^(3\d{9})$/, '57$1') : '573011993001',
      }).catch((e) => ({ error: e?.message ?? 'error' }))
    }
    const ok = !r?.error
    // Solo se apunta lo que salió: si falló, la siguiente corrida lo reintenta.
    if (ok) await prisma.evento.create({ data: { evento: 'aviso_atender', pagina: clave, metadata: JSON.stringify({ quien, pendientes: lista.length }) } })
    resumen.enviados.push({ quien, ok })
  }
  return NextResponse.json(resumen)
}
