/* ── LOS NEGOCIOS SERIOS: QUIÉN VALE UNA LLAMADA (2 nov 2026) ─────────────────
 *
 * El dueño: «me llega un montón de cosas al Telegram que hasta las ignoro
 * porque es pura basura… que sean personas realmente serias que no me hagan
 * perder el tiempo». Esto decide quién es serio con lo que HIZO en la app, no
 * con lo que dijo en el bot.
 *
 * Las reglas salen de medir los 673 registros del 1 jun al 14 oct 2026 (pagó el
 * 9 %), mirando sus primeros 5 días:
 *
 *   10+ préstamos y entró 3+ días distintos       49 negocios · pagó el 63 %
 *   cobró en 3+ días distintos                    36 negocios · pagó el 67 %
 *   5+ préstamos y cobró en 2+ días distintos     57 negocios · pagó el 54 %
 *   ── tibio ──
 *   entró a la app 3+ días distintos              95 negocios · pagó el 47 %
 *   5+ clientes                                  110 negocios · pagó el 40 %
 *   ── el resto ──
 *   creó al menos un cliente                     380 negocios · pagó el 14 %
 *
 * El % que se enseña al lado de cada uno es ese, dicho «de cada 10 así, pagan N»:
 * nada de «cliente caliente» sin número. Si se vuelve a medir, se cambian aquí
 * las cifras y las pruebas.
 */

/* ⚠ CORREGIDO EL 2 NOV (tarde): las cifras de arriba son de cada regla SOLA.
 * Medido bien, sin solaparse:
 *   caliente (cobró en 3+ días, o 5+ préstamos y entró 3+ días, o 5+
 *   préstamos y cobró en 2+ días) → 79 negocios · pagó el 52 %, y atrapa el
 *   68 % de todos los que pagaron.
 *   todo lo demás que creó algún cliente → 301 negocios · pagó el 4 %.
 * El «tibio» que hubo en la primera versión pagaba el 13 %: casi ruido, y el
 * dueño pidió «personas realmente serias». Se quitó. */
export const PROBABILIDAD = { caliente: 5 }

/** Caliente o nada, con la razón dicha con sus números. */
export function nivelDe({ prestamos = 0, diasCobro = 0, diasEntra = 0 }) {
  if (diasCobro >= 3) return { nivel: 'caliente', razon: `cobró en ${diasCobro} días distintos` }
  if (prestamos >= 5 && diasCobro >= 2) return { nivel: 'caliente', razon: `${prestamos} préstamos y cobró en ${diasCobro} días` }
  if (prestamos >= 5 && diasEntra >= 3) return { nivel: 'caliente', razon: `${prestamos} préstamos y entró ${diasEntra} días` }
  return { nivel: null, razon: null }
}

/**
 * En qué momento está, que decide qué decirle. En orden de urgencia:
 *   quiere_pagar → le preguntó al bot cómo pagar (en los últimos 10 días)
 *   espera       → nos mandó su cartera para cargar y no está terminada
 *   decidir      → la prueba vence en 2 días o menos (o venció hace poco)
 *   enfrio       → lleva 2+ días sin entrar
 *   cobrando     → ya cobra en la calle con la app
 *   arranco      → cargó, todavía no cobra
 */
export function momentoDe({ quierePagar = false, cargaPendiente = false, diasParaVencer = null, diasSinEntrar = 0, diasCobro = 0 }) {
  if (quierePagar) return 'quiere_pagar'
  if (cargaPendiente) return 'espera'
  if (diasParaVencer != null && diasParaVencer <= 2 && diasParaVencer >= -3) return 'decidir'
  if (diasSinEntrar >= 2) return 'enfrio'
  if (diasCobro >= 1) return 'cobrando'
  return 'arranco'
}

export const TITULO_MOMENTO = {
  quiere_pagar: 'Preguntó cómo pagar',
  espera: 'Nos está esperando',
  decidir: 'Le toca decidir',
  enfrio: 'Se enfrió',
  cobrando: 'Ya está cobrando',
  arranco: 'Arrancó',
}

