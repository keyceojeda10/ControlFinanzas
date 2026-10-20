// lib/tutoriales/profe.js — los videos del profe (Fino), leídos del catálogo.
//
// ══ DE DÓNDE SALE TODO ══════════════════════════════════════════════════════
//
// El agente de los videos entrega `tutoriales-catalogo.json` y se copia aquí
// con `scripts/video/importar-tutoriales.mjs`. De ese archivo salen las
// lengüetas (D1), los botones de play junto a cada función (E2), el reproductor
// y la lista de Ayuda. Montar o cambiar un video es correr el guion: ninguna
// pantalla lleva escrito qué video tiene.
//
// El diseño lo eligió Carlos el 17 oct 2026 y el catálogo lo cerró el 19 oct
// (docs/superpowers/specs/2026-10-17-tutoriales-profe-design.md). Las cuatro
// decisiones del catálogo van tal cual:
//   1. Si se guarda la lengüeta sin ver el video, no vuelve a nacer abierta.
//   2. No se vuelve a asomar por «algo que arreglar» (segunda versión).
//   3. El botón E2 queda en gris una vez visto.
//   4. «También para mis cobradores» viene prendido.
//
// Lo de aquí es puro (sin React): vitest no transforma JSX.
import catalogo from './catalogo.json'

export const CATALOGO = catalogo

/* ⚠ PRIMERO LO REVISA CARLOS, EN SU CUENTA (19 oct 2026). Él no puede abrir el
   espejo, así que los videos salen a producción solo para estas organizaciones:
   la suya («Carlos prestamos», la cuenta del dueño) y la demo con la que el
   agente graba los videos. Los demás negocios no ven nada nuevo: ni botones, ni
   Ayuda, y /tutoriales sigue con sus guías. Cuando dé el visto bueno,
   `PROFE_PARA_TODOS = true` y se despliega. */
export const PROFE_PARA_TODOS = false
export const ORGS_QUE_YA_LO_VEN = [
  'cmm7iigyr00011t2rwyg9luph', // Carlos prestamos
  'zzvideodemo000000000000org', // la demo de los videos (espejo)
]
export function profeHabilitado(organizationId) {
  return PROFE_PARA_TODOS || ORGS_QUE_YA_LO_VEN.includes(organizationId)
}

/** Solo se enseña lo terminado: `revisar` es un video al que le faltan tomas. */
const ESTADOS_VISIBLES = new Set(['listo', 'montado'])

/** El orden y el nombre de las series en la lista de Ayuda. */
export const SERIES = [
  { id: 'inicio', titulo: 'Para empezar' },
  { id: 'capital', titulo: 'Capital' },
  { id: 'caja', titulo: 'Caja' },
  { id: 'cartera', titulo: 'Pasar tu cartera' },
  { id: 'clientes', titulo: 'Clientes' },
  { id: 'prestamos', titulo: 'Préstamos' },
  { id: 'rutas', titulo: 'Rutas' },
  { id: 'cobradores', titulo: 'Cobradores' },
  { id: 'reportes', titulo: 'Reportes' },
]

export function videoPorId(id, lista = CATALOGO.videos) {
  return lista.find((v) => v.id === id) ?? null
}

/**
 * Los videos que esta persona puede ver.
 *   · solo los terminados (`listo` o `montado`);
 *   · el cobrador, solo los que llevan `cobrador` en `para`, y solo si el
 *     dueño dejó prendido «También para mis cobradores» (viene prendido).
 */
export function videosPara({ rol, paraCobradores = true } = {}, lista = CATALOGO.videos) {
  const esCobrador = rol === 'cobrador'
  return lista.filter((v) => ESTADOS_VISIBLES.has(v.estado)
    && (!esCobrador || (paraCobradores && (v.para ?? []).includes('cobrador'))))
}

/* «/clientes/[id]» → /^\/clientes\/[^/]+$/. Las pantallas del catálogo son
   rutas de la app con sus segmentos dinámicos entre corchetes. */
function patron(pantalla) {
  const limpio = String(pantalla ?? '').trim()
  if (!limpio.startsWith('/') || /\s/.test(limpio)) return null
  const re = limpio.replace(/[.*+?^${}()|\\]/g, '\\$&').replace(/\\?\[[^\]]+\\?\]/g, '[^/]+')
  return new RegExp(`^${re}/?$`)
}

/* Una ruta fija gana a una con corchetes: «/clientes/nuevo» no es la ficha de
   un cliente llamado «nuevo». */
