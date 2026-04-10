// lib/dias-sin-cobro.js — Lógica de días sin cobro (0=Dom, 1=Lun ... 6=Sáb)

/**
 * Parsea el campo diasSinCobro de la DB (JSON string o null)
 * @returns {number[]} array de días 0-6
 */
export function parsearDiasSinCobro(valor) {
  if (!valor) return null // null = no configurado, hereda
  try {
    const arr = typeof valor === 'string' ? JSON.parse(valor) : valor
    if (!Array.isArray(arr)) return null
    return arr.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
  } catch {
    return null
  }
}

/**
 * Resuelve la jerarquía: Cliente > Ruta > Organización.
 * null = no configurado (hereda). [] = explícitamente sin días (override).
 */
export function obtenerDiasSinCobro(cliente, ruta, org) {
  const c = parsearDiasSinCobro(cliente?.diasSinCobro)
  if (c !== null) return c

  const r = parsearDiasSinCobro(ruta?.diasSinCobro)
  if (r !== null) return r

  const o = parsearDiasSinCobro(org?.diasSinCobro)
  if (o !== null) return o

  return []
}

/**
 * Cuenta cuántos días excluidos hay entre fechaInicio y fechaFin (inclusive).
 * Usa cálculo matemático O(1) en vez de iterar día por día.
 */
export function contarDiasExcluidos(fechaInicio, fechaFin, diasExcluidos) {
  if (!diasExcluidos || diasExcluidos.length === 0) return 0

  const inicio = new Date(fechaInicio)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFin)
  fin.setHours(0, 0, 0, 0)

  const totalDias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)) + 1
  if (totalDias <= 0) return 0

  const semanasCompletas = Math.floor(totalDias / 7)
  const diasRestantes = totalDias % 7
  let count = semanasCompletas * diasExcluidos.length

  // Contar días excluidos en el residuo
  const diaInicio = inicio.getDay()
  for (let i = 0; i < diasRestantes; i++) {
    if (diasExcluidos.includes((diaInicio + semanasCompletas * 7 + i) % 7)) {
      count++
    }
  }

  return count
}

/**
 * Verifica si hoy (Colombia UTC-5) es un día sin cobro para este conjunto de días.
 */
export function esHoySinCobro(diasExcluidos) {
  if (!diasExcluidos || diasExcluidos.length === 0) return false
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return diasExcluidos.includes(ahora.getUTCDay())
}

/**
 * Valida y normaliza el input de diasSinCobro para guardar en DB.
 * @returns {string|null} JSON string o null
 */
export function validarDiasSinCobro(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const arr = typeof valor === 'string' ? JSON.parse(valor) : valor
  if (!Array.isArray(arr)) throw new Error('Debe ser un array')
  if (arr.length === 0) return '[]'
  const unicos = [...new Set(arr.map(Number))]
  if (unicos.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error('Días inválidos (deben ser 0-6)')
  }
  if (unicos.length > 6) throw new Error('Máximo 6 días sin cobro')
  return JSON.stringify(unicos.sort())
}

const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function nombresDias(diasArray) {
  return diasArray.map(d => NOMBRES_DIAS[d]).join(', ')
}
