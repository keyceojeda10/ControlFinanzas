// app/api/tarjeta/reclamo/[token]/route.js — «PAGUÉ Y NO APARECE», DESDE LA TARJETA.
//
// Pública: la llave es el enlace. Solo guarda lo que dice el cliente y avisa al
// dueño; no toca ningún pago ni ninguna cifra. Con uno abierto de las últimas 24 h
// responde igual sin crear otro: tocar diez veces no son diez avisos en el teléfono
// del dueño.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificar } from '@/lib/notificar'
import { formatMoney, formatFechaCalendario, getUtcOffset } from '@/lib/i18n'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { tokenValido } from '@/lib/tarjeta/enlace'
import { validarReclamo } from '@/lib/tarjeta/reclamo'

const limite = rateLimit('tarjeta-reclamo', 10, 60 * 60 * 1000)
const UN_DIA = 86400000

export async function POST(req, { params }) {
  if (!limite(getClientIp(req)).ok) {
    return NextResponse.json({ error: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 })
  }
  const { token } = await params
  const noDisponible = NextResponse.json({ error: 'Este enlace ya no está disponible.' }, { status: 404 })
  if (!tokenValido(token)) return noDisponible

  const cliente = await prisma.cliente.findUnique({
    where: { tarjetaToken: token },
    select: {
      id: true, nombre: true, organizationId: true,
      organization: { select: { activo: true, reciboCliente: true, country: true } },
    },
  })
  const org = cliente?.organization
  if (!org?.activo || org.reciboCliente !== 'tarjeta') return noDisponible

  const body = await req.json().catch(() => null)
  const r = validarReclamo(body, { offsetHoras: getUtcOffset(org.country ?? 'co') })
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })

  const abierto = await prisma.reclamoPago.findFirst({
    where: { clienteId: cliente.id, revisadoEn: null, createdAt: { gte: new Date(Date.now() - UN_DIA) } },
    select: { id: true },
  })
  if (abierto) return NextResponse.json({ ok: true })

  await prisma.reclamoPago.create({
    data: { organizationId: cliente.organizationId, clienteId: cliente.id, monto: r.monto, fecha: r.fecha, nota: r.nota },
  })

  const pais = org.country ?? 'co'
  await notificar({
    organizationId: cliente.organizationId,
    para: 'owners',
    tipo: 'reclamo_pago',
    titulo: 'Un cliente dice que pagó y no aparece',
    mensaje: `${cliente.nombre}${r.monto ? `: ${formatMoney(r.monto, pais)}` : ''} el ${formatFechaCalendario(r.fecha, pais)}`,
    href: `/clientes/${cliente.id}`,
    datos: { tag: `reclamo_pago:${cliente.id}`, clienteId: cliente.id },
  })

  return NextResponse.json({ ok: true })
}
