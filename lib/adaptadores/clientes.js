// lib/adaptadores/clientes.js — entre /api/clientes y <TarjetaCliente>.
//
// LA DECISIÓN QUE SE TOMA AQUÍ: el sistema solo distingue `mora` o `activo`, y
// `estado === 'mora'` es exactamente `diasMoraMax > 0` — son la misma señal. El
// rediseño tiene TRES estados, así que hace falta un corte entre "va atrasado"
// y "esto ya es mora".
//
// NO SE INVENTA: el umbral de 7 días es el que la app ya usaba para pintar de
// rojo en vez de naranja (`moodColorCompacto`). Se reusa tal cual, para que la
// tarjeta nueva y la vieja no clasifiquen distinto al mismo cliente.

import { formatMoney, isHoy } from '@/lib/i18n'
import { abreviaturaDocumento } from '@/lib/documento'
// El detector de marcadores es del importador: reconoce las cedulas «SIN-…» que
// el mismo genera cuando el cuaderno no las trae. Se reusa en vez de repetir el
// patron en dos sitios que luego se desincronizan.
import { esMarcador } from '@/lib/importar/aCargaMasiva'

/** Por encima de esto, ya no es un atraso: es mora. Umbral del propio sistema. */
export const DIAS_MORA = 7

export function estadoVisual(cliente) {
  const dias = cliente?.diasMoraMax ?? 0
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0 || cliente?.estado === 'mora') return 'atraso'
  return 'aldia'
}

export const ETIQUETA = { mora: 'En mora', atraso: 'Atraso leve', aldia: 'Al día' }

/**
 * El texto de la pastilla, con los días DENTRO: «10d mora», «6d vencido»,
 * «Al día». Es lo que dibuja T02-05, y T02-06 lo repite («36d mora»).
 *
 * ANTES ERAN DOS PASTILLAS: el estado en la primera línea y los días en la
 * segunda. Una tarjeta con riel de color, dos pastillas y una barra tiene cuatro
 * cosas diciendo lo mismo, y la segunda pastilla además le robaba el sitio a la
 * línea de contexto.
 *
 * El caso raro que hay que cubrir: `estadoVisual` devuelve 'atraso' también
 * cuando la base dice `estado === 'mora'` con CERO días. Sin la guardia, la
 * pastilla escribiría «0d vencido», que no es nada.
 */
export function etiquetaDe(estado, dias) {
  const d = Number(dias ?? 0)
  if (estado === 'aldia' || d <= 0) return ETIQUETA[estado] ?? ETIQUETA.aldia
  // SOLO LOS DÍAS, como la dibujan T03-03 y T03-04: «36d», no «36d mora».
  // La palabra la dice ya el color —rojo o ámbar— y sobraban ~40px que se lleva
  // la línea de identidad: con «36d mora» el teléfono no cabía y salía «CC
  // 8117692…», que es justo el dato que la lámina subió ahí para que se vea.
  return `${d}d`
}

