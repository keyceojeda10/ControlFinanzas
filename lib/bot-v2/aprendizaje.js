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
