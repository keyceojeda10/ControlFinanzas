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
  return `CC ${c}`
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
 * ¿Se creó hoy? La API ya manda `createdAt` — no hay que tocar Prisma.
 *
 * `isHoy` compara el DÍA de calendario en la zona del país, no una ventana de
 * 24 horas: un cliente metido a las 23:50 deja de ser nuevo diez minutos
 * después. Es lo correcto para esto: «nuevo» aquí quiere decir «de la jornada
 * de hoy», que es como se piensa en un negocio que cierra caja cada día.
 */
export function esNuevo(cliente, pais) {
  if (!cliente?.createdAt) return false
  try { return isHoy(cliente.createdAt, pais) } catch { return false }
}

export function adaptarClientes(clientes = [], pais) {
  return (clientes || []).map((c) => {
    const estado = estadoVisual(c)
    const saldo = Number(c.saldoPendienteTotal ?? 0)
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: iniciales(c.nombre),
      estado,
      nuevo: esNuevo(c, pais),
      // UNA sola pastilla, con los días dentro del texto. `diasAtraso` ya no se
      // pasa: la tarjeta no dibuja una segunda pastilla.
      etiquetaEstado: etiquetaDe(estado, c.diasMoraMax),
      contexto: identidadDe(c),
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
  return [cedulaDe(cliente), cliente?.telefono, cliente?.rutaNombre]
    .filter(Boolean).join(' · ') || null
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
    cifras.push({ rotulo: 'Atraso', valor: formatMoney(mora, pais), tono: mora > 0 ? 'mora' : undefined })
  }

  // `null` cuando todavía no le ha vencido nada: no hay nada que cumplir, y un
  // «0%» lo pintaría como el peor cliente de la lista siendo el más nuevo.
  if (c?.cumplimiento != null) {
    cifras.push({
      rotulo: 'Cumple',
      valor: `${c.cumplimiento}%`,
      tono: c.cumplimiento < 50 ? 'mora' : c.cumplimiento >= 100 ? 'ganancia' : undefined,
    })
  }

  const pct = Number(c?.porcentajePagadoPromedio ?? 0)
  cifras.push({ rotulo: 'Pagado', valor: `${Math.min(100, Math.max(0, Math.round(pct)))}%` })

  const prox = proximoCobroTexto(c)
  if (prox) cifras.push({ rotulo: 'Próx. cobro', valor: prox, tono: prox === 'vencido' ? 'mora' : undefined })

  return cifras.length ? cifras : undefined
}

/** «hoy» · «vencido» · «12 ago». Cabe en una columna de un cuarto de tarjeta. */
export function proximoCobroTexto(c) {
  const iso = c?.proximoCobro
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hoy = new Date()
  const dia = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  if (dia(d) === dia(hoy)) return 'hoy'
  if (d < hoy) return 'vencido'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
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
