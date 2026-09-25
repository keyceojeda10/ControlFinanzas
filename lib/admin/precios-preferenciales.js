// lib/admin/precios-preferenciales.js — quién paga distinto de la lista.
//
// «Que avisara qué clientes tienen precio preferencial, y si es por algún
//  tiempo limitado.» — el dueño, 12 sep 2026.
//
// Puro: recibe las organizaciones ya leídas y las ordena para el inicio del
// panel. La cifra de cada una sale de `resumenPrecio`, la misma cuenta que usa
// el cron para cobrar: si aquí dice $X, el cobro automático manda $X.

import { resumenPrecio, selectPrecio, selectPago } from '@/lib/precio-plan'

const DIA = 86400000

/* Un pago raro de una suscripción que venció hace meses ya no se va a cobrar
   (el cron solo mira 72 h hacia atrás): no hay nada que decidir. */
const HORAS_POR_REVISAR = 72

/* Un preferencial que terminó se sigue enseñando un mes, para que el aviso de
   «ahora paga lista» no desaparezca el mismo día en que cambia el cobro. */
const DIAS_TERMINADOS = 30

/* Temporales que terminan dentro de este plazo: se marcan. */
export const DIAS_TERMINA_PRONTO = 30

const ORDEN = { porRevisar: 0, temporal: 1, definitivo: 2, terminado: 3 }

/** El `select` de Prisma que necesita `clasificarPreferenciales`. */
export function selectPreferenciales() {
  return {
    id: true, nombre: true, plan: true, planOriginal: true, telefono: true,
    cobroAutomatico: true, wompiFuentePagoId: true,
    /* Todo lo que pide el precio, adicionales incluidos: escrito a mano aquí,
       un campo nuevo de `selectPrecio` se quedaba fuera y el panel enseñaba
       un cobro distinto del que hace el cron. */
    ...selectPrecio,
    /* Las más recientes: de aquí salen «la última» y «la última pagada»,
       con las mismas reglas que `ultimaSuscripcion` y `ultimoPago`. */
    suscripciones: {
      orderBy: { fechaVencimiento: 'desc' },
      take: 6,
      select: { ...selectPago, mpStatus: true },
    },
    users: {
      where: { rol: 'owner' },
      take: 1,
      select: { telefono: true, email: true },
    },
  }
}

/** El `where` que trae a los candidatos: con preferencial, o con un pago reciente. */
export function wherePreferenciales(ahora = new Date()) {
  return {
    OR: [
      { precioPreferencial: { not: null } },
      { suscripciones: { some: {
        estado: { in: ['activa', 'vencida'] },
        montoCOP: { gt: 0 },
        fechaVencimiento: { gte: new Date(ahora.getTime() - HORAS_POR_REVISAR * 3600000) },
      } } },
    ],
  }
}

export function clasificarPreferenciales(orgs, { ahora = new Date(), emailsInternos = [] } = {}) {
  const t = new Date(ahora).getTime()
  const filas = []

  for (const org of orgs ?? []) {
    const subs = org.suscripciones ?? []
    const pagada = subs.find(s => ['activa', 'vencida'].includes(s.estado) && s.montoCOP > 0) ?? null
    const ultima = subs.find(s => s.mpStatus !== 'pending') ?? null
    const r = resumenPrecio(org, { pagada, ultima, ahora })

    const reciente = !!pagada && new Date(pagada.fechaVencimiento).getTime() >= t - HORAS_POR_REVISAR * 3600000
    const hasta = r.preferencial?.hasta ? new Date(r.preferencial.hasta).getTime() : null

    let grupo = null
    if (r.porRevisar && reciente) grupo = 'porRevisar'
    else if (r.estado === 'temporal') grupo = 'temporal'
    else if (r.estado === 'definitivo') grupo = 'definitivo'
    else if (r.estado === 'terminado' && t - hasta <= DIAS_TERMINADOS * DIA) grupo = 'terminado'
    if (!grupo) continue

    const owner = org.users?.[0] ?? {}
    filas.push({
      id: org.id,
      nombre: org.nombre,
      country: org.country ?? 'co',
      grupo,
      plan: r.plan,
      preferencial: r.preferencial,
      proximoCobro: r.proximoCobro,
      ultimoPago: r.ultimoPago,
      /* Un preferencial de otro plan no se aplica: se avisa, no se esconde. */
      deOtroPlan: !!r.preferencial && !!r.plan && r.preferencial.plan !== r.plan && grupo !== 'terminado',
      diasParaTerminar: grupo === 'temporal' ? Math.ceil((hasta - t) / DIA) : null,
      cobroAutomatico: !!(org.cobroAutomatico && org.wompiFuentePagoId),
      ownerTelefono: owner.telefono || org.telefono || '',
      interna: !!owner.email && emailsInternos.includes(owner.email),
    })
  }

  filas.sort((a, b) => {
    if (ORDEN[a.grupo] !== ORDEN[b.grupo]) return ORDEN[a.grupo] - ORDEN[b.grupo]
    if (a.grupo === 'porRevisar') {
      /* Primero los que se cobran solos: a ésos el cron les cobra sin preguntar. */
      if (a.cobroAutomatico !== b.cobroAutomatico) return a.cobroAutomatico ? -1 : 1
      return new Date(a.proximoCobro?.fecha ?? 0) - new Date(b.proximoCobro?.fecha ?? 0)
    }
    if (a.grupo === 'temporal') return new Date(a.preferencial.hasta) - new Date(b.preferencial.hasta)
    if (a.grupo === 'terminado') return new Date(b.preferencial.hasta) - new Date(a.preferencial.hasta)
    return String(a.nombre).localeCompare(String(b.nombre), 'es')
  })

  const conteo = { porRevisar: 0, temporal: 0, definitivo: 0, terminado: 0, terminaPronto: 0 }
  for (const f of filas) {
    conteo[f.grupo]++
    if (f.grupo === 'temporal' && f.diasParaTerminar <= DIAS_TERMINA_PRONTO) conteo.terminaPronto++
  }
  return { filas, conteo }
}
