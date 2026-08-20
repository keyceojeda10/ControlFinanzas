// lib/adaptadores/cobros.js — entre /api/cobros-hoy y <CobrarHoy>.
//
// LA PANTALLA ES «EL ARREGLO DEL MURO». El pie de T02-02:
//
//   «Fila blanca, barra lateral de 4px con el estado, pastilla con los días y el
//    monto en negro. El monto deja de ser un botón rojo: rojo es mora, no
//    "cobrar". Ahora se distingue de un vistazo quién debe 36 días de quién debe
//    8, y lo ya cobrado se tacha en vez de desaparecer.»
//
// DOS DECISIONES QUE VIENEN DE AHÍ Y NO SON MÍAS:
//
//  1 · EL COBRADO SE QUEDA, TACHADO. No se colapsa ni se borra. Yo lo tenía
//      colapsado en una línea plegable con el argumento de que «los que ya cobró
//      no ocupan sitio». La lámina decide lo contrario, y tiene razón práctica:
//      el cobrador recorre la calle en orden, y si el cliente cobrado desaparece
//      de la lista pierde la referencia de dónde iba. Tachado sigue siendo el
//      mapa del recorrido.
//
//  2 · SE AGRUPA POR RUTA, con su conteo y su total. Sin agrupar, un cobrador
//      con dos rutas ve una lista de veinte nombres sin saber dónde acaba una y
//      empieza la otra.
//
// NO SE RECALCULA NADA: cuotas, saldos y días de mora vienen del endpoint.

import { formatMoney } from '@/lib/i18n'
import { DIAS_MORA } from '@/lib/adaptadores/clientes'
import { distanciaMetros } from '@/lib/geo'
import { rotuloCuota } from '@/lib/frecuencia'

/**
 * LOS CINCO ÓRDENES DE T03-02, que sustituye a los tres de T02-02.
 *
 * El pie de la lámina: «cinco órdenes que responden preguntas reales del
 * negocio». La diferencia con los tres de antes es esa: «más atrasados» era el
 * único criterio de riesgo, y días de atraso NO es lo mismo que plata en
 * riesgo — cinco clientes con 40 días y $10.000 cada uno pesan menos que uno
 * con 8 días y $400.000.
 *
 * La lámina dibuja cuatro; `cerca` es el quinto y ya existía en la pantalla,
 * así que se conserva en vez de inventar otro.
 */
export const ORDENES = [
  { id: 'ruta',       nombre: 'Orden del recorrido' },
  { id: 'atrasados',  nombre: 'Más días de atraso' },
  { id: 'plata',      nombre: 'Mayor plata atrasada' },
  { id: 'cumple',     nombre: 'Peor cumplimiento' },
  { id: 'cerca',      nombre: 'Cerca de mí' },
]

/**
 * Los rangos de atraso, que en la hoja van CON SU CONTEO.
 *
 * El pie de T03-02 empieza por ahí: «hoy hay cuatro chips sin conteo». Un rango
 * sin su número obliga a pulsarlo para saber si hay alguien dentro, y con
 * cuatro rangos son cuatro tanteos antes de empezar a caminar.
 */
export const RANGOS_ATRASO = [
  { id: '',      nombre: 'Todos',  dentro: () => true },
  { id: 'aldia', nombre: 'Al día', dentro: (d) => d <= 0 },
  { id: '1-7',   nombre: '1–7d',   dentro: (d) => d >= 1 && d <= 7 },
  { id: '8-30',  nombre: '8–30d',  dentro: (d) => d >= 8 && d <= 30 },
  { id: '+30',   nombre: '+30d',   dentro: (d) => d > 30 },
]

/** Mismo umbral que el resto del sistema: por encima de 7 días ya es mora. */
export function estadoDe(cliente) {
  const dias = Number(cliente?.diasMora ?? 0)
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0) return 'atraso'
  return 'aldia'
}

/**
 * «36d», y «Al día» cuando no debe nada.
 *
 * Decía «36d de atraso» — T02-02 escribía la palabra en los tres casos. T03-01
 * la recorta a los días secos, igual que en clientes y préstamos: la gravedad
 * ya la dice el color, y la palabra no cabe.
 */
