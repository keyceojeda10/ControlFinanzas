// lib/adaptadores/rutas.js
//
// El puente entre lo que devuelve /api/rutas y lo que pinta <ListaRutas>.
//
// POR QUÉ UN MÓDULO APARTE Y NO DENTRO DE LA PÁGINA:
// aquí es donde viven los bugs de verdad. El componente ya está verificado
// visualmente; lo que se puede equivocar es el porcentaje, el redondeo, o —el
// caso que importa— decidir que una ruta sin cobros programados "va al 0%".
// En una función pura eso se puede probar; dentro de un JSX de 600 líneas, no.

import { formatMoney } from '@/lib/i18n'
import { abreviarMillones } from '@/lib/adaptadores/ruta'

/**
 * Una ruta a la que hoy no se le esperaba nada NO está fallando: no hay nada
 * que cumplir. Es la misma regla que ya está en la tarjeta, pero calculada
 * aquí para que la pantalla no tenga que volver a decidirlo.
 */
export function sinNadaQueCobrar(esperadoHoy) {
  return !esperadoHoy || esperadoHoy <= 0
}

/** Cumplimiento del día. Se acota a 100: cobrar de más no es cumplir 140%. */
export function porcentajeDelDia(recaudadoHoy, esperadoHoy) {
  if (sinNadaQueCobrar(esperadoHoy)) return 0
  return Math.min(100, Math.round(((recaudadoHoy || 0) / esperadoHoy) * 100))
}

/**
 * @param {Array}  rutas   respuesta cruda de GET /api/rutas
 * @param {string} pais    código de país de la organización
 */
/**
 * «Pepito · 1 de 5 cobros», y sin cobrador la pastilla lo dice.
 *
 * El conteo va por CLIENTE, no por préstamo: un cliente con tres préstamos que
 * vencen hoy es UNA visita. «3 de 5 cobros» diciendo tres visitas cuando es una
 * manda al cobrador con la cuenta mal.
 */
export function subtituloRuta(r) {
  const partes = []
  if (r?.cobrador?.nombre) partes.push(primerNombre(r.cobrador.nombre))
  const cobros = Number(r?.cobrosHoy ?? 0)
  if (cobros > 0) partes.push(`${Number(r?.cobradosHoy ?? 0)} de ${cobros} cobros`)
  return partes.join(' · ') || null
}

/**
 * La pastilla: «4 en mora» en rojo O «3 atrasados» en ámbar, NUNCA las dos.
 *
 * Dos pastillas en la misma fila obligan a sumarlas para saber cuánta gente hay
 * mal, y la que importa es la peor. Mismo umbral que el resto del sistema.
 */
export function pastillaRuta(r) {
  const mora = Number(r?.enMora ?? 0)
  if (mora > 0) return { texto: `${mora} en mora`, tono: 'mora' }
  const atr = Number(r?.atrasados ?? 0)
  if (atr > 0) return { texto: `${atr} atrasado${atr === 1 ? '' : 's'}`, tono: 'atraso' }
  return null
}

