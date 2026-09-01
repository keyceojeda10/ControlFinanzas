// lib/bot/telefono.js — la ÚNICA forma de cruzar un teléfono con un BotLead.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// La app guarda el teléfono como lo escribe el usuario: `3001234567`, diez
// dígitos. WhatsApp lo entrega con indicativo: `573001234567`, doce. Cruzarlos
// con `=` no casa NUNCA, y eso es exactamente lo que hacían tres sitios.
//
// Medido en producción el 1 sep 2026, sobre 1.657 leads:
//
//   · enlazados a una organización ............ 220  (todos de 12 dígitos)
//   · que coinciden en texto exacto con su User . 0
//   · registrados y SIN enlazar ............... 207, de los cuales 195 ya
//     tenían su lead creado cuando se registraron
//
// Los 220 que sí están enlazados no los enlazó el registro: los enlazó
// `verificarRegistro()` en `lib/bot-v2/agente.js`, que sí compara por los
// últimos diez, cuando la persona VUELVE a escribir. Por eso el enlace llegaba
// tarde o no llegaba.
//
// ══ LO QUE ESO ROMPÍA ══════════════════════════════════════════════════════
//
// 1. **El bot le seguía vendiendo a quien ya se había registrado.** No lo sabía:
//    el lead no tenía organización, así que le mandaba otra vez el link de
//    registro. Está documentado con conversaciones reales de agosto.
//
// 2. **Los avisos post-registro salían por plantilla de pago.** Los crons de
//    onboarding y reactivación buscan el lead para saber si la ventana de 24 h
//    está abierta y poder mandar texto libre, que es gratis. Como no lo
//    encontraban, `ventana` era siempre `false` y siempre mandaban plantilla de
//    marketing — la que Meta limita con el error 131049 y la que se paga.
//
// ⚠ NO VOLVER A ESCRIBIR UN CRUCE A MANO. Si aparece un `where: { telefono }`
// contra `BotLead` con un número que viene de la app, es este fallo otra vez.

/* ⚠ El cliente de Prisma se pide DENTRO de cada función, no arriba. Así este
   módulo se puede importar —y probar— sin base de datos: `ultimos10` y
   `mismoTelefono` son funciones puras y no tienen por qué arrastrar una
   conexión. Mismo motivo por el que `apuntar()` lo hace así en
   `lib/bot/whatsapp-cloud.js`. */
async function db() {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

/** Los últimos diez dígitos, que es lo único que comparten los dos formatos.
 *  Devuelve '' si no llega a diez: un fragmento más corto casaría de más. */
export function ultimos10(telefono) {
  const d = String(telefono ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : ''
}

/** ¿Son el mismo número, venga como venga? */
export function mismoTelefono(a, b) {
  const x = ultimos10(a)
  return Boolean(x) && x === ultimos10(b)
}

/** Todos los leads de ese número. Son varios cuando alguien escribió desde dos
 *  formatos distintos, cosa que pasa. */
export async function buscarLeads(telefono, where = {}) {
  const u10 = ultimos10(telefono)
  if (!u10) return []
  const prisma = await db()
  return prisma.botLead.findMany({
    where: { telefono: { endsWith: u10 }, ...where },
    orderBy: { createdAt: 'desc' },
    select: { id: true, telefono: true, organizationId: true, estado: true },
  })
}

/** El lead más reciente de ese número, o `null`. Es el que hay que usar para
 *  preguntar si la ventana de 24 h está abierta. */
export async function buscarLead(telefono) {
  const u10 = ultimos10(telefono)
  if (!u10) return null
  const prisma = await db()
  return prisma.botLead.findFirst({
    where: { telefono: { endsWith: u10 } },
    orderBy: { createdAt: 'desc' },
  })
}

/** ¿Escribió el lead en las últimas 24 horas? Si sí, se le puede mandar texto
 *  libre; si no, hay que gastar una plantilla.
 *
 *  ⚠ Preguntar esto mal cuesta dinero en las dos direcciones: creerla cerrada
 *  manda una plantilla que no hacía falta, y creerla abierta manda un texto que
 *  Meta rechaza y el cliente no recibe. */
export async function ventanaAbierta(telefono) {
  const lead = await buscarLead(telefono)
  if (!lead) return false
  const prisma = await db()
  const ultimo = await prisma.botConversacion.findFirst({
    where: { botLeadId: lead.id, rol: 'lead' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!ultimo) return false
  return Date.now() - new Date(ultimo.createdAt).getTime() < 24 * 3600000
}