/** Dos letras. Más se lee como una palabra rota. */
export function iniciales(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/**
 * «CC 81283812 · 3 préstamos» — con quién estoy y cuántas deudas tiene abiertas.
 * Se omite la parte que falte en vez de dejar el separador colgando.
 *
 * EL CONTEO IMPORTA porque la tarjeta enseña «Deuda total», que con tres
 * préstamos es una suma: sin el número, un cliente con tres créditos abiertos y
 * uno con uno se ven idénticos, y son dos riesgos muy distintos.
 *
 * Lo de la cédula, y por qué se fueron la ruta y la dirección, en `cedulaDe`.
 */
export function contextoDe(cliente) {
  const n = Number(cliente?.prestamosActivos ?? 0)
  // Acá SÍ se escribe «1 préstamo». En la lámina las tres tarjetas lo llevan,
  // incluida «CC 43987112 · 1 préstamo»: con la cédula delante, la línea ya no
  // es solo el conteo, y omitirlo dejaría un «CC 43987112 ·» colgando.
  const cuantos = n > 0 ? `${n} préstamo${n === 1 ? '' : 's'}` : null
  return [cedulaDe(cliente), cuantos].filter(Boolean).join(' · ') || null
}

/**
 * «CC 81283812», y NADA cuando la cédula es un marcador de importación.
 *
 * ESTO ERA «3 préstamos · Ruta sur · Cl 30 # 7-22» y la lámina pone «CC
 * 81283812 · 3 préstamos». El cambio no es cosmético: el buscador de esta
 * pantalla dice «Nombre o cédula», así que la cédula es la clave con la que se
 * busca, y verla al lado del nombre es lo que confirma que se encontró a la
 * persona correcta cuando hay dos «María Fernanda».
 *
 * La ruta y la dirección se van de acá, y no se pierden: están en «Cobrar hoy»,
 * que es la pantalla donde se camina. Con tres cosas en una línea `nowrap`, la
 * tercera se truncaba siempre de todas formas.
 *
 * EL MARCADOR NO SE ESCRIBE. La importación de un cuaderno sin cédulas genera
 * `SIN-001`, `SIN-002`… y pintar «CC SIN-012» es peor que no poner nada: parece
 * un dato y no lo es. Son 68 clientes reales en la cartera de prueba.
 */
export function cedulaDe(cliente) {
  const c = String(cliente?.cedula ?? '').trim()
  if (!c || esMarcador(c)) return null
  /* «CC» era literal, y este adaptador alimenta la lista de clientes ENTERA: en
     una organización argentina se leían cincuenta «CC 9588665688» donde el
     documento se llama DNI. `abreviaturaDocumento()` lo saca del país activo. */
  return `${abreviaturaDocumento()} ${c}`
}

/**
 * ── QUIÉN LO CREÓ, EN VEZ DE LA CÉDULA ──
 *
 * Pedido por el usuario. La línea de contexto es UNA sola y `nowrap` a
 * propósito —con la dirección dentro, las tarjetas cambiaban de alto según lo
 * larga que fuera—, así que meter el cobrador obliga a decidir qué se cae.
 *
 * Se cae la cédula, y no es arbitrario: la cédula sirve para CONFIRMAR que se
 * encontró a la persona correcta cuando hay dos «María Fernanda», y eso solo
 * importa mientras se busca. Quién lo metió importa siempre, y es la pregunta
 * que se hace el dueño cuando ve un cliente que no reconoce.
 *
 * Cuando no se sabe quién lo creó —los cobradores no reciben ese dato de la
 * API— vuelve la cédula, que es lo que había.
 */
export function contextoConAutor(cliente) {
  const n = Number(cliente?.prestamosActivos ?? 0)
  const cuantos = n > 0 ? `${n} préstamo${n === 1 ? '' : 's'}` : null
  const autor = cliente?.creadoPor?.nombre
    ? primerNombre(cliente.creadoPor.nombre)
    : cedulaDe(cliente)
  return [autor, cuantos].filter(Boolean).join(' · ') || null
}

/** «Ana María Restrepo» → «Ana María». Dos nombres caben; cuatro, no. */
function primerNombre(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).join(' ')
}

/**
 * ¿Se creó en las ÚLTIMAS 24 HORAS? La API ya manda `createdAt`.
 *
 * ── POR QUÉ 24 HORAS Y NO «HOY» ────────────────────────────────────────────
 * Esto usaba `isHoy`, que compara el DÍA DE CALENDARIO. Suena razonable —«la
 * jornada de hoy», como se cierra la caja— pero en la práctica un cliente
 * metido a las 23:50 dejaba de ser nuevo DIEZ MINUTOS después, y otro metido a
 * las 00:10 seguía siéndolo veinticuatro horas. El mismo rótulo duraba entre
 * diez minutos y un día entero según la hora en que se tecleara.
 *
 * El dueño lo pidió explícito: «creados en las últimas 24 horas; después de ese
 * tiempo ya no serían nuevos». Así dura lo mismo para todos.
 *
 * Se compara en milisegundos, así que no depende de la zona horaria: una resta
 * de instantes da igual desde qué país se mire. Eso evita de paso la trampa de
 * las fechas de este proyecto (prod corre en UTC y dev en Bogotá).
 */
