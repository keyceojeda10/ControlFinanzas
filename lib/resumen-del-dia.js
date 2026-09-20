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
  const c = d?.cobros ?? {}, p = d?.prestamos ?? {}, a = d?.actividadHoy ?? {}
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
  }
}
