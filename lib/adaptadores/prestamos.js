// lib/adaptadores/prestamos.js — entre /api/prestamos y <TarjetaCliente>.
//
// LA TARJETA ES LA MISMA QUE LA DE UN CLIENTE. La adenda es explícita: un
// préstamo en lista no estrena tarjeta. Inventar una segunda obligaría al
// usuario a aprender dos objetos que se leen igual y significan lo mismo:
// alguien que te debe.
//
// Lo único propio del préstamo es qué dice la línea de contexto: en vez de la
// dirección, la cuota y cada cuánto se cobra.

import { formatMoney } from '@/lib/i18n'
import { DIAS_MORA, etiquetaDe, iniciales } from '@/lib/adaptadores/clientes'

/** A partir de acá, un préstamo ya es candidato a renovar. */
export const RENOVAR_DESDE = 80

/**
 * Mismo umbral de mora que la lista de clientes, más los dos estados que solo
 * existen en esta pantalla:
 *
 *   `pagado`  — terminado. Se apaga en gris al 60%, NO se tiñe de verde: el pie
 *               de T02-06 lo dice literal, y es la diferencia entre «va bien» y
 *               «esto ya cerró». En verde, un préstamo cerrado compite por la
 *               atención con uno al día que sí hay que seguir cobrando.
 *   `renovar` — al día y por encima del 80% pagado. Es el mejor momento para
 *               prestar de nuevo, y de ahí sale el crecimiento; la lámina le da
 *               su propia pastilla verde.
 */
export function estadoDe(p) {
  if (p?.estado === 'completado' || Number(p?.saldoPendiente ?? 0) <= 0) return 'pagado'
  const dias = p?.diasMora ?? 0
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0) return 'atraso'
  if (Number(p?.porcentajePagado ?? 0) >= RENOVAR_DESDE) return 'renovar'
  return 'aldia'
}

/**
 * Qué dice la pastilla. `renovar` y `pagado` NO llevan días: uno es una
 * oportunidad y el otro un cierre, y en ninguno de los dos «0d» significa algo.
 */
export function etiquetaPrestamo(estado, dias) {
  if (estado === 'pagado') return 'Pagado'
  if (estado === 'renovar') return 'Renovar'
  return etiquetaDe(estado, dias)
}

/** «Semanal», «Diario»… con mayúscula, como los escribe la lámina. */
const FRECUENCIA = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

/**
 * «Semanal 20% · cuota 13 de 24 · Ruta #1».
 *
 * ESTO ERA «$20.000 diarios · Ruta 2», y la diferencia importa: la cuota ya está
 * en la tarjeta —es el monto de la derecha— así que repetirla en la línea de
 * contexto gastaba el sitio dos veces. Lo que NO estaba en ningún lado es la
 * TASA y POR DÓNDE VA: un préstamo al 20% en la cuota 13 de 24 y otro al 15% en
 * la 2 de 24 se veían idénticos.
 *
 * `terminado 12 de jul` en vez de la cuota cuando ya está pagado: decir «cuota 24
 * de 24» de algo cerrado es cierto y no sirve; la fecha sí.
 */
export function contextoDe(p, pais, { pagado = false } = {}) {
  const partes = []

  const frec = FRECUENCIA[p?.frecuencia] || null
  const tasa = Number(p?.tasaInteres ?? 0)
  if (frec || tasa > 0) {
    partes.push([frec, tasa > 0 ? `${formatearTasa(tasa)}%` : null].filter(Boolean).join(' '))
  }

  if (pagado) {
    const fin = p?.fechaFin ? fechaCorta(p.fechaFin) : null
    if (fin) partes.push(`terminado ${fin}`)
  } else {
    const total = Number(p?.totalCuotas ?? 0)
    const pend = Number(p?.cuotasPendientes ?? 0)
    if (total > 0 && pend >= 0) {
      // La cuota EN CURSO, no las pagadas: con 11 pagadas de 24, el cobrador va
      // a por la 12. `min` porque en el último pago pendientes llega a 0 y
      // «cuota 25 de 24» no existe.
      const actual = Math.min(total, Math.max(1, total - pend + 1))
      partes.push(`cuota ${actual} de ${total}`)
    }
  }

  const ruta = p?.cliente?.ruta?.nombre ?? p?.rutaNombre
  if (ruta) partes.push(ruta)
  return partes.join(' · ') || null
}

