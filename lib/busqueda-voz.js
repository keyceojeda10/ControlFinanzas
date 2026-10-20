// lib/busqueda-voz.js — Encontrar a un cliente por lo que el cobrador DIJO.
//
// Lo pidió Héctor Fabio Cano (HCANOCOMERCIALIZADORA, 14 oct 2026): «mi cobrador
// es una persona responsable, experimentada y muy eficiente en su trabajo. Sin
// embargo, presenta dificultades para leer, escribir y digitar información…
// que pueda decir: buscar el crédito de Pepito Pérez, y que inmediatamente
// aparezca el cliente».
//
// El dictado no escribe como la base: «Yeison» por «Jeison», «Bivian» por
// «Vivian», sin tildes, con un punto al final, o con la frase entera («buscar
// el crédito de…»). Una búsqueda por `contains` no encuentra nada de eso. Aquí
// se compara por cómo SUENA cada palabra y se tolera una letra de diferencia.
//
// Puro (sin prisma ni React): vitest no transforma JSX y así se prueba solo.

/** Lo que se dice ALREDEDOR del nombre. Se quita solo al principio de la frase:
 *  «de» o «la» en medio pueden ser parte de un apellido («De la Cruz»). */
const RELLENO = [
  'por favor', 'buscame', 'búscame', 'buscar', 'busca', 'busque', 'muestrame', 'muéstrame', 'mostrar',
  'abrir', 'abre', 'quiero ver', 'ver', 'dame', 'el credito de', 'el crédito de', 'credito de', 'crédito de',
  'el prestamo de', 'el préstamo de', 'prestamo de', 'préstamo de', 'la cuenta de', 'cuenta de',
  'la ficha de', 'ficha de', 'al cliente', 'el cliente', 'la clienta', 'cliente', 'clienta',
  'a la señora', 'a el señor', 'al señor', 'la señora', 'el señor', 'señora', 'señor', 'doña', 'don',
  'a', 'de', 'el', 'la',
]

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')

/** «Buscar el crédito de Pepito Pérez.» → «pepito perez». */
export function limpiarDictado(texto) {
  let t = sinTildes(texto).toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const relleno = RELLENO.map(sinTildes).sort((a, b) => b.length - a.length)
  let cambio = true
  while (cambio && t) {
    cambio = false
    for (const r of relleno) {
      if (t === r) return ''
      if (t.startsWith(`${r} `)) { t = t.slice(r.length + 1).trim(); cambio = true; break }
    }
  }
  return t
}

/** Cómo suena una palabra en el español de aquí: b/v, s/z/c, y/ll, h muda,
 *  k/qu/c fuerte, j/g suave, x. «Yeison» y «Jeison» no quedan iguales (la j no
 *  es y), pero sí a una letra, y eso lo perdona `distancia`. */
/* NOMBRES QUE EL TRANSCRIPTOR ESCRIBE A LA INGLESA. Con voz real (14 oct 2026)
 * «Maicol» salió «Michael», «Yeferson» salió «Jefferson» y «Jeison», «Jason» o
 * «Jeyson». Letra a letra «Michael» y «Maicol» no se parecen: se igualan antes. */
const EQUIVALENTES = {
  michael: 'maicol', maikel: 'maicol', maykol: 'maicol', maicoll: 'maicol',
  jason: 'jeison', jeyson: 'jeison', yeison: 'jeison',
  brian: 'brayan', bryan: 'brayan', braian: 'brayan',
  steven: 'estiven', stephen: 'estiven', stiven: 'estiven', steeven: 'estiven',
  jefferson: 'yeferson', jeferson: 'yeferson', yefferson: 'yeferson',
  john: 'jhon', jon: 'jhon', jonathan: 'jhonatan', johnathan: 'jhonatan', jonatan: 'jhonatan',
  jennifer: 'yenifer', jenifer: 'yenifer', jeniffer: 'yenifer', yennifer: 'yenifer',
  jessica: 'yesica', yessica: 'yesica', jesica: 'yesica',
  william: 'wilian', wiliam: 'wilian', willian: 'wilian',
  dairy: 'dary', dari: 'dary', darly: 'dary',
  jeisson: 'jeison', jarol: 'harol', harold: 'harol',
}

