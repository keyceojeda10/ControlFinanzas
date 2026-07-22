// lib/carga-masiva.js — Lógica de parseo y validación para carga masiva
//
// Una cédula puede aparecer varias veces (un cliente con múltiples préstamos).
// Cada fila es: datos del cliente + (opcionalmente) un préstamo.
// Al importar se agrupan por cédula: se crea el cliente UNA vez y N préstamos.

import { calcularPrestamo } from '@/lib/calculos'

const COLUMNAS = [
  'nombre', 'cedula', 'telefono', 'direccion', 'referencia',
  'tipo', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'frecuencia',
  'fechaInicio', 'abonadoHasta', 'saldoActual',
]

const FRECUENCIAS_VALIDAS = ['diario', 'semanal', 'quincenal', 'mensual']
const TIPOS_VALIDOS = ['prestamo', 'mercancia']

const ALIAS_COLUMNAS = {
  nombre: [
    'nombre', 'nombres', 'name', 'cliente', 'nombre del cliente', 'nombre completo',
    'nombres y apellidos', 'nombre cliente', 'razon social', 'titular',
    'nombre_cliente', 'nombrecliente', 'full name', 'deudor', 'prestatario',
  ],
  cedula: [
    'cedula', 'cédula', 'cc', 'documento', 'doc', 'identificacion', 'identificación',
    'nit', 'numero de documento', 'num documento', 'id', 'dni', 'rut',
    'numero documento', 'cedula cliente', 'num cedula', 'no documento',
    'numero de cedula', 'número de cédula', 'documento de identidad',
    'id cliente', 'identificador cliente', 'numero cliente', 'codigo cliente',
  ],
  telefono: [
    'telefono', 'teléfono', 'tel', 'celular', 'movil', 'móvil', 'phone', 'cell',
    'numero celular', 'numero de celular', 'num celular', 'whatsapp', 'wsp', 'wp',
    'numero de telefono', 'contacto', 'cel', 'telefono celular', 'telefono cliente',
  ],
  direccion: [
    'direccion', 'dirección', 'dir', 'domicilio', 'address', 'ubicacion', 'ubicación',
    'barrio', 'sector', 'direccion cliente', 'lugar', 'residencia',
  ],
  referencia: [
    'referencia', 'ref', 'referencia personal', 'nota', 'notas', 'observacion',
    'observaciones', 'comentario', 'garante', 'fiador', 'codeudor',
  ],
  tipo: [
    'tipo', 'tipo prestamo', 'tipo de prestamo', 'modalidad', 'clase',
    'tipo credito', 'tipo de credito',
  ],
  montoPrestado: [
    'montoprestado', 'monto prestado', 'monto', 'valor', 'capital', 'plata prestada',
    'plata', 'amount', 'valor prestado', 'prestamo', 'préstamo', 'cuanto se presto',
    'monto del prestamo', 'monto credito', 'valor del prestamo', 'desembolso',
    'valor prestamo', 'monto prestamo', 'dinero prestado', 'monto total',
    'capital prestado', 'valor credito', 'precio', 'precio de venta',
  ],
  tasaInteres: [
    'tasainteres', 'tasa interes', 'tasa de interes', 'tasa', 'interes', 'interés',
    'interest', 'porcentaje', 'tasa %', '% interes', 'rate', 'tasa mensual',
    'interes mensual', 'porcentaje interes', 'tasa de interés', 'porciento',
  ],
  // OJO: "dias" y "cuotas" NO son lo mismo y antes compartian este campo.
  // calcularPrestamo hace numPeriodos = ceil(dias / diasPeriodo), asi que un
  // Excel con "Cuotas: 20" + "semanal" generaba ceil(20/7) = 3 cuotas en vez
  // de 20: la cuota y el total quedaban mal por un factor de 7 (o 15, o 30).
  // Para cobro diario coincidia de casualidad, por eso paso desapercibido.
  diasPlazo: [
    'diasplazo', 'dias plazo', 'dias', 'plazo', 'dias de plazo', 'term',
    'plazo dias', 'plazo en dias', 'duracion', 'duración', 'periodo', 'tiempo',
  ],
  numeroCuotas: [
    'cuotas', 'numero de cuotas', 'num cuotas', 'cantidad de cuotas',
    'no cuotas', 'cantidad cuotas', 'cant cuotas', 'total cuotas', 'n cuotas',
  ],
  frecuencia: [
    'frecuencia', 'freq', 'periodicidad', 'frequency', 'cada cuanto', 'cobro',
    'tipo cobro', 'periodo de cobro', 'forma de pago', 'frecuencia de pago',
    'frecuencia cobro', 'modalidad de pago',
  ],
  fechaInicio: [
    'fechainicio', 'fecha inicio', 'fecha de inicio', 'fecha', 'start date',
    'inicio', 'fecha prestamo', 'fecha del prestamo', 'fecha credito',
    'fecha desembolso', 'cuando se presto', 'date', 'f inicio', 'desde',
  ],
  abonadoHasta: [
    'abonadohasta', 'abonado hasta', 'abonado', 'ya pago', 'ya pagado',
    'pagado', 'total pagado', 'monto pagado', 'abono', 'abonos', 'paid',
    'cuanto ha pagado', 'pago previo', 'pagos previos', 'saldo pagado',
  ],
  saldoActual: [
    'saldo actual', 'saldo pendiente', 'saldo', 'balance', 'debe',
    'deuda actual', 'deuda', 'saldo deuda', 'monto pendiente',
    'balance pendiente', 'por cobrar', 'pendiente',
  ],
}

