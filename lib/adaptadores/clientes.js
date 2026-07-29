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

/** Por encima de esto, ya no es un atraso: es mora. Umbral del propio sistema. */
export const DIAS_MORA = 7

export function estadoVisual(cliente) {
  const dias = cliente?.diasMoraMax ?? 0
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0 || cliente?.estado === 'mora') return 'atraso'
  return 'aldia'
}

export const ETIQUETA = { mora: 'En mora', atraso: 'Atraso leve', aldia: 'Al día' }

/** Dos letras. Más se lee como una palabra rota. */
export function iniciales(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/**
 * "Bolivariana · Cl 8 # 31-05" — ruta y dónde vive.
 * Se omite la parte que falte en vez de dejar el separador colgando.
 */
export function contextoDe(cliente) {
  return [cliente?.rutaNombre, cliente?.referencia].filter(Boolean).join(' · ') || null
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
      etiquetaEstado: ETIQUETA[estado],
      // Solo cuando hay atraso: un "0d" al lado del nombre es ruido.
      diasAtraso: c.diasMoraMax > 0 ? c.diasMoraMax : null,
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