export function sonido(palabra) {
  const base = sinTildes(palabra).toLowerCase().replace(/[^a-zñ]/g, '')
  return (EQUIVALENTES[base] ?? base)
    .replace(/[^a-zñ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/c([ei])/g, 's$1')
    .replace(/g([ei])/g, 'j$1')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/x/g, 'ks')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
}

/** Levenshtein con tope: basta saber si son 0, 1, 2 o «más». */
export function distancia(a, b, tope = 3) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > tope) return tope + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let min = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (cur[j] < min) min = cur[j]
    }
    if (min > tope) return tope + 1
    prev = cur
  }
  return prev[b.length]
}

/** Cuánto se parece UNA palabra dicha a UNA palabra del nombre (0 a 1). */
function parecido(dicha, delNombre) {
  if (!dicha || !delNombre) return 0
  if (dicha === delNombre) return 1
  // «Pepe» por «Pepito», «Rodri» por «Rodríguez»: un comienzo de 3 letras o más.
  if (dicha.length >= 3 && delNombre.startsWith(dicha)) return 0.85
  const d = distancia(dicha, delNombre, 2)
  const largo = Math.max(dicha.length, delNombre.length)
  if (d === 1 && largo >= 4) return 0.8
  // «Jason» por «Jeison»: el transcriptor «agringa» nombres de aquí, y eso son
  // dos letras en una palabra de seis. Con todas las palabras dichas obligadas
  // a encajar, no trae a cualquiera.
  if (d === 2 && largo >= 6) return 0.6
  return 0
}

/** Qué tanto encaja lo dicho con un nombre: el promedio de lo que encaja cada
 *  palabra dicha con la mejor palabra libre del nombre. Una palabra dicha que no
 *  está en el nombre lo tumba: «Pepito Gómez» no es «Pepito Pérez». */
export function puntuar(dicho, nombre) {
  const dichas = limpiarDictado(dicho).split(' ').filter(Boolean).map(sonido).filter(Boolean)
  const delNombre = sinTildes(nombre).toLowerCase().split(/\s+/).map(sonido).filter(Boolean)
  if (!dichas.length || !delNombre.length) return 0
  const libres = [...delNombre]
  let suma = 0
  for (const d of dichas) {
    let mejor = 0, cual = -1
    libres.forEach((n, i) => { const p = parecido(d, n); if (p > mejor) { mejor = p; cual = i } })
    if (mejor === 0) return 0
    suma += mejor
    libres.splice(cual, 1)
  }
  return suma / dichas.length
}

export const UMBRAL = 0.6

/* ── A QUIÉN SE BUSCA ──
 * Lo que ESTA persona puede ver: el cobrador, solo sus rutas. Con `rutaId`
 * (buscar por voz DENTRO de una ruta, 20 oct 2026), solo los de esa ruta —el
 * cobrador, solo si es suya; si no, se queda con su alcance de siempre—. Es el
 * `where` de Prisma, puro. Lo usan la búsqueda y la pista del transcriptor:
 * dentro de una ruta la pista lleva sus nombres, no los primeros ochenta del
 * negocio que caben en 800 bytes. */
export function alcanceDeVoz({ organizationId, rol, rutaIds = [] } = {}, rutaId = null) {
  const base = { organizationId, estado: { notIn: ['eliminado'] } }
  if (rol === 'cobrador') {
    return { ...base, rutaId: rutaId && rutaIds.includes(rutaId) ? rutaId : { in: rutaIds } }
  }
  return rutaId ? { ...base, rutaId } : base
}

/** Los clientes que encajan con lo dicho, del que más al que menos.
 *  `unico`: hay uno y se puede abrir directo — encaja bien (≥ 0,8) y el
 *  siguiente queda claramente por debajo. Con dos «Pepito Pérez» NO se abre
 *  ninguno solo: se enseñan los dos. */
export function buscarPorVoz(dicho, clientes, { max = 6 } = {}) {
  const lista = (clientes ?? [])
    .map((c) => ({ ...c, puntaje: puntuar(dicho, c.nombre) }))
    .filter((c) => c.puntaje >= UMBRAL)
    .sort((a, b) => b.puntaje - a.puntaje || String(a.nombre).localeCompare(String(b.nombre)))
    .slice(0, max)
  const [a, b] = lista
  const unico = Boolean(a && a.puntaje >= 0.8 && (!b || b.puntaje < a.puntaje - 0.15))
  return { resultados: lista, unico }
}