export function etiquetaAtraso(dias) {
  const d = Number(dias ?? 0)
  if (d <= 0) return 'Al día'
  // SOLO LOS DÍAS. Decía «36d de atraso», que es lo que dibujaba T02-02; T03-01
  // la recorta a «36d». Y hace falta: la pastilla ocupa la misma línea que el
  // «dónde», y con las nueve letras de más la dirección salía cortada — que en
  // una pantalla para caminar es el dato por el que se abre.
  return `${d}d`
}

/**
 * La hora del cobro, formateada EN EL CLIENTE.
 *
 * El endpoint manda ISO a propósito: hecho en el servidor saldría en la zona del
 * servidor, y en producción eso es UTC — «Cobrado 14:06» cuando el cobrador lo
 * hizo a las 9:06. Es el mismo error de zona que ya costó 1.462 filas legacy.
 */
export function horaDe(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

/** «4 de marzo». Con la palabra entera porque es como se nombra un préstamo en
 *  voz alta: el cliente dice «el de marzo», no «el 4/3». */
export function fechaLargaDe(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  /* `timeZone: 'UTC'`, como el resto del sistema: las fechas se guardan con el
     convenio T05:00Z y formatearlas en la zona del navegador las corre un día
     para cualquiera al oeste de UTC-5 — Costa Rica es UTC-6 y sí tenemos ahí. */
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** «21 jun». Corta a propósito: entra en una columna de un cuarto de tarjeta.
 *
 * ⚠ `timeZone: 'UTC'` igual que su hermana de arriba. Se le había quedado
 * fuera, y sin él la misma fecha sale un día antes para cualquiera al oeste de
 * UTC-5 —Costa Rica es UTC-6 y sí hay clientes allí—. En el código las dos
 * funciones se ven iguales; la diferencia solo aparece cruzando husos. */
export function fechaCortaDe(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  /* ⚠ EL «de» QUE METE EL ICU NUEVO. `month: 'short'` devolvía «24 jul» y
     ahora devuelve «24 de jul»: nadie tocó el código, cambió debajo. Son ~12px
     de más en una tira de cuatro columnas de 74px, y ahí la cifra deja de
     caber. Ya se corrigió en `adaptadores/prestamos.js` y en
     `adaptadores/clientes.js`; ESTA era la tercera copia y se había quedado —
     se veía en la captura, «ÚLT. PAGO 24 de jul». */
  return d
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace(' de ', ' ')
    .replace('.', '')
}

/**
 * Ordena la lista según el orden elegido.
 *
 * `ruta` es el orden que ya trae el endpoint (mora primero, luego pendientes,
 * luego pagados, y por nombre dentro de cada grupo). NO se reordena: ese orden
 * es el que el cobrador ya conoce.
 *
 * `cerca` DEVUELVE EL MISMO ORDEN mientras no haya coordenadas. No es un
 * descuido: fingir una ordenación por distancia sin GPS manda al cobrador a
 * caminar mal, y eso cuesta gasolina y tiempo real. La pantalla marca el chip
 * como no disponible en vez de mentir.
 */
export function ordenar(clientes = [], orden = 'ruta') {
  const lista = [...(clientes || [])]
  if (orden === 'atrasados') {
    return lista.sort((a, b) => {
      const d = Number(b.diasMora ?? 0) - Number(a.diasMora ?? 0)
      if (d !== 0) return d
      // A igualdad de días, primero el que más debe: es más plata en riesgo.
      return Number(b.saldoTotal ?? 0) - Number(a.saldoTotal ?? 0)
    })
  }
  // MAYOR PLATA ATRASADA. No es lo mismo que más días, y por eso es un orden
  // aparte: si el cobrador solo puede hacer media ruta, este es el que salva
  // más plata.
  if (orden === 'plata') {
    return lista.sort((a, b) =>
      Number(b.montoParaPonerseAlDia ?? 0) - Number(a.montoParaPonerseAlDia ?? 0))
  }
  // PEOR CUMPLIMIENTO. Mira el historial, no el día de hoy: el que casi nunca
  // paga aunque hoy deba poco. Los que aún no tienen historial (`null`) van al
  // FINAL, no al principio — un cliente nuevo no es un mal pagador.
  if (orden === 'cumple') {
    return lista.sort((a, b) => (a.cumplimiento ?? 999) - (b.cumplimiento ?? 999))
  }
  return lista
}

/**
 * Agrupa por ruta, conservando el orden de aparición.
 *
 * El total del grupo suma SOLO lo pendiente, no lo ya cobrado: el encabezado
 * dice cuánta plata queda por levantar en esa ruta, que es la pregunta. Sumar lo
 * cobrado haría que el número no bajara al ir cobrando.
 */
export function agruparPorRuta(clientes = [], pais) {
  const grupos = new Map()
  for (const c of clientes || []) {
    const clave = c.rutaId ?? 'sin-ruta'
    if (!grupos.has(clave)) {
      grupos.set(clave, { id: clave, nombre: c.rutaNombre || 'Sin ruta', filas: [], pendientes: 0, monto: 0 })
    }
    const g = grupos.get(clave)
    g.filas.push(c)
    if (!c.pagoHoy) {
      g.pendientes += 1
      g.monto += Number(c.cuota ?? 0)
    }
  }
  return [...grupos.values()].map((g) => ({
    ...g,
    total: formatMoney(g.monto, pais),
  }))
}

/** Aplica los filtros de T03-02. */
export function filtrar(clientes = [], f = {}) {
  const rango = RANGOS_ATRASO.find((r) => r.id === (f.atraso ?? '')) ?? RANGOS_ATRASO[0]
  return (clientes || []).filter((c) => {
    if (!rango.dentro(Number(c.diasMora ?? 0))) return false
    if (f.rutaId != null && f.rutaId !== '' && String(c.rutaId ?? '') !== String(f.rutaId)) return false
    if (f.ocultarCobrados && c.pagoHoy) return false
    return true
  })
}

/**
 * «Al día · 11», «+30d · 13».
 *
 * Se cuentan IGNORANDO el propio rango, sobre lo filtrado por lo demás. Es lo
 * que hace que «1–7d · 6» siga diciendo 6 cuando ya estás dentro de «+30d»: si
 * se contara sobre la lista ya filtrada, los otros tres rangos dirían 0 y
 * parecería que no hay nadie en ellos.
 */
export function conteosAtraso(clientes = [], f = {}) {
  const base = filtrar(clientes, { ...f, atraso: '' })
  const out = {}
  for (const r of RANGOS_ATRASO) {
    out[r.id] = r.id === '' ? base.length : base.filter((c) => r.dentro(Number(c.diasMora ?? 0))).length
  }
  return out
}

/** «Ver 11 cobros · $460.867» — lo que queda seleccionado, en cobros y plata. */
export function resumenSeleccion(clientes = [], f = {}, pais) {
  const sel = filtrar(clientes, f).filter((c) => !c.pagoHoy)
  const plata = sel.reduce((n, c) => n + Number(c.cuota ?? 0), 0)
  return {
    cobros: sel.length,
    texto: sel.length === 0 ? 'Sin cobros con estos filtros'
      : `Ver ${sel.length} ${sel.length === 1 ? 'cobro' : 'cobros'} · ${formatMoney(plata, pais)}`,
  }
}

/**
 * «a 240 m» · «a 1,2 km».
 *
 * E07 la mete en la línea de la dirección porque «el cobrador decide el orden
 * real con ella»: con dos clientes igual de atrasados, va primero el que tiene
 * al lado. Ya existía `distanciaMetros` y las coordenadas de cada cliente venían
 * del endpoint — lo único que faltaba era enseñarlo.
 *
 * Sin GPS devuelve `null` y la línea se queda como estaba. Inventar una
 * distancia manda al cobrador a caminar mal, que es justo lo que esto viene a
 * evitar; por eso la pantalla tampoco deja ordenar por cercanía sin coordenadas.
 */
function distanciaTexto(cliente, coords) {
  if (!coords || cliente?.latitud == null || cliente?.longitud == null) return null
  const m = distanciaMetros(coords.latitud, coords.longitud, cliente.latitud, cliente.longitud)
  if (!Number.isFinite(m)) return null
  /* ⚠ POR ENCIMA DE 50 km NO SE ENSEÑA. Medido en el espejo: entre las 293
     distancias reales salían «a 331,4 km» y «a 413,4 km». Nadie recorre eso en
     una ruta a pie: son coordenadas mal capturadas —el pin quedó en otra
     ciudad, o se guardó la posición del cobrador en vez de la del cliente—.

     Callar es mejor que enseñarlas. Una distancia absurda al lado de una
     dirección correcta hace dudar de la dirección, y encima ensucia la columna
     entera para los que sí la tienen bien. La dirección sigue ahí; lo que falta
     es el metro. */
  if (m > 50_000) return null
  // Por encima del kilómetro los metros sobran: «a 1.240 m» se lee peor que
  // «a 1,2 km» y la precisión no cambia ninguna decisión.
  if (m >= 1000) return `a ${(m / 1000).toFixed(1).replace('.', ',')} km`
  // Redondeado a diez: el GPS de un teléfono no acierta al metro, y «a 237 m»
  // promete una precisión que no existe.
  return `a ${Math.max(10, Math.round(m / 10) * 10)} m`
}

export function adaptarCobrosHoy(datos, { pais, orden = 'ruta', filtros, coords } = {}) {
  const r = datos?.resumen
  const recaudado = Number(r?.recaudadoHoy ?? 0)
  const esperado = Number(r?.esperadoHoy ?? 0)
  const ordenados = ordenar(filtros ? filtrar(datos?.clientes, filtros) : datos?.clientes, orden)

  return {
    // La tarjeta de avance: lo recaudado grande, la meta y el conteo debajo.
    avance: {
      recaudado: formatMoney(recaudado, pais),
      meta: esperado > 0 ? formatMoney(esperado, pais) : null,
      cobrados: Number(r?.pagados ?? 0),
      // `total` del resumen es TODOS los clientes de la ruta, no los de hoy. Los
      // de hoy son pendientes + pagados: usar `total` diría «9 de 68 cobrados»
      // un día en que solo tocan 20.
      deCuantos: Number(r?.pagados ?? 0) + Number(r?.pendientes ?? 0),
      porcentaje: esperado > 0 ? Math.min(100, Math.round((recaudado / esperado) * 100)) : 0,
    },
    pendientes: Number(r?.pendientes ?? 0),
    grupos: agruparPorRuta(ordenados, pais).map((g) => ({ ...g, filas: g.filas.map((c) => filaDeCobro(c, { pais, coords })) })),
  }
}

/** Dos letras. Igual que en el resto del sistema.
 *
 * ⚠ SE QUEDA CON LAS PARTES QUE EMPIEZAN POR LETRA. Los clientes se nombran a
 * mano y muchos llevan delante un emoji o el número de orden: «💸 02 CARLOS
 * MENDOZA». Cogiendo las dos primeras partes salía «💸0», y encima partido:
 * `[0]` devuelve MEDIO emoji —son dos unidades de código— y el avatar acababa
 * pintando el rombo de carácter roto.
 *
 * Se veía desde antes, pero con el avatar plano no llamaba la atención; en
 * cuanto la Adenda 5 le puso el anillo de estado, el avatar pasó a ser lo
 * primero que se mira de cada fila y el fallo saltó a la vista.
 *
 * `\p{L}` con la bandera `u` es «cualquier letra en cualquier idioma», así que
 * también valen las tildes y la ñ.
 */
export function inicialesDe(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  // Las que empiezan por letra; si NINGUNA lo hace, se usan todas para no
  // devolver «·» a un cliente que se llame solo con números.
  const conLetra = partes.filter((p) => /^\p{L}/u.test(p))
  const utiles = conLetra.length ? conLetra : partes
  if (!utiles.length) return '·'
  // `[...cadena]` recorre por PUNTOS DE CÓDIGO: así un emoji o una letra fuera
  // del plano básico sale entera en vez de cortada por la mitad.
  const primera = (p) => [...p][0] ?? ''
  if (utiles.length === 1) return [...utiles[0]].slice(0, 2).join('').toUpperCase()
  return (primera(utiles[0]) + primera(utiles[1])).toUpperCase()
}

/* «11 jun → 23 sep». El tramo pactado del préstamo.

   ⚠ SE ESCRIBE COMO TRAMO Y NUNCA COMO «TERMINA EL». `fechaFin` es el plazo
   que se pactó, no el final de verdad: el préstamo se cobra hasta saldar, y un
   recargo sube la deuda sin mover esa fecha. Decir «termina el 23 de sep» sería
   prometer en la puerta algo que el sistema no cumple; la flecha dice de cuándo
   a cuándo iba el trato y deja que los días atrasados hablen por sí solos.

   Sin `fechaFin` —los modos sin plazo— devuelve solo el inicio: «desde 11 jun».
   Media verdad puesta entera vale más que una fecha inventada. */
function tramoDe(p) {
  const desde = fechaCortaDe(p?.fechaInicio)
  if (!desde) return null
  const hasta = fechaCortaDe(p?.fechaFin)
  return hasta ? `${desde} → ${hasta}` : `desde ${desde}`
}

function vidaDelPrestamo(c, pais) {
  const vivos = (c?.prestamosActivos ?? []).filter((p) => !p.esClavo)
  if (vivos.length !== 1) return null
  const p = vivos[0]
  const total = Number(p.totalAPagar ?? 0)
  if (total <= 0) return null
  const pagado = Math.max(0, Number(p.totalPagado ?? 0))
  return {
    // La frase que el cobrador repite en voz alta cuando se lo preguntan.
    pagado: formatMoney(Math.round(pagado), pais),
    total: formatMoney(Math.round(total), pais),
    tramo: tramoDe(p),
  }
}

/* Las cuatro cifras de la tira. `p` es el país, para los montos. */
function cifrasCobro(c, p) {
  const out = []
  const atraso = Number(c?.montoParaPonerseAlDia ?? 0)
  if (c?.montoParaPonerseAlDia != null) {
    out.push({ etiqueta: 'Atraso', valor: formatMoney(atraso, p), tono: atraso > 0 ? 'contra' : undefined })
  }
  // `null` mientras no le haya vencido nada: no hay nada que cumplir todavía,
  // y un «0%» pintaría al cliente más nuevo como el peor de la ruta.
  if (c?.cumplimiento != null) {
    out.push({
      etiqueta: 'Cumple',
      valor: `${c.cumplimiento}%`,
      tono: c.cumplimiento < 50 ? 'contra' : c.cumplimiento >= 100 ? 'favor' : undefined,
    })
  }
  if (c?.cuotaTexto) out.push({ etiqueta: 'Cuota', valor: c.cuotaTexto })
  const ult = fechaCortaDe(c?.ultimoPagoAt)
  // «nunca» en rojo: un cliente al que jamás se le ha cobrado nada no es lo
  // mismo que uno con la fecha vieja, y es el que hay que mirar hoy.
  out.push({ etiqueta: 'Últ. pago', valor: ult ?? 'nunca', tono: ult ? undefined : 'contra' })
  return out.length ? out : undefined
}

/* ══ UNA FILA DE COBRO, PARA LAS DOS PANTALLAS ═══════════════════════════════
   Estaba metida dentro de `adaptarCobrosHoy` como un cierre sobre `pais` y
   `coords`, así que /rutas/[id] no podía usarla y armaba su propia tarjeta —con
   nueve cifras y el número de orden de marca de agua—. Sale aquí arriba por lo
   mismo que la tarjeta salió a `components/cf/ParadaDeCobro`: es LA MISMA
   parada de LA MISMA ruta, y tenerla dos veces es tenerla mal una vez.

   Toma un cliente con la forma de /api/cobros-hoy. La ruta trae la suya y la
   iguala antes de llamar: ver `paradasDeRuta` en adaptadores/ruta.js. */
export function filaDeCobro(c, { pais, coords } = {}) {
  return {
  id: c.id,
  nombre: c.nombre,
  iniciales: inicialesDe(c.nombre),
  estado: estadoDe(c),
  etiquetaEstado: etiquetaAtraso(c.diasMora),
  /* ── LA DIRECCIÓN ESCRITA SOLO CUANDO NO HAY PUNTO EN EL MAPA ──
     El cliente que camina la ruta: «es un dato redundante tener la ubicación
     escrita y la ubicación; sería lógico que si no está la ubicación fijada,
     sí muestre la dirección escrita».

     Tiene razón donde la hay: con el punto puesto, el pin del mapa lleva a la
     puerta y la dirección solo ocupa dos renglones. Y donde no la hay, la
     dirección es lo ÚNICO que lleva a alguna parte, así que se queda.

     Medido en producción antes de tocarlo, porque el reparto decide si el
     cambio vale: **2.323 de 5.929 clientes (39%) tienen el punto fijado**, y
     2.302 de ellos tienen ADEMÁS la dirección escrita — esos son los que ganan
     los dos renglones. Los otros ~2.165 con dirección y sin punto no notan
     nada, que es exactamente lo que debe pasar.

     `direccion` O `referencia`: son DOS campos distintos y en la práctica unos
     tienen uno y otros el otro. Mirar solo `direccion` dejaba la línea con la
     pastilla sola y sin el dónde. */
  donde: (c.latitud != null && c.longitud != null)
    ? null
    : (c.direccion || c.referencia || null),
  // «a 240 m», al lado de la dirección (E07). `null` sin GPS.
  distancia: distanciaTexto(c, coords),

  /* ── EL AVISO DE MORA, EN UNA FRASE (E07) ──
     «Lleva 28 días sin pagar. Debe $960.000 en total.»

     La adenda lo pide así por una razón de dinero: la franja anterior ponía
     «28d Mora · 55 Cuotas · $960.000», tres números seguidos sin etiqueta, y
     esos $960.000 son el SALDO, no la mora. «Un cobrador que lea esa línea le
     pide al cliente casi diez veces lo que corresponde.»

     En la pantalla de hoy ese fallo ya no está —cada cifra lleva su rótulo—,
     pero la frase sigue aportando: dice de una vez cuánto lleva sin pagar y
     cuánto debe EN TOTAL, que es lo que se dice en voz alta en la puerta.
     Solo con mora de verdad: por debajo del umbral es ruido. */
  avisoMora: Number(c.diasMora ?? 0) > DIAS_MORA && Number(c.saldoTotal ?? 0) > 0
    ? { dias: Number(c.diasMora), total: formatMoney(Math.round(c.saldoTotal), pais) }
    : null,

  /* ── LOS PRÉSTAMOS, PLEGADOS (E07) ──
     «Los saldos por préstamo se pliegan y se abren solo si el cliente
     discute.» El héroe de la tarjeta es lo que se le pide HOY; el saldo es
     para la ficha, donde hay tiempo de leerlo. En la ruta es ruido caro.

     Se identifican POR FECHA: el cliente dice «el de marzo», no «el uno». */
  prestamos: (c.prestamosActivos ?? []).map((p) => ({
    id: p.id,
    // ⚠ CUÁL de ellos es el perdido. La tarjeta ya avisaba «tiene un préstamo
    // dado por perdido» y después listaba dos filas idénticas: para saber a
    // cuál no hay que volver a prestarle había que abrir las dos. Reportado por
    // el dueño con el caso delante.
    esClavo: !!p.esClavo,
    desde: fechaLargaDe(p.fechaInicio),
    // El tramo de cada uno, para cuando son varios y el de arriba no puede
    // decir un solo par de fechas.
    tramo: tramoDe(p),
    pagado: formatMoney(Math.round(p.totalPagado ?? 0), pais),
    saldo: formatMoney(Math.round(p.saldoPendiente ?? 0), pais),
    pagadoPct: p.totalAPagar > 0
      ? Math.max(0, Math.min(100, Math.round((p.totalPagado / p.totalAPagar) * 100)))
      : 0,
    // «63% pagado de $1.200.000», el pie de cada uno en la lámina.
    pagadoDe: p.totalAPagar > 0 ? formatMoney(Math.round(p.totalAPagar), pais) : null,
  })),

  /* ── LA VIDA DEL PRÉSTAMO (ago 2026) ──────────────────────────────────────
     Dos cosas que el cliente que camina la ruta pidió con el motivo, y el
     motivo es el mismo las dos veces: no tener que entrar y salir de la ficha
     estando de pie en una puerta.

       «tiene que poderse ver fácilmente la fecha de inicio y la fecha de
        finalización del préstamo»
       «hay veces que el cobrador llega y el usuario le pregunta que cuánto ya
        ha pagado; ese dato debe estar claro allí»

     ⚠ LA BARRA DEL PIE YA DECÍA ESTO, Y NO SE PODÍA LEER. La tarjeta termina
     en una barra a sangre cuyo relleno es `pagadoPct` —su comentario dice
     literal «dice CUÁNTO LLEVA PAGADO»— pero va `aria-hidden` y sin un solo
     número. O sea: el dato estaba dibujado y no estaba dicho. Esto le pone el
     rótulo a la barra que ya existía, en vez de abrir un bloque nuevo.

     Solo con UN préstamo vivo. Con varios, «del 11 jun al 23 sep» sería la
     fecha de cuál, y el total pagado mezclaría dos calendarios: ahí manda el
     plegable, que los separa uno por uno. */
  vida: vidaDelPrestamo(c, pais),
  /* ── COBRADA NO ES «PAGÓ ALGO HOY» ────────────────────────────────────────
     ⚠ ESTO BLOQUEABA COBRAR DINERO. Era `!!c.pagoHoy`, así que un cliente con
     tres préstamos que abonaba $8.000 de uno quedaba TACHADO, en verde y sin
     botón: el cobrador ya no podía registrarle el segundo abono, ni el resto
     de sus otros préstamos. Reportado: «sale como cobrado y ya no permite
     seguir cobrándole más, que está mal».

     Los dos APIs mandan los dos datos por separado desde siempre —`pagoHoy`
     es «entró plata suya hoy» y `cobroPendienteHoy` es «todavía le toca»—, y
     la tarjeta VIEJA de la ruta los distinguía con un `abonoConPendiente` que
     pintaba «Abonó hoy · sigue pendiente». Al pasar a esta tarjeta se
     colapsaron en uno, que es la misma pérdida silenciosa del `MoneyInput` y
     el modo abreviado: el rediseño se llevó lo que el componente viejo hacía
     ADEMÁS de pintarse.

     Cerrada solo cuando ya no queda nada que cobrarle hoy. */
  cobrada: (!!c.pagoHoy && !c.cobroPendienteHoy) || !!c.visitaCerradaHoy,
  /* ── CERRADA POR HOY, QUE NO ES LO MISMO QUE COBRADA ──────────────────────
     «Ya abonó lo que iba a abonar, déjame seguir.» Reportado así: si debe
     $100.000 y la cuota es de $10.000, con $20.000 ya pagó dos cuotas y no va
     a dar más — pero seguía saliendo de primero como pendiente toda la
     jornada.

     Se distingue de la cobrada porque no es lo mismo y el cobrador tiene que
     poder deshacerlo: la cobrada está saldada por hoy, esta está cerrada A
     MANO y el cliente todavía debe. Por eso lleva su propia frase y su forma
     de reabrirla si el cliente cambia de idea en la puerta.

     ⚠ NO TOCA EL DINERO. `cobroPendienteHoy` sigue como estaba, así que el
     esperado del día, el cuadre y los reportes no se mueven: la deuda no se
     encoge porque el cobrador siga camino. */
  cerradaPorHoy: !!c.visitaCerradaHoy,
  motivoCierre: c.motivoCierre ?? null,
  // Lo que llegó a entrar antes de cerrarla. Sin esto la fila cerrada no dice
  // si se fue con algo o con las manos vacías.
  abonadoAntesDeCerrar: c.visitaCerradaHoy && Number(c.montoCobradoHoy ?? 0) > 0
    ? formatMoney(Math.round(c.montoCobradoHoy), pais)
    : null,
  /* Y el caso de en medio, que es el que se perdió: pagó, pero sigue
     debiendo hoy. La fila queda VIVA —con su botón y su cuota— y lo dice, para
     que el cobrador no le cobre dos veces lo mismo sin querer. */
  abonoHoy: c.pagoHoy && c.cobroPendienteHoy && !c.visitaCerradaHoy
    ? formatMoney(Math.round(c.montoCobradoHoy ?? 0), pais)
    : null,
  /* ── LO QUE LA TARJETA VIEJA DECÍA Y ESTA SE HABÍA DEJADO ─────────────────
     Al sustituir la tarjeta de la ruta se perdieron seis cosas que la anterior
     pintaba. Tres tocan dinero y vuelven aquí, al sitio COMPARTIDO, para que
     las tengan las dos pantallas y no haya que acordarse dos veces:

       cuota extra   CAMBIA LO QUE HAY QUE COBRAR HOY. Es una cuota puntual
                     programada aparte; sin este renglón el cobrador pide la
                     cuota normal y se deja plata en la puerta.
       clavo         un préstamo dado por perdido. Sin la pastilla se lee como
                     un cliente cualquiera al que se le sigue cobrando normal.
       moratorio     interés de mora ya devengado que todavía no se ha cobrado:
                     sube lo que debe por encima de lo que dice la cuota.

     Es la tercera vez que un rediseño se lleva por delante lo que el
     componente viejo hacía ADEMÁS de pintarse —antes fueron el modo abreviado
     del `MoneyInput` y el ancla de volver a la ruta—. La lista de qué hacía el
     viejo hay que escribirla ANTES de reemplazarlo. */
  avisos: [
    Number(c.montoCuotaExtra ?? 0) > 0 && c.cuotaExtraHoy
      ? { tono: 'oro', texto: `Hoy lleva cuota extra de ${formatMoney(Math.round(c.montoCuotaExtra), pais)}` }
      : null,
    c.tieneClavo ? { tono: 'contra', texto: 'Tiene un préstamo dado por perdido' } : null,
    c.moratorioPendiente ? { tono: 'contra', texto: 'Interés moratorio pendiente' } : null,
  ].filter(Boolean),
  cuota: formatMoney(c.cuota ?? 0, pais),
  // «Cuota diaria». Sin el periodo, $8.000 no dice nada: al dia y al mes son
  // dos negocios distintos. `null` cuando el cliente tiene varios prestamos
  // con periodos distintos, que es cuando poner uno seria mentir.
  periodo: rotuloCuota(c.frecuencia),
  // «debe $160.000». La cuota sola no dice nada: $12.000 sobre una deuda de
  // $160.000 y $12.000 sobre una de $20.000 son dos visitas distintas.
  debe: Number(c.saldoTotal ?? 0) > 0 ? `debe ${formatMoney(c.saldoTotal, pais)}` : null,
  cobradoA: horaDe(c.cobradoA),
  montoCobrado: c.pagoHoy ? formatMoney(c.montoCobradoHoy ?? 0, pais) : null,
  // El último cobro del día, para poder deshacerlo sin salir de la parada.
  // Ver `app/api/cobros-hoy/route.js`: el aviso de «Deshacer» dura 10 segundos.
  pagoHoyId: c.pagoHoyId ?? null,
  // ── LA TIRA DE T03-01 ──
  // «Atraso $48.000 · Cumple 62% · Cuota 13/24 · Últ. pago 21 jun». Las
  // cuatro responden lo que el cobrador decide en la puerta: cuánto le deben
  // de más, si suele pagar, por dónde va y cuándo se le vio.
  //
  // No se pinta en el CERRADO: ya está tachado y con su hora, y volver a
  // enseñarle el atraso a alguien que acabó de pagar es ruido.
  //
  // ⚠ `cobrada`, no `pagoHoy`. Con `pagoHoy` la tarjeta del que abonó y SIGUE
  // debiendo se quedaba sin tira: se veía en el espejo al lado de una vecina
  // que sí la tenía. Y justo a ese le hace falta —el atraso es lo que se le
  // pide ahora—; el que la sobra es el cerrado.
  /* ── ⚠ LA TIRA SE QUEDA TAMBIÉN EN EL COBRADO ──
     Aquí decía: «no se pinta en el CERRADO: ya está tachado y con su hora, y
     volver a enseñarle el atraso a alguien que acabó de pagar es ruido». El
     dueño lo rebatió, y su argumento es de trabajo, no de gusto:

       «no le sale la tarjeta completa de toda la información de sus préstamos.
        Sale muy reducido […] estamos limitando la vista del orden y de la
        información que puede tener ese cliente»

     Y es cierto para el caso que importa: alguien con DOS préstamos que salda
     el de hoy sigue debiendo el otro, y la fila reducida no lo decía. Que esté
     hecha se sigue leyendo por el número verde, el nombre tachado, la hora y el
     monto en verde — cuatro señales, no hacía falta quitarle los datos. */
  cifras: cifrasCobro(c, pais),
  /* ── EL ACENTO DE ESTADO (Adenda 5 · E10) ──
     Cuánto lleva pagado del préstamo, para la barra a sangre del pie. NO es
     lo mismo que «cumple», que mira solo las cuotas ya vencidas: los dos
     acentos de la tarjeta —el anillo del avatar y la barra— solo pueden
     convivir porque dicen cosas distintas. El anillo dice CÓMO ESTÁ; la
     barra, CUÁNTO LLEVA PAGADO. */
  pagadoPct: c.pagadoPct ?? null,
}
}
