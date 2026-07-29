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

/** Los tres órdenes de T02-02. `cerca` necesita GPS: ver `ordenar`. */
export const ORDENES = [
  { id: 'ruta',       nombre: 'Orden de ruta' },
  { id: 'atrasados',  nombre: 'Más atrasados' },
  { id: 'cerca',      nombre: 'Cerca de mí' },
]

/** Mismo umbral que el resto del sistema: por encima de 7 días ya es mora. */
export function estadoDe(cliente) {
  const dias = Number(cliente?.diasMora ?? 0)
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0) return 'atraso'
  return 'aldia'
}

/**
 * «36d de atraso», y en singular «1d de atraso».
 *
 * OJO: acá NO se dice «mora» como en la lista de clientes. La lámina de esta
 * pantalla escribe «de atraso» en los tres casos, y es coherente con para qué
 * sirve: al cobrador en la puerta le importa cuántos días lleva sin pagar, no la
 * clasificación contable. El color ya dice la gravedad.
 */
export function etiquetaAtraso(dias) {
  const d = Number(dias ?? 0)
  if (d <= 0) return 'Al día'
  return `${d}d de atraso`
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

export function adaptarCobrosHoy(datos, { pais, orden = 'ruta' } = {}) {
  const r = datos?.resumen
  const recaudado = Number(r?.recaudadoHoy ?? 0)
  const esperado = Number(r?.esperadoHoy ?? 0)
  const ordenados = ordenar(datos?.clientes, orden)

  const filaDe = (c) => ({
    id: c.id,
    nombre: c.nombre,
    iniciales: inicialesDe(c.nombre),
    estado: estadoDe(c),
    etiquetaEstado: etiquetaAtraso(c.diasMora),
    // `direccion` O `referencia`: son DOS campos distintos del cliente y en la
    // práctica unos tienen uno y otros el otro. Yo miraba solo `direccion`, así
    // que la segunda línea salía con la pastilla sola y sin el dónde — que en
    // una pantalla para caminar es justo lo que hace falta.
    donde: c.direccion || c.referencia || null,
    cobrada: !!c.pagoHoy,
    cuota: formatMoney(c.cuota ?? 0, pais),
    // «debe $160.000». La cuota sola no dice nada: $12.000 sobre una deuda de
    // $160.000 y $12.000 sobre una de $20.000 son dos visitas distintas.
    debe: Number(c.saldoTotal ?? 0) > 0 ? `debe ${formatMoney(c.saldoTotal, pais)}` : null,
    cobradoA: horaDe(c.cobradoA),
    montoCobrado: c.pagoHoy ? formatMoney(c.montoCobradoHoy ?? 0, pais) : null,
  })

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
    grupos: agruparPorRuta(ordenados, pais).map((g) => ({ ...g, filas: g.filas.map(filaDe) })),
  }
}

/** Dos letras. Igual que en el resto del sistema. */
function inicialesDe(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
