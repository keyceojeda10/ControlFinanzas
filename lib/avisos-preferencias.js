// lib/avisos-preferencias.js — qué avisos existen y cuáles quiere cada quien.
//
// Puro (sin Prisma ni `window`): lo importan el servidor (`lib/notificar.js`, los
// crons) y la pantalla de Configuración. Así la lista de grupos que el usuario ve
// y la que el servidor obedece son LA MISMA, y no dos que se van separando.
//
// ── POR QUÉ GRUPOS Y NO UN INTERRUPTOR POR TIPO ──────────────────────────────
// Hay una veintena de tipos de aviso y crecen. Veinte interruptores no los
// configura nadie. Los grupos son las PREGUNTAS que el dueño se hace —«¿me
// avisas cuando alguien se atrasa?», «¿cuando cierran caja?»— y cada tipo nuevo
// cae en uno sin tocar la pantalla.
//
// Medido el 19 sep 2026: 3.368 avisos de mora en 30 días, 174 leídos (5 %). Un
// solo interruptor global —y escondido bajo «Avisos por WhatsApp»— obligaba a
// elegir entre todo el ruido o ningún aviso.

/** Hora local a la que sale el resumen si el usuario no ha elegido otra.
 *  Las 9 de la noche: lo dijo el dueño al pedir el pop-up («tipo en la noche, 9,
 *  10»). A las 7 mucha gente sigue cobrando, y un resumen del día a medias no
 *  resume nada. Vale para la notificación y para el pop-up: es UNA hora. */
export const RESUMEN_HORA_POR_DEFECTO = 21

export const HORAS_RESUMEN = [17, 18, 19, 20, 21, 22]

/**
 * Los grupos, en el orden en que se enseñan.
 *   `roles`   quién lo ve en Configuración (y a quién le puede llegar).
 *   `fijo`    no se puede apagar: sin él se pierde plata o el acceso.
 *   `soloPush` no deja fila en la campana (ya vive en otra pantalla).
 */
export const GRUPOS = [
  {
    id: 'aprobaciones', roles: ['owner', 'cobrador'],
    titulo: { owner: 'Lo que espera tu decisión', cobrador: 'Respuestas a lo que pides' },
    nota: {
      owner: 'Préstamos por aprobar, reaperturas de caja y gastos de tus cobradores.',
      cobrador: 'Cuando te aprueban o rechazan un préstamo o la reapertura de tu caja.',
    },
  },
  {
    id: 'caja', roles: ['owner', 'cobrador'],
    titulo: { owner: 'Cierres de caja', cobrador: 'Tu caja' },
    nota: {
      owner: 'Cuando un cobrador cierra su caja, y cuánto entrega.',
      cobrador: 'El recordatorio de cerrar tu caja al terminar el día.',
    },
  },
  {
    id: 'mora', roles: ['owner', 'cobrador'],
    titulo: { owner: 'Clientes que se atrasan', cobrador: 'Clientes de tu ruta que se atrasan' },
    nota: {
      owner: 'Un aviso el día que un cliente deja de pagar.',
      cobrador: 'Un aviso el día que un cliente tuyo deja de pagar.',
    },
  },
  {
    id: 'cartera', roles: ['owner'],
    titulo: { owner: 'Buenas noticias de la cartera' },
    nota: { owner: 'Préstamos que terminan de pagarse, clientes que se ponen al día y los que ya se pueden renovar.' },
  },
  {
    id: 'equipo', roles: ['owner', 'cobrador'],
    titulo: { owner: 'Lo que hace tu equipo', cobrador: 'Cambios en tu ruta' },
    nota: {
      owner: 'Clientes nuevos que cargan tus cobradores.',
      cobrador: 'Cuando te pasan un cliente o un préstamo de otra ruta.',
    },
  },
  {
    id: 'pagos', roles: ['owner'], soloPush: true,
    titulo: { owner: 'Cada pago que registra un cobrador' },
    nota: { owner: 'Un aviso en el teléfono por cada cobro. No se guarda en la campana: eso ya está en el Historial.' },
  },
  {
    id: 'logros', roles: ['owner'],
    titulo: { owner: 'Logros del negocio' },
    nota: { owner: 'Un buen día de recaudo, una racha sin mora nueva, un cierre perfecto.' },
  },
  {
    id: 'cuenta', roles: ['owner'], fijo: true,
    titulo: { owner: 'Tu plan' },
    nota: { owner: 'Cuando tu plan está por vencer o falla un cobro. Siempre encendido: sin plan no se puede cobrar.' },
  },
]

/** A qué grupo pertenece cada tipo de aviso. Lo que no esté aquí va a `equipo`. */
export const GRUPO_DE = {
  solicitud_prestamo: 'aprobaciones',
  solicitud_reapertura: 'aprobaciones',
  gasto_por_aprobar: 'aprobaciones',
  prestamo_aprobado: 'aprobaciones',
  prestamo_rechazado: 'aprobaciones',
  reapertura_aprobada: 'aprobaciones',
  reapertura_rechazada: 'aprobaciones',

  cierre_caja: 'caja',
  cierre_descuadrado: 'caja',
  caja_reabierta: 'caja',
  cierre_recordatorio: 'caja',

  mora: 'mora',

  prestamo_saldado: 'cartera',
  cliente_al_dia: 'cartera',
  listo_renovar: 'cartera',

  cliente_creado_por_cobrador: 'equipo',
  prestamo_trasladado: 'equipo',

  pago: 'pagos',
  celebracion: 'logros',
  suscripcion: 'cuenta',
  resumen_dia: 'resumen',
}

export function grupoDe(tipo) {
  return GRUPO_DE[tipo] ?? 'equipo'
}

/**
 * Lo guardado → algo con forma. Tolera `null`, una cadena JSON (MariaDB guarda
 * el JSON como texto y según el camino llega sin parsear) y basura.
 * Por defecto TODO encendido y el resumen a las 19:00.
 */
export function normalizarPrefs(crudo) {
  let p = crudo
  if (typeof p === 'string') { try { p = JSON.parse(p) } catch { p = null } }
  if (!p || typeof p !== 'object') p = {}
  const grupos = {}
  for (const g of GRUPOS) grupos[g.id] = g.fijo ? true : p.grupos?.[g.id] !== false
  const h = p.resumenHora
  const resumenHora = h === null ? null
    : (Number.isInteger(h) && h >= 0 && h <= 23) ? h
    : RESUMEN_HORA_POR_DEFECTO
  return { grupos, resumenHora }
}

/** ¿Este usuario quiere avisos de este tipo? */
export function quiere(prefsCrudas, tipo) {
  const prefs = normalizarPrefs(prefsCrudas)
  const g = grupoDe(tipo)
  if (g === 'resumen') return prefs.resumenHora !== null
  return prefs.grupos[g] !== false
}

/** ¿El tipo se guarda en la campana, o solo suena? */
export function seGuarda(tipo) {
  const g = GRUPOS.find((x) => x.id === grupoDe(tipo))
  return !g?.soloPush
}

/** Lo que manda la pantalla → lo que se guarda. Descarta lo que no se conoce. */
export function limpiarPrefs(entrada) {
  const grupos = {}
  for (const g of GRUPOS) {
    if (g.fijo) continue
    if (entrada?.grupos && g.id in entrada.grupos) grupos[g.id] = entrada.grupos[g.id] !== false
  }
  const h = entrada?.resumenHora
  const resumenHora = h === null ? null
    : (Number.isInteger(h) && h >= 0 && h <= 23) ? h
    : RESUMEN_HORA_POR_DEFECTO
  return { grupos, resumenHora }
}
