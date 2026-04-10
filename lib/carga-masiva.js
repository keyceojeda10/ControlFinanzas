// lib/carga-masiva.js — Lógica de parseo y validación para carga masiva
//
// Una cédula puede aparecer varias veces (un cliente con múltiples préstamos).
// Cada fila es: datos del cliente + (opcionalmente) un préstamo.
// Al importar se agrupan por cédula: se crea el cliente UNA vez y N préstamos.

import { calcularPrestamo } from '@/lib/calculos'

const COLUMNAS = [
  'nombre', 'cedula', 'telefono', 'direccion', 'referencia',
  'tipo', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'frecuencia',
  'fechaInicio', 'abonadoHasta',
]

const FRECUENCIAS_VALIDAS = ['diario', 'semanal', 'quincenal', 'mensual']
const TIPOS_VALIDOS = ['prestamo', 'mercancia']

/**
 * Normaliza una fecha en varios formatos a YYYY-MM-DD.
 */
export function normalizarFecha(valor) {
  if (!valor) return null
  const s = String(valor).trim()

  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000)
    return d.toISOString().slice(0, 10)
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (ymd) {
    const [, yyyy, mm, dd] = ymd
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  return null
}

/**
 * Normaliza la frecuencia (acepta variantes comunes)
 */
function normalizarFrecuencia(valor) {
  if (!valor) return 'diario'
  const s = String(valor).trim().toLowerCase()
  const alias = {
    diario: 'diario', d: 'diario', dia: 'diario', daily: 'diario',
    semanal: 'semanal', s: 'semanal', semana: 'semanal', weekly: 'semanal',
    quincenal: 'quincenal', q: 'quincenal', quincena: 'quincenal',
    mensual: 'mensual', m: 'mensual', mes: 'mensual', monthly: 'mensual',
  }
  return alias[s] || null
}

/**
 * Normaliza el tipo de préstamo
 */
function normalizarTipo(valor) {
  if (!valor) return 'prestamo'
  const s = String(valor).trim().toLowerCase()
  const alias = {
    prestamo: 'prestamo', préstamo: 'prestamo', p: 'prestamo', dinero: 'prestamo',
    mercancia: 'mercancia', mercancía: 'mercancia', m: 'mercancia', articulo: 'mercancia',
  }
  return alias[s] || null
}

/**
 * Valida una fila individual.
 * cedulasExistentes = Map<cedula, { id, nombre, estado }>
 * (no validamos duplicados internos — se permite repetir cédula para N préstamos)
 */