const especificidad = (pantalla) => -((String(pantalla).match(/\[/g) ?? []).length)

/**
 * El video de la lengüeta (D1) de esta pantalla y, si la pantalla tiene
 * pestañas, de esta pestaña. Una pestaña sin video propio se queda con el de la
 * pantalla (si lo hay sin `pestana`).
 */
export function videoDeLaPantalla(pathname, pestana = null, lista) {
  const ruta = String(pathname ?? '').split('?')[0]
  const candidatos = []
  for (const v of lista ?? []) {
    for (const d of v.donde ?? []) {
      if (d.tipo !== 'D1') continue
      const re = patron(d.pantalla)
      if (!re || !re.test(ruta)) continue
      candidatos.push({ v, d })
    }
  }
  if (!candidatos.length) return null
  candidatos.sort((a, b) => especificidad(b.d.pantalla) - especificidad(a.d.pantalla))
  const mejorPantalla = candidatos[0].d.pantalla
  const deEsa = candidatos.filter((c) => c.d.pantalla === mejorPantalla)
  const conPestana = pestana ? deEsa.find((c) => c.d.pestana === pestana) : null
  const sinPestana = deEsa.find((c) => !c.d.pestana)
  return (conPestana ?? sinPestana)?.v ?? null
}

/* ══ LA AYUDA DE CADA PANTALLA (Adenda 6, 19 oct 2026) ══════════════════════
 *
 * Carlos: «hay secciones que llevan por fuera su video y las mismas secciones
 * por dentro las funciones también llevan videos… todo eso quedó como en el
 * aire». Los 44 botones sueltos no decían de qué eran. Ahora cada pantalla
 * tiene UNA pastilla, y detrás, la ayuda de esa pantalla:
 *
 *   «Empieza aquí»            → el video de la pantalla (entradas D1)
 *   «Lo que puedes hacer aquí» → un video por función (entradas E2)
 *
 * Las entradas del catálogo dicen dónde van con palabras («Hoja de pago»,
 * «/prestamos/[id] → hoja «Gestión»»). Esto las lleva a la pantalla donde se
 * abre esa hoja. `null` = no va en ninguna pastilla: la de la cuenta nueva
 * vive en sus propias opciones, y la bienvenida, en la biblioteca. */
export function pantallaDeEntrada(d) {
  const p = String(d?.pantalla ?? '').trim()
  if (/cuenta nueva|primera entrada/i.test(p)) return null
  if (/^hoja de pago$/i.test(p)) return '/prestamos/[id]'
  if (/^hoja «editar la ruta»$/i.test(p)) return '/rutas/[id]'
  const ruta = p.split(/\s/)[0]
  return ruta.startsWith('/') ? ruta : null
}

/** Solo para quien es: «/caja (cobrador)» es la caja que ve el cobrador. */
const soloPara = (d) => (/\(cobrador\)/.test(d?.pantalla ?? '') ? 'cobrador' : null)

/**
 * Lo que va detrás de la pastilla de esta pantalla:
 *   { general, funciones, todos }
 * `general` es el video D1 (el de la pestaña si la hay); `funciones`, los E2 de
 * esta pantalla en el orden del catálogo, sin repetir y sin el general.
 */
export function ayudaDeLaPantalla(pathname, pestana = null, lista = [], { rol } = {}) {
  const ruta = String(pathname ?? '').split('?')[0]
  const general = videoDeLaPantalla(ruta, pestana, lista)
  // La ruta más concreta gana, como en la lengüeta: «/clientes/nuevo» no es la
  // ficha de un cliente.
  const candidatas = [...new Set(lista.flatMap((v) => (v.donde ?? []).map(pantallaDeEntrada)).filter(Boolean))]
    .filter((p) => patron(p)?.test(ruta))
    .sort((a, b) => especificidad(b) - especificidad(a))
  const pantalla = candidatas[0] ?? null
  const funciones = []
  if (pantalla) {
    for (const v of lista) {
      if (v.id === general?.id || funciones.includes(v)) continue
      const aqui = (v.donde ?? []).some((d) => d.tipo === 'E2' && pantallaDeEntrada(d) === pantalla
        && (!soloPara(d) || soloPara(d) === rol))
      if (aqui) funciones.push(v)
    }
  }
  return { general, funciones, todos: [general, ...funciones].filter(Boolean) }
}

/** Lo que dura lo que se va a ver: el capítulo si abre en uno, si no el video. */
export function duracionDe(video, junto) {
  if (!video) return 0
  const desde = desdeDe(video, junto)
  if (!desde) return Number(video.duracion) || 0
  const parte = partesDe(video).find((p) => Math.abs(p.t - desde) < 0.5)
  return parte ? parte.dura : Math.max(0, (Number(video.duracion) || 0) - desde)
}

/** El título como la pregunta de quien lo abre, si el catálogo la trae. */
export const preguntaDe = (video) => video?.pregunta || video?.titulo || ''

/** El segundo en que abre un botón E2: su capítulo, si la entrada trae `desde`. */
export function desdeDe(video, junto) {
  if (!video || !junto) return 0
  const e = (video.donde ?? []).find((d) => d.tipo === 'E2' && d.junto_a === junto)
  return Number(e?.desde) > 0 ? Number(e.desde) : 0
}

/** El capítulo que está sonando en `segundo` (índice), o -1 si no hay. */
export function capituloEn(video, segundo) {
  const caps = video?.capitulos ?? []
  let i = -1
  for (let k = 0; k < caps.length; k++) if (Number(segundo) + 0.25 >= Number(caps[k].t)) i = k
  return i
}

/**
 * Las partes del reproductor: cada capítulo con lo que dura (hasta el
 * siguiente, o hasta el final del video). Un video sin capítulos es una sola
 * parte.
 */
export function partesDe(video) {
  const caps = video?.capitulos?.length ? video.capitulos : [{ t: 0, titulo: video?.titulo ?? '' }]
  const total = Number(video?.duracion) || 0
  return caps.map((c, i) => {
    const fin = i + 1 < caps.length ? Number(caps[i + 1].t) : total
    return { n: i + 1, t: Number(c.t) || 0, titulo: c.titulo, dura: Math.max(0, fin - (Number(c.t) || 0)) }
  })
}

/* ── EL BOTÓN DE LA TAREA, AL PIE DEL REPRODUCTOR ────────────────────────────
 * El texto viene del catálogo (`tarea`); a dónde lleva, de aquí. Si la pantalla
 * de la tarea está abierta y registró su acción (`useRegistrarAcciones`, la
 * misma que lee el buscador), se ejecuta ahí mismo: «Registrar mi capital
 * inicial» abre el formulario sin salir de Capital. Con `evento`, se toca ese
 * timbre (la guía de instalar se abre en cualquier pantalla). Si no, `href`.
 * Por id de video: el texto puede cambiar en el catálogo, el id no. */
export const TAREAS = {
  'capital-capital': { accion: 'capital-inicial', href: '/capital' },
  'cartera-cuaderno': { href: '/migrador' },
  'cartera-excel': { href: '/carga-masiva' },
  'cobradores-crear': { href: '/cobradores/nuevo' },
  'rutas-crear': { accion: 'ruta-nueva', href: '/rutas' },
  'rutas-clientes': { accion: 'ruta-agregar', href: '/rutas' },
  'rutas-recorrido': { accion: 'ruta-empezar', href: '/rutas' },
  // La guía de instalación tiene su timbre global (PuertaInstalacion.jsx).
  'inicio-instalar': { evento: 'cf:abrir-instalacion', href: '/configuracion' },
}

/** El texto y el destino del botón de tarea de un video, o null si no tiene. */
export function tareaDe(video) {
  if (!video?.tarea) return null
  const destino = TAREAS[video.id]
  return destino ? { texto: video.tarea, ...destino } : null
}

/** «2 min» / «45 s» para la lengüeta y la lista. */
export function duracionCorta(segundos) {
  const s = Math.round(Number(segundos) || 0)
  if (s <= 0) return null
  if (s < 60) return `${s} s`
  return `${Math.round(s / 60)} min`
}

/** «1:45» para la lista de capítulos. */
export function reloj(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ── LO QUE SE APUNTA EN `Evento` ────────────────────────────────────────────
 * Se mide igual que la bienvenida: abierto, 25/50/75/100 %, cerrado, y si
 * después hizo la tarea. `tuto_visto` y `tuto_guardado` son además el estado
 * por persona («Visto» en el servidor, en cualquier teléfono). Los dos
 * interruptores de Ayuda también van aquí: manda el último. */
export const EVENTOS = {
  abierto: 'tuto_abierto',
  cerrado: 'tuto_cerrado',
  hito: (pct) => `tuto_${pct}`,
  visto: 'tuto_visto',
  guardado: 'tuto_guardado',
  tarea: 'tuto_tarea',
  // Agrandó el video a pantalla completa.
  completa: 'tuto_completa',
  prefBoton: 'tuto_pref_boton',
  prefCobradores: 'tuto_pref_cobradores',
  // La tarjeta de primera vez (Adenda 6, D): «Ya sé cómo», el interruptor de
  // avisos y «Volver a mostrar los avisos», que deja sin efecto los anteriores.
  avisoNo: 'tuto_aviso_no',
  avisosReset: 'tuto_avisos_reset',
  prefAvisos: 'tuto_pref_avisos',
}

/* La acción dorada del video DEVUELVE A LA TAREA, con su nombre (Adenda 6, F):
   «Volver al préstamo», no «Cerrar». */
const VOLVER = [
  [/^\/prestamos\/[^/]+/, 'Volver al préstamo'], [/^\/prestamos$/, 'Volver a Préstamos'],
  [/^\/clientes\/[^/]+/, 'Volver al cliente'], [/^\/clientes$/, 'Volver a Clientes'],
  [/^\/rutas\/[^/]+/, 'Volver a la ruta'], [/^\/rutas$/, 'Volver a Rutas'],
  [/^\/caja/, 'Volver a la caja'], [/^\/capital/, 'Volver a Capital'],
  [/^\/cobradores\/ranking/, 'Volver al ranking'], [/^\/cobradores\/[^/]+/, 'Volver al cobrador'],
  [/^\/cobradores$/, 'Volver a Cobradores'], [/^\/actividad/, 'Volver al Historial'],
  [/^\/cobros-hoy/, 'Volver a los cobros'], [/^\/gastos/, 'Volver a los gastos'],
  [/^\/reportes/, 'Volver a Reportes'], [/^\/migrador/, 'Volver a tu cuaderno'],
  [/^\/carga-masiva/, 'Volver a tu Excel'], [/^\/configuracion/, 'Volver a Ayuda'],
  [/^\/tutoriales/, 'Volver a la biblioteca'], [/^\/dashboard/, 'Volver al Inicio'],
]
export const volverDe = (pathname) => VOLVER.find(([re]) => re.test(String(pathname ?? '')))?.[1] ?? 'Volver'

/* ── LA TARJETA DE PRIMERA VEZ (Adenda 6, D) ───────────────────────────────
 * Solo donde equivocarse la primera vez cuesta plata. El texto no describe el
 * video: dice POR QUÉ verlo. `clave` es lo que el servidor sabe si ya pasó
 * (`primeraVez` en /api/tutoriales). */
/* ── LA NOVEDAD: «EL PROFE EN TODA LA APP» (Carlos, 19 oct 2026) ──────────
 * Una sola vez por persona, en el servidor (`avisoNo` al verla o cerrarla).
 * Solo a quien ya usaba la app antes del estreno: a una cuenta nueva los videos
 * no le son «novedad», y ya tiene su clase de bienvenida. */
export const NOVEDAD_PROFE = {
  video: 'inicio-novedad-profe',
  estreno: '2026-10-21T05:00:00Z',   // medianoche de Bogotá del 21 oct 2026
  titulo: 'Ahora hay videos en cada pantalla',
  porque: 'Toca la pastilla ▶ de arriba y el profe te explica esa pantalla y lo que puedes hacer en ella. Todos están también en Ayuda y tutoriales.',
}

export const PRIMERA_VEZ = {
  prestamo: {
    clave: 'prestamo', video: 'prestamos-crear', desde: 0,
    titulo: 'Es tu primer préstamo',
    porque: 'Antes de prestar, mira cómo quedan la cuota y el interés. Lo que firmas hoy es lo que cobras los próximos meses.',
  },
  cierreCobrador: {
    clave: 'cierre', video: 'cobradores-dia', desde: 95.6,
    titulo: 'Es tu primer cierre de caja',
    porque: 'Antes de contar la plata, mira cómo se hace. Si cuadras desde el primer día, nunca vas a tener que buscar un faltante.',
  },
  cierreDueno: {
    clave: 'cierre', video: 'caja-caja', desde: 124.7,
    titulo: 'Es tu primer cierre de caja',
    porque: 'Antes de contar la plata, mira cómo se hace. Si cuadras desde el primer día, nunca vas a tener que buscar un faltante.',
  },
}

export const HITOS_TUTO = [25, 50, 75, 100]

/** Se cuenta como visto al pasar el 80 % o al terminar (Adenda 6): el final
 *  suele ser la despedida, y exigir el 100 % dejaría «sin ver» a quien sí lo vio. */
export const VISTO_DESDE = 80
