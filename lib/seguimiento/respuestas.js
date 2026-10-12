/* ── LO QUE LA PERSONA RESPONDE AL SEGUIMIENTO ───────────────────────────────
 *
 * El webhook de WhatsApp pregunta aquí PRIMERO. Si el mensaje responde a un
 * envío del seguimiento, se atiende aquí y no llega al bot de ventas: quien se
 * fue o dejó de usar la app ya es cliente, no un lead al que venderle desde
 * cero.
 *
 * Se reconoce de dos formas:
 *   · un botón de la plantilla (`type: 'button'`, con `context.id` = el wamid
 *     del envío). ⚠ El webhook DESCARTABA este tipo: el «¿nos dice el motivo?»
 *     no habría guardado nada;
 *   · un texto del dueño de ese negocio en las 72 h siguientes a un envío.
 *
 * Desde el 1 oct 2026 cada respuesta se cobra: se contesta UNA vez por
 * mensaje de la persona y sin partir en varios.
 */

import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { sendMessage, escapeHtml } from '@/lib/telegram'
import { NO_MAS_MENSAJES } from './plantillas'
import { esNoMasMensajes, motivoDeRespuesta, esRespuestaPositiva, motivoParaEscalar, DESCUENTO_NEQUI } from './reglas'
import { escalar } from './escalar'
import { ultimoUsoPorOrg } from './motor'

const APP = 'https://app.control-finanzas.com'
const VENTANA_TEXTO_MS = 72 * 3600000

/** Lo que dice el mensaje, venga de un botón de plantilla, uno interactivo o texto. */
export function textoDe(msg) {
  const tipo = String(msg?.type ?? '').toLowerCase()
  if (tipo === 'button') return String(msg.button?.text ?? msg.button?.payload ?? '')
  if (tipo === 'interactive') return String(msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '')
  if (tipo === 'text') return String(msg.text?.body ?? '')
  return ''
}

const ultimos10 = (t) => String(t ?? '').replace(/\D/g, '').slice(-10)

/** El envío al que responde: por el wamid citado o, si es texto, el más reciente de ese dueño. */
async function envioRespondido(msg, ahora) {
  const citado = msg?.context?.id
  if (citado) {
    const e = await prisma.envioSeguimiento.findFirst({ where: { wamid: citado } })
    if (e) return e
  }
  if (String(msg?.type).toLowerCase() !== 'text') return null
  const tel = ultimos10(msg.from)
  if (tel.length < 10) return null
  const dueno = await prisma.user.findFirst({
    where: { rol: 'owner', telefono: { endsWith: tel } },
    select: { organizationId: true },
  })
  const orgId = dueno?.organizationId
    ?? (await prisma.organization.findFirst({ where: { telefono: { endsWith: tel } }, select: { id: true } }))?.id
  if (!orgId) return null
  return prisma.envioSeguimiento.findFirst({
    where: { organizationId: orgId, canal: 'whatsapp', ok: true, createdAt: { gte: new Date(ahora.getTime() - VENTANA_TEXTO_MS) } },
    orderBy: { createdAt: 'desc' },
  })
}

/* Lo que se contesta a cada motivo. Texto libre: la ventana está abierta. */
const RESPUESTA_A_MOTIVO = {
  precio: `Gracias por contarnos. Si deja su Nequi guardado para el pago automático, su próximo mes le sale con ${DESCUENTO_NEQUI * 100} % de descuento. Lo activa aquí: ${APP}/configuracion/plan`,
  no_uso: 'Entendido. Si quiere, un asesor le ayuda a dejar su cuenta lista, y le cargamos los clientes desde fotos del cuaderno o el Excel. ¿Le escribimos? Responda «sí» y lo llamamos.',
  falta_algo: '¿Qué le hizo falta? Escríbalo aquí y lo revisamos con el equipo.',
  otro_sistema: 'Gracias por contarnos. ¿Nos dice a cuál se cambió y qué le gustó de ese? Nos ayuda a mejorar.',
  cerro: 'Gracias por contarnos, le deseamos lo mejor. Sus datos quedan guardados por si algún día vuelve.',
  otro: '¿Nos cuenta qué pasó? Lo leemos todo.',
}

/* Los motivos tras los que el siguiente texto es el detalle que pedimos. */
const PIDE_DETALLE = new Set(['falta_algo', 'otro_sistema', 'otro', 'no_uso'])

/**
 * @returns {Promise<boolean>} true si el mensaje era del seguimiento y ya se atendió.
 */
