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
import { DIAS_MORA, ETIQUETA, iniciales } from '@/lib/adaptadores/clientes'

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
      estado,
      etiquetaEstado: ETIQUETA[estado],
      diasAtraso: p.diasMora > 0 ? p.diasMora : null,
      contexto: contextoDe(p, pais),
      etiquetaMonto: 'Le falta pagar',
      monto: formatMoney(p.saldoPendiente ?? 0, pais),
      porcentaje: Math.min(100, Math.max(0, Math.round(p.porcentajePagado ?? 0))),
      sinProgreso: sinCuotas,
      nota: sinCuotas ? 'pago único' : undefined,
    }
  })
}