export function validarFila(fila, indice, cedulasExistentes) {
  const errores = []
  const advertencias = []

  // --- Nombre ---
  const nombre = String(fila.nombre ?? '').trim()
  if (!nombre) errores.push('Nombre es requerido')

  // --- Cédula ---
  const cedula = String(fila.cedula ?? '').replace(/\D/g, '')
  if (!cedula) {
    errores.push('Cédula es requerida')
  } else if (cedula.length < 6 || cedula.length > 12) {
    errores.push('Cédula debe tener entre 6 y 12 dígitos')
  } else {
    const existente = cedulasExistentes.get(cedula)
    if (existente) {
      advertencias.push(`Cliente "${existente.nombre}" ya existe. Se agregarán los préstamos al cliente existente.`)
    }
  }

  // --- Teléfono (opcional) ---
  const telefono = fila.telefono ? String(fila.telefono).replace(/\D/g, '') : null
  if (telefono && (telefono.length !== 10 || !telefono.startsWith('3'))) {
    advertencias.push('Teléfono no parece colombiano (10 dígitos, empieza en 3)')
  }

  // --- Dirección y referencia (opcionales) ---
  const direccion = fila.direccion ? String(fila.direccion).trim().slice(0, 200) : null
  const referencia = fila.referencia ? String(fila.referencia).trim().slice(0, 100) : null

  // --- Tipo ---
  const tipo = normalizarTipo(fila.tipo)
  if (fila.tipo && !tipo) {
    errores.push(`Tipo "${fila.tipo}" no válido. Usa: prestamo o mercancia`)
  }
  const tipoFinal = tipo || 'prestamo'

  // --- Préstamo (grupo opcional) ---
  const monto = Number(fila.montoPrestado) || 0
  let tasa = fila.tasaInteres != null && fila.tasaInteres !== '' ? Number(fila.tasaInteres) : null
  const dias = Number(fila.diasPlazo) || 0
  const fechaRaw = fila.fechaInicio
  const abonado = Number(fila.abonadoHasta) || 0

  // Mercancía: tasa default 0 si no se especifica
  if (tipoFinal === 'mercancia' && tasa === null) tasa = 0

  const tienePrestamo = monto > 0 || dias > 0 || fechaRaw

  let calculado = null
  let frecuencia = 'diario'
  let fechaInicio = null

  if (tienePrestamo) {
    if (monto <= 0) errores.push('Monto debe ser mayor a 0')
    if (tasa === null || tasa < 0) errores.push('Tasa de interés es requerida y no puede ser negativa')
    if (dias <= 0) errores.push('Plazo en días debe ser mayor a 0')

    frecuencia = normalizarFrecuencia(fila.frecuencia)
    if (!frecuencia) errores.push(`Frecuencia "${fila.frecuencia}" no válida. Usa: diario, semanal, quincenal, mensual`)
    frecuencia = frecuencia || 'diario'

    fechaInicio = normalizarFecha(fechaRaw)
    if (!fechaInicio) errores.push('Fecha de inicio no válida. Usa DD/MM/YYYY o YYYY-MM-DD')

    if (monto > 0 && tasa !== null && tasa >= 0 && dias > 0 && fechaInicio) {
      calculado = calcularPrestamo({
        montoPrestado: monto,
        tasaInteres: tasa,
        diasPlazo: dias,
        fechaInicio,
        frecuencia,
      })

      if (abonado > calculado.totalAPagar) {
        errores.push(`Abonado ($${abonado.toLocaleString('es-CO')}) mayor al total a pagar ($${calculado.totalAPagar.toLocaleString('es-CO')})`)
      } else if (abonado > 0) {
        advertencias.push(`Abono previo de $${abonado.toLocaleString('es-CO')}`)
      }
    }
  }

  const estado = errores.length > 0 ? 'error' : advertencias.length > 0 ? 'advertencia' : 'valido'

  return {
    indice,
    estado,
    errores,
    advertencias,
    datos: {
      nombre, cedula, telefono, direccion, referencia,
      tipo: tipoFinal,
      montoPrestado: monto,
      tasaInteres: tasa,
      diasPlazo: dias,
      frecuencia,
      fechaInicio,
      abonadoHasta: abonado,
      tienePrestamo,
    },
    calculado,
  }
}

/**
 * Agrupa filas validadas por cédula para la importación.
 * Retorna Map<cedula, { cliente, prestamos[] }>
 */
export function agruparPorCliente(filasValidadas) {
  const grupos = new Map()
  for (const fila of filasValidadas) {
    if (fila.estado === 'error') continue
    const { cedula } = fila.datos
    if (!grupos.has(cedula)) {
      grupos.set(cedula, {
        cliente: {
          nombre: fila.datos.nombre,
          cedula: fila.datos.cedula,
          telefono: fila.datos.telefono,
          direccion: fila.datos.direccion,
          referencia: fila.datos.referencia,
        },
        prestamos: [],
      })
    }
    if (fila.datos.tienePrestamo) {
      grupos.get(cedula).prestamos.push({
        tipo: fila.datos.tipo,
        montoPrestado: fila.datos.montoPrestado,
        tasaInteres: fila.datos.tasaInteres,
        diasPlazo: fila.datos.diasPlazo,
        frecuencia: fila.datos.frecuencia,
        fechaInicio: fila.datos.fechaInicio,
        abonadoHasta: fila.datos.abonadoHasta,
        calculado: fila.calculado,
      })
    }
  }
  return grupos
}

/**
 * Parsea texto pegado (TSV / separado por tabs o punto y coma).
 */
export function parsearTexto(texto) {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  if (lineas.length < 2) return []

  const sep = lineas[0].includes('\t') ? '\t' : ';'
  const headers = lineas[0].split(sep).map(h => h.trim().toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, '')
    .replace('montoprestado', 'montoPrestado')
    .replace('tasainteres', 'tasaInteres')
    .replace('diasplazo', 'diasPlazo')
    .replace('fechainicio', 'fechaInicio')
    .replace('abonadohasta', 'abonadoHasta')
  )

  return lineas.slice(1).map(linea => {
    const valores = linea.split(sep)
    const obj = {}
    headers.forEach((h, i) => {
      if (COLUMNAS.includes(h)) obj[h] = valores[i]?.trim() ?? ''
    })
    return obj
  }).filter(obj => obj.nombre || obj.cedula)
}

export { COLUMNAS, FRECUENCIAS_VALIDAS, TIPOS_VALIDOS }
