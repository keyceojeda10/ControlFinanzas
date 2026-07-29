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

const CADA = {
  diario: 'diarios',
  semanal: 'semanales',
  quincenal: 'quincenales',
  mensual: 'mensuales',
}

/** Mismo umbral que la lista de clientes: el que ya usaba el sistema. */
export function estadoDe(p) {
  const dias = p?.diasMora ?? 0
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0) return 'atraso'
  return 'aldia'
}

/**
 * "$20.000 diarios · Ruta 2". Sin cuota —el pago único no la tiene— se dice el
 * modo en vez de dejar un hueco o inventar un "$0 diarios".
 */
export function contextoDe(p, pais) {
  const partes = []
  if (p?.cuotaDiaria > 0) {
    partes.push(`${formatMoney(p.cuotaDiaria, pais)} ${CADA[p.frecuencia] || ''}`.trim())
  } else {
    partes.push('Pago único')
  }
  const ruta = p?.cliente?.ruta?.nombre ?? p?.rutaNombre
  if (ruta) partes.push(ruta)
  return partes.join(' · ')
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
      etiquetaEstado: etiquetaDe(estado, p.diasMora),
      contexto: contextoDe(p, pais),
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