/** «20» y no «20.00»; «7,5» con coma, que es como se escribe en Colombia. */
export function formatearTasa(tasa) {
  const n = Number(tasa)
  if (!Number.isFinite(n)) return ''
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}

/** «12 de jul». Corta a propósito: la línea ya lleva dos cosas más. */
export function fechaCorta(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
}

/**
 * Lo que va a la derecha del monto: «de $1.200.000 · 54% pagado».
 *
 * Sin el total, el saldo no significa nada: $160.000 pendientes puede ser un
 * préstamo de $1.200.000 casi saldado o uno de $200.000 recién entregado, y son
 * dos decisiones opuestas sobre si vale la pena ir hoy.
 *
 * Si no hay total —no debería, pero el pago único y los legacy dan sorpresas— se
 * cae al porcentaje solo en vez de escribir «de $0».
 */
export function detalleDe(p, pais) {
  const total = Number(p?.totalAPagar ?? 0)
  const pct = Math.min(100, Math.max(0, Math.round(p?.porcentajePagado ?? 0)))
  if (!(total > 0)) return `${pct}% pagado`
  return `de ${formatMoney(total, pais)} · ${pct}% pagado`
}

export function adaptarPrestamos(prestamos = [], pais) {
  return (prestamos || []).map((p) => {
    const estado = estadoDe(p)
    // El pago único no tiene cuotas: marcaría 0% durante todo el plazo, y una
    // lista llena de barras vacías es una alarma falsa. Se le quita la barra.
    const sinCuotas = !(p.cuotaDiaria > 0)
    return {
      id: p.id,
      nombre: p.cliente?.nombre ?? 'Sin cliente',
      iniciales: iniciales(p.cliente?.nombre),
      // T02-06 dibuja esta tarjeta SIN avatar y SIN rótulo sobre el monto: el
      // dueño ya sabe de quién es, y ese ancho se lo lleva la línea de
      // condiciones, que es más larga que la de un cliente. Las iniciales
      // siguen viajando por si la consume otra pantalla que sí las use.
      variante: 'prestamo',
      estado,
      etiquetaEstado: etiquetaPrestamo(estado, p.diasMora),
      contexto: contextoDe(p, pais, { pagado: estado === 'pagado' }),
      monto: formatMoney(p.saldoPendiente ?? 0, pais),
      // «de $1.200.000 · 54% pagado», literal de la lámina. El saldo solo no
      // dice nada: $160.000 pendientes puede ser un préstamo casi saldado o uno
      // pequeño recién dado, y la diferencia decide si vale la pena ir a cobrar.
      detalle: detalleDe(p, pais),
      porcentaje: Math.min(100, Math.max(0, Math.round(p.porcentajePagado ?? 0))),
      sinProgreso: sinCuotas,
      nota: sinCuotas ? 'pago único' : undefined,
    }
  })
}

/**
 * Las tres cifras de arriba en T02-06: EN LA CALLE · EN MORA · COBRADO MES.
 *
 * Responden lo que la lista NO puede: recorriendo 68 tarjetas no se sabe cuánto
 * hay en total en la calle ni cuánto está atascado.
 *
 * SE SUMA SOBRE LA PÁGINA QUE SE ESTÁ VIENDO cuando no hay totales del servidor,
 * y en ese caso hay que decirlo — un «$38.4M» que en realidad es la suma de 50
 * de 68 préstamos es exactamente la clase de cifra que hace desconfiar de la app
 * entera. Por eso `parcial`.
 *
 * `cobradoMes` no se puede derivar de la lista: es del resumen del dashboard. Se
 * omite si no llega, en vez de poner un $0 que se leería como «no cobré nada».
 */
export function tresCifras(prestamos = [], pais, { totales = null, cobradoMes = null } = {}) {
  const lista = prestamos || []
  const enLaCalle = totales?.saldoPorCobrar
    ?? lista.reduce((s, p) => s + Number(p.saldoPendiente ?? 0), 0)
  const enMora = totales?.saldoEnMora
    ?? lista.filter((p) => Number(p.diasMora ?? 0) > 0)
            .reduce((s, p) => s + Number(p.saldoPendiente ?? 0), 0)

  return {
    enLaCalle: formatMoney(enLaCalle, pais),
    enMora: enMora > 0 ? formatMoney(enMora, pais) : formatMoney(0, pais),
    cobradoMes: cobradoMes != null ? formatMoney(cobradoMes, pais) : null,
    parcial: !totales,
  }
}