export function esNuevo(cliente) {
  const iso = cliente?.createdAt
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  const transcurrido = Date.now() - t
  // El futuro no cuenta como nuevo: un `createdAt` adelantado por reloj
  // desajustado dejaría la etiqueta pegada para siempre.
  return transcurrido >= 0 && transcurrido < 24 * 60 * 60 * 1000
}

export function adaptarClientes(clientes = [], pais) {
  return (clientes || []).map((c) => {
    const estado = estadoVisual(c)
    const saldo = Number(c.saldoPendienteTotal ?? 0)
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: iniciales(c.nombre),
      // `/api/clientes` la manda desde el primer día (`route.js:268`) y este
      // adaptador la tiraba: la tarjeta enseñaba las iniciales de todo el
      // mundo. Reportado por el dueño el 2 de agosto.
      foto: c.fotoUrl || null,
      estado,
      nuevo: esNuevo(c),
      // UNA sola pastilla, con los días dentro del texto. `diasAtraso` ya no se
      // pasa: la tarjeta no dibuja una segunda pastilla.
      etiquetaEstado: etiquetaDe(estado, c.diasMoraMax),
      contexto: identidadDe(c),
      // Lo mismo en piezas, para pintarlo con icono. La cadena se queda porque
      // la usan el buscador y las pantallas sin migrar.
      piezas: piezasDeCliente(c),
      monto: formatMoney(saldo, pais),
      // «3 préstamos», bajo el monto. Era la mitad de la línea de contexto; el
      // turno 03 lo baja aquí y deja esa línea para identificar a la persona.
      detalle: cuantosPrestamos(c),
      cifras: cifrasCliente(c, pais),
      porcentaje: Math.min(100, Math.max(0, Math.round(c.porcentajePagadoPromedio ?? 0))),
    }
  })
}

/**
 * La línea de identidad de T03-03: «CC 81283812 · 310 452 1188 · Ruta sur».
 *
 * El pie de la lámina lo dice: «el teléfono y la ruta suben a la línea de
 * identidad, y el buscador ahora busca también por teléfono». Antes esta línea
 * llevaba quién creó al cliente y cuántos préstamos tiene — dos cosas que no
 * sirven para reconocerlo cuando lo tienes delante. El teléfono sí: es con lo
 * que se le llama desde la calle.
 */
export function identidadDe(cliente) {
  // QUIÉN LO CREÓ, igual que en la tarjeta de préstamo. El dueño lo pidió para
  // las dos y solo se hizo en una: «en la tarjeta de los clientes no se ve
  // quién creó ese cliente».
  //
  // `/api/clientes` ya lo manda resuelto a nombre (`route.js:280`), salvo a los
  // cobradores —a ellos el endpoint ni lo consulta (`:166`)— así que en su
  // sesión la parte simplemente no sale, que es lo correcto.
  //
  // Solo el nombre de pila, como en préstamos: la línea ya lleva tres cosas.
  const autor = (cliente?.creadoPor?.nombre || '').trim().split(/\s+/)[0].replace(/[.,;:]+$/, '')
  return [
    cedulaDe(cliente), cliente?.telefono, cliente?.rutaNombre,
    autor ? `creó ${autor}` : null,
  ].filter(Boolean).join(' · ') || null
}

/**
 * LO MISMO, EN PIEZAS, para pintarlo con icono en vez de puntos medios.
 *
 * Ver `piezasDe` en `lib/adaptadores/prestamos.js`: mismo motivo. Cuatro datos
 * en una cadena gris no se distinguen, y una vez unidos no se pueden separar
 * —hay rutas guardadas como «RUTA. #. 5», con puntos dentro—.
 */