/** «jue 30». Corta porque va dentro de una línea que ya lleva dos cosas. */
export function diaCorto(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

/** Solo el primer nombre: en una línea de tres partes, el apellido no cabe. */
function primerNombre(nombre = '') {
  return String(nombre).trim().split(/\s+/)[0] || ''
}

export function adaptarRutas(rutas = [], pais) {
  return rutas.map((r) => {
    const esperado = r.esperadoHoy || 0
    const recaudado = r.recaudadoHoy || 0
    const inactiva = sinNadaQueCobrar(esperado)
    const prox = diaCorto(r.proximoCobro)

    return {
      id: r.id,
      nombre: r.nombre,
      // El componente espera un nombre o nada: `null` es lo que dispara la
      // pastilla "sin cobrador", que es un agujero y se muestra como tal.
      cobrador: r.cobrador?.nombre ?? null,
      clientes: r.cantidadClientes ?? 0,
      recaudado: formatMoney(recaudado, pais),
      // «FALTA», no «de $145.000 esperados». El pie de T27-01: «es la resta que
      // el cobrador hacía de cabeza». Y no baja de cero: cobrar más de la meta
      // no es una falta negativa, es que ya está.
      falta: formatMoney(Math.max(0, esperado - recaudado), pais),
      esperado: formatMoney(esperado, pais),
      porcentaje: porcentajeDelDia(recaudado, esperado),
      inactiva,
      // La fila colapsada de una ruta sin cobros: «Andrés · sin cobros hoy ·
      // próximo jue 30». No tiene nada de hoy que contar, así que no gasta una
      // tarjeta entera con dos cifras en cero.
      subtitulo: inactiva
        ? [r.cobrador?.nombre ? primerNombre(r.cobrador.nombre) : null,
           'sin cobros hoy',
           prox ? `próximo ${prox}` : null].filter(Boolean).join(' · ')
        : subtituloRuta(r),
      pastilla: pastillaRuta(r),

      // ── LO QUE PIDE T14-02, LA TARJETA DE ESCRITORIO ──────────────────────
      //
      // En 1440 la tarjeta tiene sitio para el estado COMPLETO de la ruta, y el
      // pie de la lámina dice por qué no va como tabla: «son cuatro, y lo que el
      // dueño mira es el estado de cada una, no compararlas fila a fila».
      //
      // Todo esto YA venía del API (`/api/rutas` lo calcula por ruta); solo no
      // se estaba leyendo. Nada de esto cuesta una consulta más.
      //
      // `cartera` es lo que la ruta tiene por cobrar, y solo la ve quien puede
      // ver capital: el endpoint la manda o no según el permiso, así que aquí
      // sale `null` para un cobrador y la tarjeta no la pinta.
      // `abreviarMillones` recibe un FORMATEADOR, no el país: por debajo del
      // millón delega en él y por encima escribe «$14,2M» a mano.
      cartera: r.totalAPagarRuta != null
        ? abreviarMillones(r.totalAPagarRuta, (n) => formatMoney(n, pais))
        : null,
      // «0 de 2» — cuántos de los cobros de hoy ya se hicieron.
      cobrosHoy: r.cobrosHoy > 0 ? `${r.cobradosHoy ?? 0} de ${r.cobrosHoy}` : null,
      // El % del día, con su tono: es el mismo número de la barra, pero escrito.
      cumple: r.cobrosHoy > 0
        ? { valor: `${porcentajeDelDia(recaudado, esperado)}%`, tono: tonoCumple(recaudado, esperado) }
        : null,
    }
  })
}

/** Verde si ya cobró todo, rojo si no ha empezado, ámbar en medio. */
function tonoCumple(recaudado, esperado) {
  const pct = porcentajeDelDia(recaudado, esperado)
  if (pct >= 100) return 'favor'
  if (pct <= 0) return 'contra'
  return undefined
}

/**
 * Los clientes sin ruta no son una fila más de la lista: son un agujero, y sus
 * cobros no salen en la pantalla de nadie. Sin monto, la tarjeta no dice cuánta
 * plata está sin recorrer.
 */
export function adaptarSinRuta(recomendaciones, pais) {
  const cantidad = recomendaciones?.totalSinRuta ?? 0
  if (cantidad <= 0) return null
  const monto = recomendaciones?.montoSinRuta
  return {
    cantidad,
    monto: monto != null ? formatMoney(monto, pais) : null,
  }
}

/**
 * «4 rutas · $34.500 de $207.500 hoy» — el subtítulo del encabezado.
 *
 * Dice de un vistazo lo que la lista solo dice sumando tarjeta por tarjeta. Con
 * cuatro rutas eso es aritmética mental; con doce es imposible.
 *
 * SE CUENTAN TODAS LAS RUTAS pero SOLO SE SUMA lo de las que hoy tienen cobros:
 * incluir el esperado de una ruta a la que hoy no le toca inflaría la meta del
 * día, que es exactamente el defecto que ya se corrigió una vez en el hero del
 * panel (sumaba una cuota de cada préstamo activo y la meta salía 5x).
 */
export function resumenDelDia(rutas = [], pais) {
  const lista = rutas || []
  if (!lista.length) return null
  const vivas = lista.filter((r) => (r.esperadoHoy || 0) > 0)
  const recaudado = vivas.reduce((s, r) => s + (r.recaudadoHoy || 0), 0)
  const esperado = vivas.reduce((s, r) => s + (r.esperadoHoy || 0), 0)

  const cuantas = `${lista.length} ruta${lista.length === 1 ? '' : 's'}`
  if (esperado <= 0) return `${cuantas} · sin cobros hoy`
  return `${cuantas} · ${formatMoney(recaudado, pais)} de ${formatMoney(esperado, pais)} hoy`
}