/* ── LO QUE SE LEE EN VOZ ALTA ──
 * Para el cobrador al que le cuesta leer: al abrir la ficha, el teléfono le
 * dice lo esencial. Las cifras salen de `/api/clientes/[id]`, las MISMAS que la
 * ficha enseña (`saldoPendiente`, `diasMora` de cada préstamo): aquí no se
 * calcula ningún saldo, solo se suma lo que la pantalla ya dice por crédito. */

/** 1.250.000 → «1 millón 250 mil». Sin «pesos»: cada país dice su moneda, y
 *  «debe 250 mil» se entiende en todos. */
export function plataHablada(n) {
  const v = Math.round(Math.abs(Number(n) || 0))
  if (v === 0) return 'cero'
  const partes = []
  const millones = Math.floor(v / 1e6)
  const miles = Math.floor((v % 1e6) / 1000)
  const unidades = v % 1000
  if (millones) partes.push(millones === 1 ? '1 millón' : `${millones} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${miles} mil`)
  if (unidades) partes.push(String(unidades))
  return partes.join(' ')
}

export function resumenHablado({ nombre, prestamos = [] }) {
  const activos = (prestamos ?? []).filter((p) => p?.estado === 'activo')
  if (!activos.length) return `${nombre}. No tiene créditos activos.`
  const saldo = activos.reduce((s, p) => s + Math.max(0, Number(p.saldoPendiente) || 0), 0)
  const mora = Math.max(0, ...activos.map((p) => Number(p.diasMora) || 0))
  const deuda = activos.length > 1
    ? `Tiene ${activos.length} créditos. Debe en total ${plataHablada(saldo)}.`
    : `Debe ${plataHablada(saldo)}.`
  const estado = mora > 0 ? `Lleva ${mora} ${mora === 1 ? 'día' : 'días'} de atraso.` : 'Va al día.'
  return `${nombre}. ${deuda} ${estado}`
}

/** Lo que se dice cuando no se abre ninguno solo. */
export function avisoHablado(resultados) {
  if (!resultados?.length) return 'No encontré a nadie con ese nombre. Toca el micrófono y dilo otra vez.'
  if (resultados.length === 1) return `Encontré a ${resultados[0].nombre}. Tócalo para abrirlo.`
  const nombres = resultados.slice(0, 3).map((c) => c.nombre).join(', ')
  return `Encontré ${resultados.length}: ${nombres}. Toca el que es.`
}

/** Las palabras de los nombres de los clientes, para que el transcriptor las
 *  escriba tal cual (ver `transcribirAudio`). Primero los nombres de pila —es lo
 *  que más «agringa»—, luego los apellidos, sin repetir.
 *
 *  ⚠ EL TOPE VA EN BYTES, NO EN LETRAS (19 oct 2026). Groq acepta 896 y aquí se
 *  cortaba en 900 letras: con 897-904 rechazaba la pista ENTERA y la búsqueda
 *  decía «No te escuché» a todo negocio con muchos clientes. Lo vio un cliente
 *  («a toda hora le dice a uno: no te escuché»); el log lo confirmó. Las tildes
 *  y la ñ ocupan dos bytes, por eso salía 904 con 900 letras. */
export const TOPE_PISTA_BYTES = 800
const bytes = (s) => new TextEncoder().encode(s).length
export function palabrasParaDictado(nombres, tope = TOPE_PISTA_BYTES) {
  const pila = [], resto = [], vistas = new Set()
  for (const n of nombres ?? []) {
    String(n ?? '').split(/\s+/).filter((w) => w.length > 2).forEach((w, i) => {
      const k = w.toLowerCase()
      if (vistas.has(k)) return
      vistas.add(k)
      ;(i === 0 ? pila : resto).push(w)
    })
  }
  let out = ''
  for (const w of [...pila, ...resto]) {
    const siguiente = out ? `${out}, ${w}` : w
    if (bytes(siguiente) > tope) break
    out = siguiente
  }
  return out
}
