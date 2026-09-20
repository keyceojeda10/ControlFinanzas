// lib/resumen-del-dia.js — lo que dice «Tu resumen del día», y cuándo sale.
//
// Puro (sin React ni Prisma): arma la pantalla a partir de la MISMA respuesta que
// pinta el Inicio (`/api/dashboard/resumen`). No calcula plata: la ordena y la
// explica. Un resumen que dijera otra cifra que el Inicio sería peor que no
// tenerlo — por eso no tiene API propio.
//
// El dueño, 20 sep 2026: «un pop-up grande que se abra a cierta hora que diga tu
// resumen del día y lo resuma bien bonito, detallado, con gráficos modernos, el
// texto súper entendible… que la persona decida verlo o que le ponga si no ha
// terminado la jornada… conceptos entendibles, el dinero bien sacado».

export const POSPONER_MS = 60 * 60 * 1000          // «todavía no termino»: vuelve en una hora
export const CLAVE_VISTO = 'cf-resumen-dia-visto'     // fecha (YYYY-MM-DD) del último resumen visto
export const CLAVE_POSPUESTO = 'cf-resumen-dia-luego' // hasta cuándo no insistir (ms)

/** «2026-09-20» en la hora del teléfono, que es la del usuario. */
export function fechaLocal(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`
}

/**
 * ¿Toca ofrecer el resumen AHORA?
 *   · la hora elegida ya pasó (null = lo apagó),
 *   · el de hoy no se ha visto,
 *   · y no está pospuesto.
 * Se ofrece también si la app se abre DESPUÉS de la hora: quien entra a las 10
 * tiene su resumen de las 9 esperándolo. Pasada la medianoche ya es otro día.
 */
export function tocaOfrecerlo({ hora, ahora = new Date(), visto = null, pospuestoHasta = 0 } = {}) {
  if (hora === null || hora === undefined) return false
  if (ahora.getHours() < hora) return false
  if (visto === fechaLocal(ahora)) return false
  if (Number(pospuestoHasta) > ahora.getTime()) return false
  return true
}

const pct = (parte, todo) => (todo > 0 ? Math.max(0, Math.min(100, Math.round((parte / todo) * 100))) : null)

/**
 * La pantalla, lista para pintar. `d` es la respuesta de `/api/dashboard/resumen`.
 * Todas las cifras van CRUDAS (números); quien pinta les da formato.
 */
export function armarResumen(d, { nombre = '' } = {}) {
  const c = d?.cobros ?? {}, p = d?.prestamos ?? {}, a = d?.actividadHoy ?? {}, det = d?.detalleDia ?? {}
  const cobrado = Math.round(c.hoy ?? 0)
  const tocaba = Math.round(p.esperadoHoy ?? 0)
  const clientesHoy = Number(p.clientesConCobroHoy ?? 0)
  const clientesCobrados = Number(p.clientesCobradosHoy ?? 0)
  const prestado = Math.round(a.prestamos?.monto ?? 0)
  const gastos = Math.round(a.gastos?.monto ?? 0)
  const ayer = Math.round(c.ayer ?? 0)
  const semana = Array.isArray(c.sparkline7d) ? c.sparkline7d.map((n) => Math.round(n || 0)) : []
  const avance = pct(cobrado, tocaba)

  // Una frase, no un número: lo primero que se lee.
  const titular = cobrado === 0 && prestado === 0 ? 'Hoy no se movió plata'
    : tocaba === 0 ? 'Hoy no tocaba cobrarle a nadie'
    : avance >= 100 ? 'Cobraste todo lo que tocaba'
    : avance >= 70 ? 'Buen día de cobro'
    : avance >= 40 ? 'Un día a medias'
    : 'Hoy se cobró poco'

  return {
    nombre: String(nombre || '').trim().split(/\s+/)[0] || '',
    titular,
    cobrado, tocaba, avance,
    faltoPorCobrar: Math.max(0, tocaba - cobrado),
    cobros: Number(c.cantidadHoy ?? 0),
    clientesHoy, clientesCobrados,
    clientesSinCobrar: Math.max(0, clientesHoy - clientesCobrados),
    // De lo cobrado, cuánto es ganancia y cuánto es plata tuya que vuelve.
    // `null` cuando el servidor no lo manda (a un cobrador no se le enseña la
    // ganancia del negocio): entonces el reparto no se pinta, no se pone en cero.
    interes: c.interesGanadoHoy == null ? null : Math.round(c.interesGanadoHoy),
    capitalDeVuelta: c.capitalRecuperadoHoy == null ? null : Math.round(c.capitalRecuperadoHoy),
    // Lo que salió.
    prestado, prestamos: Number(a.prestamos?.cantidad ?? 0),
    gastos, gastosCuantos: Number(a.gastos?.cantidad ?? 0),
    retiros: Math.round(a.retiros?.monto ?? 0),
    inyecciones: Math.round(a.inyecciones?.monto ?? 0),
    // Lo que entró menos lo que salió HOY, en plata que se movió. No es ganancia.
    movimientoNeto: cobrado - prestado - gastos,
    // Contra ayer.
    ayer, vsAyer: ayer > 0 ? Math.round(((cobrado - ayer) / ayer) * 100) : null,
    semana,                                   // 7 días, hoy el último
    mejorDeLaSemana: semana.length > 0 && cobrado > 0 && cobrado >= Math.max(...semana),
    // Quién cobró (solo si hay equipo: uno solo no es un ranking).
    cobradores: (a.desgloseCobradores ?? []).map((x) => ({ nombre: x.nombre, monto: Math.round(x.monto ?? 0), pagos: Number(x.pagos ?? 0) })),
    // Cómo queda la cartera.
    enMora: Number(d?.clientes?.enMora ?? 0),
    enCaja: d?.finanzas?.cajaDisponible ?? null,
    enLaCalle: p.capitalEnCalle == null ? null : Math.round(p.capitalEnCalle),
    porCobrar: p.saldoPorCobrar == null ? null : Math.round(p.saldoPorCobrar),

    /* ── LO QUE SE PUEDE PREGUNTAR (viene con `?detalle=1`) ──
       El dueño, 20 sep 2026: «uno le da a una barrita y no le dice cuánto cobró…
       que sea más interactivo, que dé los datos que se necesitan sin sobrecargar
       la pantalla». Son las LISTAS detrás de cada cifra; salen del mismo bucle
       del servidor que las cifras, así que no pueden contradecirlas. */
    pagos: det.pagos ?? [],
    sinCobrar: det.sinCobrar ?? [],
    medios: det.medios ?? null,
    gastosLista: det.gastos ?? [],
    prestamosLista: (a.prestamos?.lista ?? []).map((x) => ({ id: x.id, cliente: x.cliente, monto: Math.round(x.monto ?? 0) })),
    // Día a día, con su cuenta de cobros. Sin detalle, solo el monto.
    dias: (det.semana ?? semana.map((monto) => ({ fecha: null, monto, cobros: null }))),
    promedioSemana: semana.length ? Math.round(semana.reduce((x, y) => x + y, 0) / semana.length) : 0,
    manana: det.manana ?? null,
    // El mes. Ganancia = interés cobrado − gastos. NUNCA recaudado − gastos.
    mes: {
      cobrado: Math.round(c.mes ?? 0), cobros: Number(c.cantidadMes ?? 0),
      interes: c.interesGanadoMes == null ? null : Math.round(c.interesGanadoMes),
      gastos: d?.finanzas?.gastosMes == null ? null : Math.round(d.finanzas.gastosMes),
      ganancia: (c.interesGanadoMes == null || d?.finanzas?.gastosMes == null) ? null
        : Math.round(c.interesGanadoMes - d.finanzas.gastosMes),
    },
  }
}

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «martes 15» a partir de '2026-09-15'. Un 'YYYY-MM-DD' es un día del
 *  calendario, no un instante: se parte a mano para que no se corra de día. */
export function nombreDelDia(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''))
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return { dia: DIAS_LARGOS[d.getUTCDay()], corto: DIAS_LARGOS[d.getUTCDay()].slice(0, 3), numero: Number(m[3]), mes: MESES[d.getUTCMonth()] }
}

/**
 * El resumen en TEXTO, para mandarlo por WhatsApp a un socio o guardárselo.
 * Solo lo que ya está en pantalla, sin nombres de clientes: es plata del negocio,
 * no la lista de quién debe.
 */
export function textoParaCompartir(r, formatear, fecha = '') {
  const l = [`*Resumen del día*${fecha ? ` · ${fecha}` : ''}`, '']
  l.push(`Entraron: *${formatear(r.cobrado)}* en ${r.cobros} ${r.cobros === 1 ? 'cobro' : 'cobros'}`)
  if (r.tocaba > 0) l.push(`Tocaba cobrar ${formatear(r.tocaba)} → se cobró el ${r.avance}%`)
  if (r.interes != null && r.cobrado > 0) l.push(`Ganancia de hoy: *${formatear(r.interes)}* · capital que volvió: ${formatear(r.capitalDeVuelta)}`)
  if (r.prestado > 0) l.push(`Se prestó: ${formatear(r.prestado)} (${r.prestamos})`)
  if (r.gastos > 0) l.push(`Gastos: ${formatear(r.gastos)}`)
  if (r.clientesSinCobrar > 0) l.push(`Quedaron sin cobrar: ${r.clientesSinCobrar} ${r.clientesSinCobrar === 1 ? 'cliente' : 'clientes'}`)
  if (r.manana) l.push('', r.manana.monto > 0 ? `Mañana toca cobrar ${formatear(r.manana.monto)} a ${r.manana.clientes} ${r.manana.clientes === 1 ? 'cliente' : 'clientes'}` : 'Mañana no toca cobrarle a nadie')
  if (r.enCaja != null) l.push(`En caja: ${formatear(r.enCaja)}`)
  return l.join('\n')
}