export async function atenderRespuestaSeguimiento(msg, { ahora = new Date() } = {}) {
  const texto = textoDe(msg).trim()
  if (!texto) return false
  const envio = await envioRespondido(msg, ahora)
  if (!envio) return false

  const anterior = envio.respuesta ?? ''
  await prisma.envioSeguimiento.update({
    where: { id: envio.id },
    data: { respuesta: (anterior ? `${anterior} | ${texto}` : texto).slice(0, 4000), respondidoAt: ahora },
  })
  const responder = (t) => wa.sendText(msg.from, t, false).catch((e) => console.error('[seguimiento] respuesta:', e.message))

  if (esNoMasMensajes(texto)) {
    await prisma.seguimientoOrg.upsert({
      where: { organizationId: envio.organizationId },
      create: { organizationId: envio.organizationId, noMolestar: true, noMolestarAt: ahora },
      update: { noMolestar: true, noMolestarAt: ahora },
    })
    await responder('Listo, no le enviaremos más mensajes de seguimiento. Si necesita algo, escríbanos por aquí.')
    return true
  }

  const org = await prisma.organization.findUnique({
    where: { id: envio.organizationId },
    select: {
      nombre: true, plan: true, telefono: true,
      users: { where: { rol: 'owner' }, select: { id: true, telefono: true }, take: 1 },
      _count: { select: { clientes: true } },
    },
  })
  const motivo = envio.paso === 'd3_motivo' ? motivoDeRespuesta(texto) : null
  const motivoPrevio = envio.paso === 'd3_motivo' ? motivoDeRespuesta(anterior.split(' | ')[0]) : null

  if (motivo) {
    await prisma.seguimientoOrg.upsert({
      where: { organizationId: envio.organizationId },
      create: { organizationId: envio.organizationId, motivoBaja: motivo, motivoAt: ahora, ...(motivo === 'precio' ? { ofertaNequi: 'disponible', ofertaNequiAt: ahora } : {}) },
      update: { motivoBaja: motivo, motivoAt: ahora, ...(motivo === 'precio' ? { ofertaNequi: 'disponible', ofertaNequiAt: ahora } : {}) },
    })
    await responder(RESPUESTA_A_MOTIVO[motivo])
  } else if (texto === 'Que me ayuden') {
    // El botón de `cuenta_configurar`: pide que le carguen la cartera.
    await responder('Perfecto. Envíe por aquí las fotos del cuaderno o de las cartulinas, o el Excel, y se los dejamos cargados en máximo 24 horas.')
    await sendMessage(`<b>Pide carga de cartera con asesor:</b> ${escapeHtml(org?.nombre ?? '')} · ${escapeHtml(msg.from)}`, null, 'escalamiento').catch(() => null)
  } else {
    /* Un texto libre: el detalle de lo que le faltó, o una respuesta a
       cualquier envío. Queda como sugerencia si es el detalle pedido, y Carlos
       lo lee por Telegram (son pocos y son clientes). Se agradece una vez. */
    if (motivoPrevio && PIDE_DETALLE.has(motivoPrevio) && org?.users[0]?.id) {
      await prisma.sugerencia.create({
        data: {
          organizationId: envio.organizationId, userId: org.users[0].id, rol: 'owner',
          texto: `[Se fue: ${motivoPrevio}] ${texto}`.slice(0, 4000), fuente: 'whatsapp',
        },
      }).catch((e) => console.error('[seguimiento] sugerencia:', e.message))
    }
    if (!anterior || motivoDeRespuesta(anterior.split(' | ').pop())) await responder('Gracias, lo leemos con el equipo y le respondemos por aquí.')
    await sendMessage(`<b>Respuesta al seguimiento</b> (${escapeHtml(envio.paso)}) · ${escapeHtml(org?.nombre ?? '')} · ${escapeHtml(msg.from)}\n«${escapeHtml(texto.slice(0, 500))}»`, null, 'notif').catch(() => null)
  }

  // Carlos, si es una cuenta grande y la respuesta lo pide.
  const accion = motivoParaEscalar({
    clientes: org?._count?.clientes ?? 0, caso: envio.caso, motivo,
    positiva: !motivo && esRespuestaPositiva(texto), yaEscalado: Boolean(envio.escaladoAt), ahora,
  })
  if (accion && org) {
    const usos = await ultimoUsoPorOrg([envio.organizationId])
    const pago = await prisma.pagoSuscripcion.findFirst({
      where: { organizationId: envio.organizationId, montoCOP: { gt: 0 } }, orderBy: { fecha: 'desc' }, select: { plan: true, montoCOP: true },
    })
    await escalar({
      envioId: envio.id, org: org.nombre, telefono: org.users[0]?.telefono ?? org.telefono ?? msg.from,
      clientes: org._count.clientes, plan: pago?.plan ?? org.plan, monto: pago?.montoCOP ?? 0,
      ultimoUso: usos.get(envio.organizationId), envio, respuesta: texto, accion,
    })
  }
  return true
}

export { NO_MAS_MENSAJES }