export function piezasDeCliente(cliente) {
  const autor = (cliente?.creadoPor?.nombre || '').trim().split(/\s+/)[0].replace(/[.,;:]+$/, '')
  return {
    cedula: cedulaDe(cliente) || null,
    telefono: cliente?.telefono || null,
    // «SIN RUTA» EN VEZ DE UN HUECO. En la tabla de PC la celda salía en blanco
    // y el dueño lo reportó: no se distingue de un dato que falta por cargar. Un
    // cliente sin ruta es un estado REAL —y accionable: hay que asignarle una—,
    // así que se dice con palabras.
    ruta: cliente?.rutaNombre || 'Sin ruta',
    autor: autor || null,
  }
}

export function cuantosPrestamos(cliente) {
  const n = Number(cliente?.prestamosActivos ?? 0)
  return n > 0 ? `${n} préstamo${n === 1 ? '' : 's'}` : null
}

/**
 * La tira de T03-03: ATRASO · CUMPLE · PAGADO · PRÓX. COBRO.
 *
 * Las cuatro responden preguntas distintas sobre la misma persona: cuánto debe
 * de más, si suele pagar, cuánto lleva devuelto y cuándo vuelve a tocar. Es lo
 * que el pie llama «cifras de dueño», y de ahí sale el filtro «Cumple <50%»:
 * la lista de a quién no conviene renovarle.
 */
export function cifrasCliente(c, pais) {
  const cifras = []

  const mora = Number(c?.montoEnMora ?? 0)
  if (c?.montoEnMora != null) {
  /* ── «ATRASO» SOLO SI DE VERDAD VA ATRASADO ───────────────────────────
     La pastilla dice «Al día» —que mira los DÍAS de mora— y esta cifra decía
     «ATRASO $105.000» al lado. Las dos son ciertas y se leen como una
     contradicción, que es de donde salen las preguntas.

     Sin días de mora la plata que falta viene de un pago PARCIAL: pagó, pero
     de menos. Eso no es ir atrasado, es quedarse corto — y tiene su palabra.

     ⚠ `clave` para que las tablas de PC lo encuentren aunque el rótulo cambie:
     buscaban la cifra por su texto. */
    cifras.push({ clave: 'atraso', etiqueta: Number(c?.diasMoraMax ?? 0) > 0 ? 'Atraso' : 'Le falta',
      valor: formatMoney(mora, pais), tono: mora > 0 ? 'contra' : undefined })
  }

  // `null` cuando todavía no le ha vencido nada: no hay nada que cumplir, y un
  // «0%» lo pintaría como el peor cliente de la lista siendo el más nuevo.
  if (c?.cumplimiento != null) {
    cifras.push({
      etiqueta: 'Cumple',
      valor: `${c.cumplimiento}%`,
      tono: c.cumplimiento < 50 ? 'contra' : c.cumplimiento >= 100 ? 'favor' : undefined,
    })
  }

  const pct = Number(c?.porcentajePagadoPromedio ?? 0)
  cifras.push({ etiqueta: 'Pagado', valor: `${Math.min(100, Math.max(0, Math.round(pct)))}%` })

  /* «Cobra el», no «Próx. cobro»: con cuatro cifras en la tira, un cuarto de
     393px da para 69px de rótulo y «PRÓX. COBRO» pide 73 — salía «PRÓX. COB…».
     Es el mismo tropiezo que `ClienteHeroCard.jsx:470` ya había resuelto con
     esta misma palabra, así que se dice igual en los dos sitios.

     ⚠ Este rótulo es también la CLAVE con la que la tabla de escritorio busca
     la cifra (`clientes/page.jsx`, `dameCifra(a, …)`). Cambiarlo aquí y no allí
     deja la columna vacía sin que nadie se entere. */
  const prox = cifraProximoCobro(c)
  if (prox) cifras.push(prox)

  return cifras.length ? cifras : undefined
}

/* ── ⚠ EL «DE» QUE SOBRA ─────────────────────────────────────────────────
   Las dos funciones que escriben una fecha corta dicen en su docstring «12 ago»
   y estaban devolviendo «12 de ago»: el `es-CO` de las versiones nuevas de ICU
   mete la preposición donde antes no estaba. No lo cambió nadie aquí — cambió
   debajo, y la app se enteró en la pantalla.

   Cuesta 12px de más, y en una tira de cuatro columnas de 74px eso es que la
   cifra ya no cabe: medido en el espejo, «29 de ago» salía recortado a «29 de
   agc». Es el mismo defecto que ya se corrigió llamando «Cobra el» a lo que
   quería llamarse «Próx. cobro».

   Se quita el «de», no se abrevia el mes: una fecha a medias no se lee. */
