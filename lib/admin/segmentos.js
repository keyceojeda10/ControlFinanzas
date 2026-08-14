/* ══ QUIÉN ES QUIÉN ENTRE LAS 485 ORGANIZACIONES ═════════════════════════════
 *
 * Reportado por el dueño el 14 ago 2026:
 *
 *   «Hay un montón de paneles, pero con datos iguales que se duplican y son
 *    igual de irrelevantes. La gestión de los usuarios, poder distinguir cuáles
 *    están vencidos, que pagaban, cuáles pues son ya usuarios basura,
 *    desechables.»
 *
 * Tenía razón y el problema era de fondo, no de pantallas. Había DOS
 * clasificaciones distintas conviviendo:
 *
 *   · `negocio`   decía Pagando / Trials / Muertos / Churneados.
 *   · `activacion` decía Activos / Probando / Inactivos… mirando SOLO el número
 *     de clientes cargados, sin preguntar si pagan. Así, quien paga $259.000 y
 *     quien no ha pagado nunca salían los dos como «activos».
 *
 * Este módulo es la única definición. Si una pantalla cuenta distinto que otra,
 * es porque no está usando esto.
 *
 * ── LO QUE HAY DEBAJO (medido el 14 ago 2026) ───────────────────────────────
 *
 *     pagando              46      ← el negocio de verdad
 *     probando             45
 *     pagó y se fue         8
 *     vencido con datos   177      ← la lista que vale oro: probaron en serio
 *     basura              209      ← 43% del total, y engordaba TODAS las cifras
 *
 * ⚠ El orden importa. «Basura» se decide ANTES que «probando»: quien se
 *   registró y no ha entrado nunca, o no ha cargado un solo cliente, no es un
 *   trial vivo aunque le queden días. Los clientes cargados son lo que predice
 *   el pago (0 clientes → 0%), así que un trial sin datos no es una venta en
 *   curso: es ruido.
 */

/* Los tonos son los de `Pastilla` (lib de primitivos), no nombres de colores:
   mora=rojo, atraso=oro, aldia=verde, neutro=gris. Escribir 'verde' aquí no da
   error, cae en `neutro` sin avisar y salen las cinco pastillas iguales. */
export const SEGMENTOS = [
  { id: 'pagando',   rotulo: 'Pagando',        tono: 'aldia',  ayuda: 'Suscripción al día con dinero cobrado' },
  { id: 'probando',  rotulo: 'Probando',       tono: 'atraso', ayuda: 'Prueba viva y con datos cargados' },
  { id: 'vencido',   rotulo: 'Vencido',        tono: 'neutro', ayuda: 'Se le acabó la prueba, pero llegó a usarla' },
  { id: 'churn',     rotulo: 'Pagó y se fue',  tono: 'mora',   ayuda: 'Llegó a pagar y dejó de hacerlo' },
  { id: 'basura',    rotulo: 'Sin arrancar',   tono: 'neutro', ayuda: 'Nunca inició sesión, o no cargó ni un cliente' },
]

/** Los que cuentan como clientes de verdad para las cifras de arriba. */
export const SEGMENTOS_REALES = ['pagando', 'probando', 'vencido', 'churn']

const DIA = 86400000

/**
 * Clasifica UNA organización.
 *
 * @param {object} org  con `users` (el owner), `suscripciones` y `_count`
 * @param {Date}   ahora
 */