const primerNombre = (n) => {
  const p = String(n ?? '').trim().split(/\s+/)[0] ?? ''
  // Muchos ponen el negocio como nombre: «Hola Tienda» o «Hola Inversiones» suena a robot.
  if (!p || /\d/.test(p) || /^(club|store|tienda|centro|distri|inversiones?|pr[eé]stamos?|cr[eé]ditos?|cobros?|negocio|multiservicios|variedades|el|la|los|las)$/i.test(p)) return ''
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}
const fechaCorta = (d) => new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

/**
 * El mensaje ya escrito para esa persona, según su momento. Lo manda el que
 * atiende, desde su WhatsApp, y lo puede cambiar antes: es un borrador.
 * `quien` = quién firma («Carlos»).
 */
export function mensajePara({ momento, nombre, prestamos = 0, diasCobro = 0, vence = null, quien = 'Carlos' }) {
  const n = primerNombre(nombre)
  const hola = `Hola${n ? ` ${n}` : ''}, soy ${quien} de Control Finanzas.`
  switch (momento) {
    case 'quiere_pagar':
      return `${hola} Vi que preguntaste cómo pagar la mensualidad. Es muy fácil: entra a https://app.control-finanzas.com/configuracion/plan y pagas con Nequi o tarjeta. Si quieres, te acompaño por aquí paso a paso.`
    case 'espera':
      return `${hola} Te escribo por la cartera que nos mandaste para cargar en la app. Quiero dejártela lista hoy: ¿seguimos con eso o te falta mandarnos algo?`
    case 'decidir':
      return `${hola} Tu prueba ${vence && new Date(vence) > new Date() ? `vence el ${fechaCorta(vence)}` : 'acaba de vencer'}. Con ${prestamos > 0 ? `los ${prestamos} préstamos que ya tienes cargados` : 'lo que ya tienes cargado'} sería una pena empezar de cero. ¿Te ayudo a activar el plan o tienes alguna duda?`
    case 'enfrio':
      return `${hola} Vi que no has vuelto a entrar a la app. ¿Pasó algo o te trabaste en algún paso? Dime y lo resolvemos.`
    case 'cobrando':
      return `${hola} Ya llevas ${diasCobro} ${diasCobro === 1 ? 'día' : 'días'} cobrando con la app, ¡vas muy bien! ¿Cómo te ha ido en la calle? Si algo no te cuadra, dímelo y lo arreglamos.`
    default:
      return `${hola} Vi que ya cargaste ${prestamos > 0 ? `${prestamos} préstamos` : 'tus primeros clientes'}, ¡vas muy bien! ¿Te ayudo a pasar el resto del cuaderno o con algo para salir a cobrar?`
  }
}

const ORDEN_MOMENTO = { quiere_pagar: 0, espera: 1, decidir: 2, enfrio: 3, cobrando: 4, arranco: 5 }

/** La lista del día: los calientes y los que pidieron algo, primero lo más urgente. */
export function ordenarParaAtender(filas) {
  return filas
    .filter((f) => f.nivel || f.momento === 'quiere_pagar' || f.momento === 'espera')
    // Una «prueba» de más de 30 días por delante es una cuenta de cortesía o
    // de demostración (la de los videos), no alguien decidiendo si paga.
    .filter((f) => f.diasParaVencer == null || f.diasParaVencer <= 30)
    .sort((a, b) =>
      (ORDEN_MOMENTO[a.momento] - ORDEN_MOMENTO[b.momento])
      || (b.prestamos - a.prestamos))
}

/* Pendiente: sin atender, o atendido hace más de 2 días sin respuesta final.
   «Pagó» y «No le interesa» cierran el caso. La misma regla que la página. */
export function pendientes(filas, ahora = new Date()) {
  return filas.filter((f) => {
    const a = f.atencion
    if (a && (a.resultado === 'pago' || a.resultado === 'no_interesa')) return false
    return !a || ahora.getTime() - new Date(a.cuando).getTime() > 2 * 86400000
  })
}