const sinPreposicion = (s) => String(s).replace(' de ', ' ')

/* ══ CUÁNDO SE COBRA, Y CÓMO SE DICE ══════════════════════════════════════
 *
 * ⚠ EL RÓTULO CAMBIA CON LA SITUACIÓN, y no es cosmético: el rótulo y el valor
 * se leen JUNTOS, uno encima del otro, y con un rótulo fijo salían frases que
 * no existen en castellano. El dueño lo reportó con la captura:
 *
 *     COBRA EL          COBRA EL
 *     hoy       ← mal   vencido    ← mal
 *
 * «Cobra el hoy» no se dice, y «cobra el vencido» además NO INFORMA: esconde el
 * único dato que sirve, que es QUÉ DÍA venció. Un cobrador que lee «vencido» no
 * sabe si fue ayer o hace tres semanas.
 *
 *     COBRA             VENCIÓ EL      COBRA EL
 *     hoy               14 jul         19 ago
 *
 * Vive AQUÍ y no en cada pantalla porque son cuatro las que lo pintan —la lista
 * de clientes, la de préstamos, la tabla de escritorio y la ficha del cliente—
 * y con la regla repetida cuatro veces, la quinta la escribe distinta.
 */
export function estadoDelCobro(c) {
  const iso = c?.proximoCobro
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hoy = new Date()
  const dia = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const manana = new Date(hoy.getTime() + 86400000)
  const fecha = sinPreposicion(
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', ''))

  if (dia(d) === dia(hoy)) return { estado: 'hoy', fecha }
  if (d < hoy) return { estado: 'vencido', fecha }
  if (dia(d) === dia(manana)) return { estado: 'manana', fecha }
  return { estado: 'futuro', fecha }
}

/**
 * La columna de la tira, con su rótulo ya adaptado.
 *
 * ⚠ `clave` existe para que las pantallas puedan BUSCARLA aunque el rótulo
 * cambie: la tabla de escritorio hacía `dameCifra(a, 'Cobra el')` y con el
 * rótulo variable esa columna se habría quedado vacía en las filas vencidas
 * —sin error, solo en blanco— que es justo como se pierden los datos aquí.
 */
export function cifraProximoCobro(c) {
  const e = estadoDelCobro(c)
  if (!e) return null
  if (e.estado === 'vencido') return { clave: 'cobro', etiqueta: 'Venció el', valor: e.fecha, tono: 'contra' }
  if (e.estado === 'hoy') return { clave: 'cobro', etiqueta: 'Cobra', valor: 'hoy', tono: 'oro' }
  if (e.estado === 'manana') return { clave: 'cobro', etiqueta: 'Cobra', valor: 'mañana' }
  return { clave: 'cobro', etiqueta: 'Cobra el', valor: e.fecha }
}

/** «hoy» · «vencido» · «12 ago». Se queda porque lo usan el buscador y las
 *  pruebas; para PINTAR la tira, `cifraProximoCobro`. */
export function proximoCobroTexto(c) {
  const e = estadoDelCobro(c)
  if (!e) return null
  if (e.estado === 'hoy') return 'hoy'
  if (e.estado === 'vencido') return 'vencido'
  return e.fecha
}


/**
 * El pie de lista dice lo que NO se está viendo, con su monto.
 * Un "Ver todos" pelado deja al dueño creyendo que la lista es toda su cartera.
 */
export function truncado(visibles, todos, pais) {
  const total = todos?.length ?? 0
  if (visibles >= total) return null
  const faltante = todos
    .slice(visibles)
    .reduce((suma, c) => suma + Number(c.saldoPendienteTotal ?? 0), 0)
  return { visibles, total, montoFaltante: formatMoney(faltante, pais) }
}