export function segmentarOrganizacion(org, ahora = new Date()) {
  const owner = org.users?.[0] ?? {}
  const suscs = org.suscripciones ?? []
  // La vigente es la más reciente que no sea un intento de MP que nunca cuajó.
  const susc = suscs[0] ?? null

  const clientes  = org._count?.clientes ?? 0
  const prestamos = org._count?.prestamos ?? 0

  const diasDesdeRegistro = Math.floor((ahora - new Date(org.createdAt)) / DIA)
  const ultimaActividad = owner.lastActivityAt ?? owner.lastLoginAt ?? null
  const diasSinActividad = ultimaActividad
    ? Math.floor((ahora - new Date(ultimaActividad)) / DIA)
    : diasDesdeRegistro

  const vigente = susc ? new Date(susc.fechaVencimiento) > ahora : false
  // «Pagó alguna vez» mira TODAS sus suscripciones, no solo la última: renovar a
  // mano crea una fila nueva y dejaba la vieja detrás.
  const pagoAlgunaVez = suscs.some((s) => (s.montoCOP ?? 0) > 0)
  const pagaAhora = !!susc && (susc.montoCOP ?? 0) > 0 && susc.estado === 'activa' && vigente

  let segmento
  if (pagaAhora)                             segmento = 'pagando'
  else if (pagoAlgunaVez)                    segmento = 'churn'
  else if (!owner.lastLoginAt || clientes === 0) segmento = 'basura'
  else if (vigente)                          segmento = 'probando'
  else                                       segmento = 'vencido'

  const precio = pagaAhora ? (susc.montoCOP ?? 0) : 0

  return {
    id:        org.id,
    nombre:    org.nombre,
    plan:      org.plan,
    country:   org.country ?? 'co',
    createdAt: org.createdAt,
    segmento,
    precio,
    clientes,
    prestamos,
    diasDesdeRegistro,
    diasSinActividad,
    ultimaActividad,
    fechaVencimiento: susc?.fechaVencimiento ?? null,
    diasRestantes: susc
      ? Math.ceil((new Date(susc.fechaVencimiento) - ahora) / DIA)
      : null,
    ownerId:       owner.id ?? null,
    ownerNombre:   owner.nombre ?? '',
    ownerEmail:    owner.email ?? '',
    // ⚠ El teléfono vive en DOS sitios y ninguna pantalla miraba los dos. Son 62
    //   los que no lo tienen en ninguno; leyendo ambos se recuperan 2.
    ownerTelefono: owner.telefono || org.telefono || '',
    nuncaEntro:    !owner.lastLoginAt,
  }
}

/**
 * Clasifica la lista entera y saca las cifras de cabecera.
 *
 * ⚠ El MRR sale de sumar lo que cada uno paga DE VERDAD. La pantalla vieja
 *   multiplicaba «organizaciones activas × precio de su plan», y como `activo`
 *   lo tienen las 485 sin excepción, cobraba por gente que no ha pagado un peso:
 *   $23.038.000 donde había $2.531.800.
 */
export function segmentarOrganizaciones(orgs = [], ahora = new Date()) {
  const fichas = orgs.map((o) => segmentarOrganizacion(o, ahora))

  const porSegmento = {}
  for (const s of SEGMENTOS) porSegmento[s.id] = 0
  let mrr = 0
  for (const f of fichas) {
    porSegmento[f.segmento] = (porSegmento[f.segmento] ?? 0) + 1
    mrr += f.precio
  }

  return {
    fichas,
    mrr,
    porSegmento,
    // La basura queda fuera: es lo que inflaba todo.
    totalReal: fichas.filter((f) => SEGMENTOS_REALES.includes(f.segmento)).length,
  }
}

/** El `select` de Prisma que este módulo necesita. Que no se desvíen. */
export const SELECT_ORG_SEGMENTO = {
  id: true,
  nombre: true,
  plan: true,
  country: true,
  telefono: true,
  createdAt: true,
  users: {
    where: { rol: 'owner' },
    select: { id: true, nombre: true, email: true, telefono: true, lastLoginAt: true, lastActivityAt: true },
    take: 1,
  },
  suscripciones: {
    where: { OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
    orderBy: { fechaVencimiento: 'desc' },
    select: { id: true, estado: true, montoCOP: true, plan: true, fechaInicio: true, fechaVencimiento: true, createdAt: true },
  },
  _count: { select: { clientes: true, prestamos: true } },
}