// Mismo mapa que obtenerDiasPorPeriodo en lib/calculos.js
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

function normalizar(str) {
  return String(str).trim().toLowerCase()
    .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[_\-\.#*]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Convierte a numero respetando el separador de miles del archivo.
 *
 * La version anterior hacia `s.replace(',', '.')` — solo la PRIMERA coma — y
 * eso destrozaba el formato con coma de miles, que es lo que sale al exportar
 * de Google Sheets o de apps en locale US:
 *     "500,000"    -> "500.000"  -> 500        (mil veces mas chico)
 *     "1,500,000"  -> "1.500000" -> 1.5
 * El prestamista subia su cartera, veia montos absurdos y se iba.
 *
 * Regla: si hay ambos separadores, el ULTIMO es el decimal. Si hay uno solo,
 * es de miles cuando parte el numero en grupos exactos de 3.
 */
function parsearNumero(valor) {
  if (valor == null || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  const bruto = String(valor).trim()
  // Negativo por signo o por notacion contable "(1.200)"
  const negativo = /^-/.test(bruto) || /^\(.*\)$/.test(bruto)

  let s = bruto.replace(/[^\d.,]/g, '')
  if (!s) return 0

  const ultPunto = s.lastIndexOf('.')
  const ultComa = s.lastIndexOf(',')

  if (ultPunto >= 0 && ultComa >= 0) {
    const dec = Math.max(ultPunto, ultComa)
    const separadorMiles = dec === ultPunto ? /,/g : /\./g
    s = s.slice(0, dec).replace(separadorMiles, '') + '.' + s.slice(dec + 1)
  } else if (ultComa >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.')
  } else if (ultPunto >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return negativo ? -Math.abs(n) : n
}

/**
 * Detecta automáticamente a qué campo interno corresponde cada columna del Excel.
 * Retorna { mapeo: { headerOriginal: campoInterno }, sinMapear: [...] }
 */
export function detectarColumnas(headersOriginales) {
  const mapeo = {}
  const usados = new Set()
  const sinMapear = []

  // Pass 1: exact matches only (prevents substring from stealing slots)
  for (const header of headersOriginales) {
    const norm = normalizar(header)
    if (!norm) continue
    for (const [campo, aliases] of Object.entries(ALIAS_COLUMNAS)) {
      if (usados.has(campo)) continue
      if (aliases.some(a => normalizar(a) === norm)) {
        mapeo[header] = campo
        usados.add(campo)
        break
      }
    }
  }

  // Pass 2: substring matches for remaining headers (skip short aliases)
  for (const header of headersOriginales) {
    if (mapeo[header]) continue
    const norm = normalizar(header)
    if (!norm) continue
    for (const [campo, aliases] of Object.entries(ALIAS_COLUMNAS)) {
      if (usados.has(campo)) continue
      if (aliases.some(a => {
        const na = normalizar(a)
        if (na.length < 4) return false
        return norm.includes(na) || na.includes(norm)
      })) {
        mapeo[header] = campo
        usados.add(campo)
        break
      }
    }
    if (!mapeo[header]) sinMapear.push(header)
  }

  return { mapeo, sinMapear }
}

export function corregirMapeoConDatos(mapeo, filasMuestra) {
  if (!filasMuestra || filasMuestra.length === 0) return mapeo
  const nuevo = { ...mapeo }

  const headerDiasPlazo = Object.entries(nuevo).find(([, c]) => c === 'diasPlazo')?.[0]
  if (headerDiasPlazo && !Object.values(nuevo).includes('frecuencia')) {
    const valores = filasMuestra.slice(0, 10).map(f => String(f[headerDiasPlazo] || '').trim().toLowerCase())
    const frecTextos = ['diario', 'semanal', 'quincenal', 'mensual', 'daily', 'weekly', 'monthly']
    if (valores.filter(Boolean).some(v => frecTextos.includes(v))) {
      nuevo[headerDiasPlazo] = 'frecuencia'
      const headersLibres = Object.keys(filasMuestra[0] || {}).filter(h => !nuevo[h])
      const candidatos = headersLibres
        .map(h => ({ h, norm: normalizar(h) }))
        .filter(({ norm }) => norm.includes('cuota') || norm.includes('cantidad') || norm.includes('plazo'))
        .sort((a, b) => {
          const pa = a.norm.includes('cantidad') || a.norm.includes('numero') || a.norm.includes('total') ? 0 : 1
          const pb = b.norm.includes('cantidad') || b.norm.includes('numero') || b.norm.includes('total') ? 0 : 1
          return pa - pb
        })
      for (const { h } of candidatos) {
        const vals = filasMuestra.slice(0, 5).map(f => Number(f[h]))
        if (vals.some(v => v > 0 && Number.isFinite(v))) {
          // Si el encabezado habla de cuotas, va al campo de cuotas: validarFila
          // lo convierte a dias segun la frecuencia.
          nuevo[h] = normalizar(h).includes('cuota') ? 'numeroCuotas' : 'diasPlazo'
          break
        }
      }
    }
  }

  return nuevo
}

const CAMPOS_LABELS = {
  nombre: 'Nombre',
  cedula: 'Cedula / Documento',
  telefono: 'Telefono',
  direccion: 'Direccion',
  referencia: 'Referencia',
  tipo: 'Tipo (prestamo/mercancia)',
  montoPrestado: 'Monto prestado',
  tasaInteres: 'Tasa de interes (%)',
  diasPlazo: 'Plazo en dias',
  numeroCuotas: 'Numero de cuotas',
  frecuencia: 'Frecuencia de cobro',
  fechaInicio: 'Fecha de inicio',
  abonadoHasta: 'Ya pagado / abonado',
  saldoActual: 'Saldo actual (debe)',
}

export { CAMPOS_LABELS }

/**
 * Aplica el mapeo de columnas a las filas crudas del Excel.
 * Retorna filas con las claves internas (nombre, cedula, etc.)
 */
export function aplicarMapeo(filasCrudas, mapeo) {
  const invertido = {}
  for (const [headerOriginal, campoInterno] of Object.entries(mapeo)) {
    invertido[campoInterno] = headerOriginal
  }

  return filasCrudas.map(fila => {
    const obj = {}
    for (const campo of COLUMNAS) {
      const headerOriginal = invertido[campo]
      if (headerOriginal && fila[headerOriginal] !== undefined) {
        obj[campo] = fila[headerOriginal]
      } else {
        obj[campo] = ''
      }
    }
    return obj
  }).filter(obj => String(obj.nombre || '').trim() || String(obj.cedula || '').trim())
}

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

  // --- Cédula (opcional — se auto-genera si falta) ---
  let cedula = String(fila.cedula ?? '').trim().replace(/[.\s]/g, '')
  if (!cedula) {
    if (!nombre) {
      errores.push('Necesitas al menos nombre o cedula')
    } else {
      cedula = 'SIN-' + nombre.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
      advertencias.push('Sin cedula — se generara un identificador automatico')
    }
  } else if (cedula.length > 20) {
    errores.push('Cedula debe tener maximo 20 caracteres')
  } else {
    const existente = cedulasExistentes.get(cedula)
    if (existente) {
      advertencias.push(`Cliente "${existente.nombre}" ya existe. Se agregaran los prestamos al cliente existente.`)
    }
  }

  // --- Teléfono (opcional) ---
  const telefono = fila.telefono ? String(fila.telefono).replace(/\D/g, '') : null
  if (telefono && (telefono.length < 7 || telefono.length > 15)) {
    advertencias.push('Teléfono debe tener entre 7 y 15 dígitos')
  }

  // --- Dirección y referencia (opcionales) ---
  const direccion = fila.direccion ? String(fila.direccion).trim().slice(0, 200) : null
  const referencia = fila.referencia ? String(fila.referencia).trim().slice(0, 100) : null

  // --- Tipo ---
  const tipo = normalizarTipo(fila.tipo)
  if (fila.tipo && !tipo) {
    errores.push(`Tipo "${fila.tipo}" no válido. Usa: préstamo o mercancía`)
  }
  const tipoFinal = tipo || 'prestamo'

  // --- Préstamo (grupo opcional) ---
  const monto = parsearNumero(fila.montoPrestado)
  let tasa = fila.tasaInteres != null && fila.tasaInteres !== '' ? parsearNumero(fila.tasaInteres) : null
  const diasCrudos = Number(fila.diasPlazo) || 0
  const cuotasCrudas = Number(fila.numeroCuotas) || 0
  let dias = diasCrudos
  const fechaRaw = fila.fechaInicio
  let abonado = parsearNumero(fila.abonadoHasta)

  // Mercancía: tasa default 0 si no se especifica
  if (tipoFinal === 'mercancia' && tasa === null) tasa = 0

  const tienePrestamo = monto > 0 || diasCrudos > 0 || cuotasCrudas > 0 || fechaRaw

  let calculado = null
  let frecuencia = 'diario'
  let fechaInicio = null

  if (tienePrestamo) {
    if (monto <= 0) errores.push('Monto debe ser mayor a 0')
    if (tasa === null || tasa < 0) errores.push('Tasa de interés es requerida y no puede ser negativa')

    // La frecuencia se resuelve ANTES del plazo: si el archivo trae cuotas en
    // vez de dias, hace falta para convertir.
    frecuencia = normalizarFrecuencia(fila.frecuencia)
    if (!frecuencia) errores.push(`Frecuencia "${fila.frecuencia}" no válida. Usa: diario, semanal, quincenal, mensual`)
    frecuencia = frecuencia || 'diario'

    if (!diasCrudos && cuotasCrudas > 0) {
      dias = cuotasCrudas * DIAS_POR_PERIODO[frecuencia]
    }
    if (dias <= 0) errores.push('Plazo en días (o número de cuotas) debe ser mayor a 0')

    fechaInicio = normalizarFecha(fechaRaw)
    if (!fechaInicio) errores.push('Fecha de inicio no válida. Usa DD/MM/YYYY o YYYY-MM-DD')

    if (monto > 0 && tasa !== null && tasa >= 0 && dias > 0 && fechaInicio) {
      calculado = calcularPrestamo({
        montoPrestado: monto,
        tasaInteres: tasa,
        diasPlazo: dias,
        fechaInicio,
        frecuencia,
        modoInteres: 'fijo',
      })

      if (abonado === 0 && fila.saldoActual != null && String(fila.saldoActual).trim()) {
        const saldo = parsearNumero(fila.saldoActual)
        if (saldo >= 0 && saldo <= calculado.totalAPagar) {
          abonado = Math.round(calculado.totalAPagar - saldo)
        }
      }

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

export { COLUMNAS, FRECUENCIAS_VALIDAS, TIPOS_VALIDOS, parsearNumero }
