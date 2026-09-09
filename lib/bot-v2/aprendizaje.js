// lib/bot-v2/aprendizaje.js — QUÉ ESTÁ FALLANDO DE VERDAD (BOT v3 · sprint 8).
//
// ══ POR QUÉ ══════════════════════════════════════════════════════════════════
//
// La autocrítica (`lib/bot/autocritica.js`) le pregunta a un modelo qué hizo
// mal el bot, y el modelo contesta lo que le parece. Lleva desde julio dejando
// lecciones en estado «pendiente» que nadie puede comprobar: si dice «el bot no
// dio el siguiente paso», no había manera de saber en cuántos mensajes pasó.
//
// Desde el sprint 1 cada mensaje guarda su traza, y desde el 7 el validador
// escribe POR QUÉ tuvo que corregir. Eso es un dato, no una opinión. Aquí se
// resume y se usa para dos cosas:
//
//   1. Decir qué falla y cuánto, por etapa y por plantilla de prompt.
//   2. Contrastar cada lección del modelo con la traza. Una lección respaldada
//      por 14 mensajes es un problema; una que no aparece en ningún mensaje es
//      una impresión, y se marca como tal en vez de acabar en el prompt.
//
// Todo es puro: recibe filas ya leídas y devuelve objetos. Sin Prisma.

/** Motivos del validador que respaldan cada tipo de lección, por palabras. */
const RESPALDOS = [
  { rx: /siguiente paso|quedo atent|conversacion muerta|conversación muerta|sin accion|sin acción|no cerr/i, motivos: ['sin_siguiente_paso'] },
  { rx: /repit|repetit|mismo mensaje|ya lo habia dicho|ya lo había dicho|insist/i, motivos: ['calco_largo', 'argumento_repetido', 'pregunta_repetida'] },
  { rx: /precio|costo|tarifa|valor del plan|cifra/i, motivos: ['precio_falso'] },
  { rx: /link|enlace|registro/i, motivos: ['link_no_permitido'] },
  { rx: /procedimiento|paso a paso|explic[oó] c[oó]mo se hace|caja|ajuste/i, motivos: ['procedimiento'] },
  { rx: /tute|de t[uú]|trato/i, motivos: ['tuteo'] },
  { rx: /despid|se fue|cerr[oó] la puerta|dudas/i, motivos: ['despedida_con_dudas'] },
  { rx: /invent|no existe|funcion que no|función que no|alucin/i, motivos: ['funcion_inexistente'] },
  { rx: /autom[aá]tic|d[eé]bito|cobro recurrente/i, motivos: ['cobro_automatico'] },
  { rx: /largo|extenso|parrafo|párrafo/i, motivos: ['demasiado_largo'] },
]

const percentil = (xs, p) => {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.floor(o.length * p))]
}

/**
 * @param {Array} filas  mensajes del bot con { etapa, clasificacion, proveedor,
 *   promptId, violaciones, segundaPasada, latenciaMs }
 */
export function resumirTraza(filas = []) {
  const conTraza = filas.filter((f) => f && f.proveedor)
  const delModelo = conTraza.filter((f) => f.proveedor === 'claude' || f.proveedor === 'deepseek')
  const cuenta = (lista, campo) => {
    const m = new Map()
    for (const f of lista) { const k = f[campo] || '(sin dato)'; m.set(k, (m.get(k) || 0) + 1) }
    return [...m].sort((a, b) => b[1] - a[1])
  }
  const motivos = new Map()
  const motivosPorEtapa = new Map()
  for (const f of delModelo) {
    for (const v of String(f.violaciones || '').split(',').filter(Boolean)) {
      motivos.set(v, (motivos.get(v) || 0) + 1)
      const k = `${f.etapa || '?'}·${v}`
      motivosPorEtapa.set(k, (motivosPorEtapa.get(k) || 0) + 1)
    }
  }
  const lat = delModelo.map((f) => Number(f.latenciaMs)).filter((n) => n > 0)
  const regen = delModelo.filter((f) => f.segundaPasada).length
  return {
    turnos: conTraza.length,
    delModelo: delModelo.length,
    porEtapa: cuenta(delModelo, 'etapa'),
    porProveedor: cuenta(conTraza, 'proveedor'),
    motivos: [...motivos].sort((a, b) => b[1] - a[1]),
    motivosPorEtapa: [...motivosPorEtapa].sort((a, b) => b[1] - a[1]).slice(0, 8),
    regeneraciones: regen,
    tasaRegeneracion: delModelo.length ? +(regen / delModelo.length * 100).toFixed(1) : 0,
    latencia: { p50: percentil(lat, 0.5), p95: percentil(lat, 0.95) },
    /* Una plantilla de prompt con muchas violaciones es la que hay que tocar:
       el `promptId` solo cambia si se edita la plantilla, así que se puede
       comparar antes y después de un cambio. */
    promptsConMasFallos: cuenta(delModelo.filter((f) => f.violaciones), 'promptId').slice(0, 5),
  }
}

