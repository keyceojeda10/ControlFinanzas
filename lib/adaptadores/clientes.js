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

import { formatMoney } from '@/lib/i18n'
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
  return estado === 'mora' ? `${d}d mora` : `${d}d vencido`
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

export function adaptarClientes(clientes = [], pais) {
  return (clientes || []).map((c) => {
    const estado = estadoVisual(c)
    const saldo = Number(c.saldoPendienteTotal ?? 0)
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: iniciales(c.nombre),
      estado,
      // UNA sola pastilla, con los días dentro del texto. `diasAtraso` ya no se
      // pasa: la tarjeta no dibuja una segunda pastilla.
      etiquetaEstado: etiquetaDe(estado, c.diasMoraMax),
      contexto: contextoDe(c),
      etiquetaMonto: 'Deuda total',
      monto: formatMoney(saldo, pais),
      porcentaje: Math.min(100, Math.max(0, Math.round(c.porcentajePagadoPromedio ?? 0))),
    }
  })
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