/** Cada lección del modelo, con el respaldo que la traza le da (o ninguno). */
export function contrastarLecciones(lecciones = [], resumen = null) {
  const cuentaDe = new Map(resumen?.motivos || [])
  return lecciones.map((l) => {
    const texto = `${l.tipo || ''} ${l.leccion || ''} ${l.accion || ''}`
    const motivos = RESPALDOS.filter((r) => r.rx.test(texto)).flatMap((r) => r.motivos)
    const casos = motivos.reduce((n, m) => n + (cuentaDe.get(m) || 0), 0)
    return { ...l, respaldo: { motivos: [...new Set(motivos)], casos, verificada: casos > 0 } }
  })
}

/** El bloque de texto que se manda por Telegram. Sin emojis ni markdown raro. */
export function textoAprendizaje(resumen, leccionesContrastadas = []) {
  if (!resumen || !resumen.delModelo) return 'Sin mensajes del modelo en el periodo.'
  const l = []
  l.push(`<b>Lo que dice la traza</b> (${resumen.delModelo} mensajes del modelo)`)
  l.push(`Etapas: ${resumen.porEtapa.slice(0, 5).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  l.push(`Se corrigieron ${resumen.regeneraciones} (${resumen.tasaRegeneracion} %). Latencia ${resumen.latencia.p50 || '?'} ms, p95 ${resumen.latencia.p95 || '?'} ms.`)
  if (resumen.motivos.length) l.push(`Motivos: ${resumen.motivos.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  if (resumen.motivosPorEtapa.length) l.push(`Dónde: ${resumen.motivosPorEtapa.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  const sinRespaldo = leccionesContrastadas.filter((x) => !x.respaldo?.verificada).length
  if (leccionesContrastadas.length) {
    l.push(`De las ${leccionesContrastadas.length} lecciones de hoy, ${leccionesContrastadas.length - sinRespaldo} aparecen en la traza y ${sinRespaldo} no: esas son impresiones del modelo, no cuentas.`)
  }
  return l.join('\n')
}

/* ══ EL A/B DEL v3, QUE ES LO QUE HAY QUE VIGILAR AHORA ═════════════════════
 *
 * `BOT_INTENCION=ab` reparte los leads entre el clasificador semántico y el
 * árbol de regex. El KPI es registros por lead, no respuestas: un bot que da
 * conversación y no registra a nadie no sirve.
 *
 * Vive aquí, y no en un informe aparte, porque el informe diario del bot lleva
 * meses escrito sin que nadie lo llame (no estaba en el crontab) y su bloque de
 * A/B era el de julio, el de los hooks. Este dato llega en el mensaje de la
 * autocrítica, que sí corre todas las noches.
 *
 * @param {Array} leads  { id, estado, createdAt } desde que empezó el reparto
 * @param {(id:string)=>string} varianteDe  el mismo reparto que usa el bot
 */
export function resumirAB(leads = [], varianteDe) {
  const por = { semantica: { total: 0, respondieron: 0, registrados: 0 }, regex: { total: 0, respondieron: 0, registrados: 0 } }
  for (const l of leads) {
    const v = varianteDe(l.id)
    const g = por[v]
    if (!g) continue
    g.total++
    if (['interesado', 'cerrado', 'registrado', 'no_interesado'].includes(l.estado)) g.respondieron++
    if (['cerrado', 'registrado'].includes(l.estado)) g.registrados++
  }
  for (const g of Object.values(por)) {
    g.tasaResp = g.total ? +(g.respondieron / g.total * 100).toFixed(1) : 0
    g.tasaReg = g.total ? +(g.registrados / g.total * 100).toFixed(1) : 0
  }
  return { ...por, dias: diasEntre(leads.map((l) => l.createdAt)) }
}

/* ══ CUÁNDO UN A/B YA DICE ALGO, Y CUÁNDO LO DIRÁ ══════════════════════════
 *
 * Dos trampas, y las dos las conoce ya este proyecto:
 *
 *  1. **Cantar un ganador por ruido.** Llegar al mínimo no basta: con 40 por
 *     rama y tasas cerca del 20 %, el error típico de la diferencia ronda los
 *     9 puntos, así que una ventaja de 3 no significa nada. Se exige además
 *     que la diferencia supere 1,96 errores típicos — el 95 % de siempre.
 *  2. **Dejarlo corriendo para siempre porque nadie mira.** Mientras no hay
 *     muestra, la línea dice EN QUÉ FECHA la habrá al ritmo real. El dueño lo
 *     preguntó el 9 sep: «¿cuándo hacemos esto? prográmalo para que no se nos
 *     olvide». La respuesta llega sola, cada noche, en la autocrítica.
 */
/** Cuántos días separan la fecha más vieja de la más nueva; mínimo uno. */
export function diasEntre(fechas = []) {
  const t = fechas.map((f) => (f ? new Date(f).getTime() : NaN)).filter((x) => Number.isFinite(x))
  if (t.length < 2) return t.length ? 1 : null
  return Math.max(1, (Math.max(...t) - Math.min(...t)) / 86400000)
}

export function diferenciaClara(a, b) {
  if (!a?.total || !b?.total) return false
  const pa = a.registrados / a.total
  const pb = b.registrados / b.total
  const se = Math.sqrt((pa * (1 - pa)) / a.total + (pb * (1 - pb)) / b.total)
  return se > 0 && Math.abs(pa - pb) / se >= 1.96
}

/** «faltan 62 · al ritmo de 4,5 al día, sobre el 26 de septiembre». */
export function cuandoHabraMuestra(faltan, porDia) {
  if (!(faltan > 0)) return ''
  if (!(porDia > 0)) return ` Faltan ${faltan} y todavía no hay ritmo para estimar cuándo.`
  const dias = Math.ceil(faltan / porDia)
  const f = new Date(Date.now() + dias * 86400000)
  const cuando = f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
  return ` Faltan ${faltan}; al ritmo de ${porDia.toFixed(1)} al día, sobre el ${cuando}.`
}

/** El ritmo diario a partir de un total y los días que lleva corriendo. */
export const porDia = (total, dias) => (dias > 0 ? total / dias : 0)

/** Una línea honesta: con poco volumen lo dice en vez de fingir un ganador. */
export function textoAB(ab, { minimoPorRama = 30 } = {}) {
  const { semantica: s, regex: r, dias = null } = ab
  if (!s.total && !r.total) return null
  const linea = `A/B intención · semántica ${s.registrados}/${s.total} (${s.tasaReg} %) · regex ${r.registrados}/${r.total} (${r.tasaReg} %)`
  const faltan = Math.max(minimoPorRama - s.total, minimoPorRama - r.total)
  if (faltan > 0) {
    return `${linea}\nTodavía no dice nada.${cuandoHabraMuestra(faltan, porDia(s.total + r.total, dias) / 2)}`
  }
  if (!diferenciaClara(
    { total: s.total, registrados: s.registrados },
    { total: r.total, registrados: r.registrados })) {
    const va = s.tasaReg > r.tasaReg ? 'la semántica' : 'el regex'
    return `${linea}\nHay muestra, pero la diferencia cabe en el azar: va por delante ${va} y no es para decidir. Se deja correr.`
  }
  const gana = s.tasaReg > r.tasaReg ? 'la semántica' : 'el regex'
  return `${linea}\nDECISIÓN LISTA: gana ${gana}, y la diferencia es clara. Se fija con BOT_INTENCION en el .env del VPS y pm2 reload cf --update-env.`
}

/* ══ EL A/B DEL PITCH (9 sep 2026) ══════════════════════════════════════════
 *
 * El primer mensaje que vende es fijo y va en dos versiones: la larga que
 * aprobó el dueño y una de tres líneas con el dolor que convirtió 9,4× en
 * julio. Cuál salió está en la traza (`promptId: pitch:corto|pitch:largo`), así
 * que se cuenta sin tocar nada: qué leads recibieron cada una y cuántos de
 * ellos acabaron registrándose.
 *
 * @param filas  { promptId, botLeadId, registrado } — un renglón por lead
 */
export function resumirPitch(filas = []) {
  const por = { corto: { total: 0, registrados: 0 }, largo: { total: 0, registrados: 0 } }
  const vistos = new Set()
  for (const f of filas) {
    const v = /pitch:(corto|largo)/.exec(f.promptId || '')?.[1]
    if (!v || vistos.has(f.botLeadId)) continue
    vistos.add(f.botLeadId)
    por[v].total++
    if (f.registrado) por[v].registrados++
  }
  for (const g of Object.values(por)) g.tasa = g.total ? +(g.registrados / g.total * 100).toFixed(1) : 0
  /* Los días que lleva corriendo, para poder decir cuándo habrá muestra. Va
     DESPUÉS del bucle de tasas: si se añade antes, `Object.values` lo pisa. */
  return { ...por, dias: diasEntre(filas.map((f) => f.createdAt)) }
}

/** Una línea honesta, que dice cuándo todavía no dice nada. */
export function textoPitch(ab, { minimoPorRama = 40 } = {}) {
  const { corto: c, largo: l, dias = null } = ab
  if (!c.total && !l.total) return null
  const linea = `A/B del pitch · corto ${c.registrados}/${c.total} (${c.tasa} %) · largo ${l.registrados}/${l.total} (${l.tasa} %)`
  const faltan = Math.max(minimoPorRama - c.total, minimoPorRama - l.total)
  if (faltan > 0) {
    return `${linea}\nTodavía no dice nada.${cuandoHabraMuestra(faltan, porDia(c.total + l.total, dias) / 2)}`
  }
  if (!diferenciaClara(c, l)) {
    const va = c.tasa > l.tasa ? 'el corto' : 'el largo'
    return `${linea}\nHay muestra, pero la diferencia cabe en el azar: va por delante ${va} y no es para decidir. Se deja correr.`
  }
  const gana = c.tasa > l.tasa ? 'el corto' : 'el largo'
  return `${linea}\nDECISIÓN LISTA: gana ${gana}, y la diferencia es clara. Se fija con BOT_PITCH=${c.tasa > l.tasa ? 'corto' : 'largo'} en el .env del VPS y pm2 reload cf --update-env.`
}
