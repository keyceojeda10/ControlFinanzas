// lib/carga-masiva.js — Lógica de parseo y validación para carga masiva
//
// Una cédula puede aparecer varias veces (un cliente con múltiples préstamos).
// Cada fila es: datos del cliente + (opcionalmente) un préstamo.
// Al importar se agrupan por cédula: se crea el cliente UNA vez y N préstamos.

import { calcularPrestamo } from '@/lib/calculos'

// ⚠ Todo campo de ALIAS_COLUMNAS tiene que estar aqui: aplicarMapeo solo copia
// los de esta lista. El 21 jul se separo `numeroCuotas` de `diasPlazo` en los
// alias y no aqui, y desde entonces todo archivo con cuotas en vez de dias
// fallaba entero ("Plazo en dias (o numero de cuotas) debe ser mayor a 0"):
// la columna se detectaba, se enseñaba asignada, y se tiraba al aplicar.
const COLUMNAS = [
  'nombre', 'cedula', 'telefono', 'direccion', 'referencia',
  'tipo', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'numeroCuotas', 'valorCuota', 'frecuencia',
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
  // El valor de CADA cuota, en plata. Si el archivo lo trae, manda: el prestamo
  // se crea con esa cuota y el total es cuota x numero de cuotas, identico al de
  // la app de donde viene. Solo alias de varias palabras: un "cuota" suelto
  // haria que "Cuotas pagadas" (un conteo) cayera aqui por subcadena.
  valorCuota: [
    'valor cuota', 'valor de cuota', 'valor de la cuota', 'valor cuota diaria',
    'monto cuota', 'monto de la cuota', 'cuota diaria', 'cuota fija', 'valor abono',
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
      // Si el archivo ya trae el plazo en otra columna ("Cantidad cuotas"), no
      // hay nada que buscar. Antes se buscaba igual y "Valor cuota" (42.800,
      // plata) acababa TAMBIEN como numero de cuotas.
      const yaHayPlazo = Object.values(nuevo).some(c => c === 'numeroCuotas' || c === 'diasPlazo')
      const headersLibres = yaHayPlazo ? [] : Object.keys(filasMuestra[0] || {}).filter(h => !nuevo[h])
      // Fuera las columnas de plata ("Valor cuota", "Saldo") y los conteos
      // parciales ("Cuotas pagadas", "Cuotas pendientes"): no son el plazo.
      const NO_ES_EL_PLAZO = ['valor', 'monto', 'saldo', 'pagad', 'pendiente', 'restante', 'vencid']
      const candidatos = headersLibres
        .map(h => ({ h, norm: normalizar(h) }))
        .filter(({ norm }) => norm.includes('cuota') || norm.includes('cantidad') || norm.includes('plazo'))
        .filter(({ norm }) => !NO_ES_EL_PLAZO.some(p => norm.includes(p)))
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
  valorCuota: 'Valor de la cuota',
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
 * El calculo de un prestamo importado. Lo usan la validacion (lo que ve el
 * prestamista antes de importar) y el API que lo crea: tienen que dar LO MISMO.
 *
 * - Sin valor de cuota: interes 'fijo' (el % es mensual y crece con el plazo),
 *   como siempre.
 * - Con valor de cuota: la cuota manda y el total es cuota x cuotas, al peso
 *   igual que en la app de donde viene la cartera. Se calcula con tasa 0 para
 *   que la proteccion de la cuota manual (alargar el plazo si la cuota no cubre
 *   el interes de la tasa en modo fijo) no reescriba un contrato que ya existe:
 *   un prestamo de 1.000.000 al 20 % en 40 cuotas de 30.000 es de 1.200.000 en
 *   su app, y en 'fijo' serian 1.268.000. validarFila garantiza que
 *   cuota x cuotas cubre el capital (si no, la fila no llega aqui).
 */
export function calcularPrestamoImportado({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, valorCuota }) {
  const cuota = Number(valorCuota) || 0
  if (cuota > 0) {
    return calcularPrestamo({
      montoPrestado, tasaInteres: 0, diasPlazo, fechaInicio, frecuencia,
      cuotaManual: cuota, modoInteres: 'manual',
    })
  }
  return calcularPrestamo({ montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, modoInteres: 'fijo' })
}

/* ══ LA HUELLA DE UN PRÉSTAMO: PARA NO CREARLO DOS VECES ═══════════════════
 *
 * 23 sep 2026. Un prestamista importó su archivo (83 préstamos), dos filas se
 * quedaron fuera por error y volvió a subir EL MISMO archivo para rescatarlas.
 * La revisión le decía «Cliente X ya existe. Se agregarán los préstamos al
 * cliente existente» en las 83 y le ofrecía «Importar 83 clientes»: el botón
 * habría creado los 83 préstamos OTRA VEZ, con sus desembolsos y sus abonos
 * previos. Nada lo impedía.
 *
 * Añadir un préstamo NUEVO a un cliente que ya existe está bien —para eso está
 * el aviso—; lo que no puede pasar es volver a crear EL MISMO. Mismo cliente,
 * mismo monto, misma fecha de inicio y misma frecuencia es el mismo préstamo.
 * La fecha va como YYYY-MM-DD: en la base es la medianoche de Bogotá (T05:00Z) y
 * en la fila, el texto que ya normalizó `normalizarFecha`.
 */
export function huellaPrestamo({ montoPrestado, fechaInicio, frecuencia }) {
  const f = fechaInicio instanceof Date ? fechaInicio.toISOString() : String(fechaInicio ?? '')
  return `${Math.round(Number(montoPrestado) || 0)}|${f.slice(0, 10)}|${frecuencia || 'diario'}`
}

/**
 * Valida una fila individual.
 * cedulasExistentes = Map<cedula, { id, nombre, estado }>
 * huellasExistentes = Map<cedula, Set<huellaPrestamo>> — los préstamos que ese
 *   cliente YA tiene; una fila con la misma huella sale `repetido` y no se crea.
 * (no validamos duplicados internos — se permite repetir cédula para N préstamos)
 */
export function validarFila(fila, indice, cedulasExistentes, huellasExistentes = new Map()) {
  const errores = []
  const advertencias = []

  // --- Nombre ---
  const nombre = String(fila.nombre ?? '').trim()
  if (!nombre) errores.push('Nombre es requerido')

  // --- Cédula (opcional — se auto-genera si falta) ---
  let existente = null
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
    // El aviso de «ya existe» se decide abajo: si el préstamo también es el
    // mismo, no se le agrega nada y decirlo sería falso.
    existente = cedulasExistentes.get(cedula) ?? null
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
  let valorCuota = Math.round(parsearNumero(fila.valorCuota))
  let dias = diasCrudos
  const fechaRaw = fila.fechaInicio
  let abonado = parsearNumero(fila.abonadoHasta)

  // Mercancía: tasa default 0 si no se especifica
  if (tipoFinal === 'mercancia' && tasa === null) tasa = 0

  const tienePrestamo = monto > 0 || diasCrudos > 0 || cuotasCrudas > 0 || fechaRaw

  let calculado = null
  let frecuencia = 'diario'
  let fechaInicio = null
  let repetido = false
  /* El arreglo de UN TOQUE para la fila que no cuadra, si el propio archivo lo
     trae: ver abajo. La pantalla lo ofrece como botón; no se aplica solo. */
  let correccion = null

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

    // Una "cuota" que no cuadra ni de lejos con el capital es casi seguro una
    // columna mal asignada (p. ej. un conteo de cuotas pagadas): mejor parar la
    // fila que crear un prestamo de 33.000 cuotas.
    const periodos = Math.ceil(dias / DIAS_POR_PERIODO[frecuencia])
    const pesos = n => '$' + n.toLocaleString('es-CO')

    /* ⚠ LA «CUOTA» QUE ES LO QUE FALTA POR PAGAR (24 sep 2026). El «Reporte
       general de créditos activos» de la otra app, cuando al préstamo le queda
       MENOS DE UNA CUOTA, pone en «Valor cuota» lo que falta —el saldo—, no la
       cuota. Medido en el archivo real: 81 filas cuadran al peso (cuota × cuotas =
       capital con el interés) y las 4 que no, traen «Valor cuota» IGUAL al saldo:
         $400.000 al 20 %, «cuota» $12.000 × 30  → son 30 de $16.000 (le faltan 0,75)
         $300.000 al 20 %, «cuota» $60.000 × 4   → son 4 de $90.000 (le faltan 0,67)
         $300.000 al 20 %, «cuota» $10.000 × 30  → 300.000 = el capital: entraba
                                                   CALLADA con $60.000 de menos
         $1.000.000 al 20 %, «cuota» $1.170.000 × 1 → entraba con $30.000 de menos
       Se corrige SOLO —el dueño lo decidió así— y la fila lo dice en su aviso. Se
       conserva el número de cuotas: con él cuadran el vencimiento y las «cuotas
       pendientes» del archivo. Solo cuando el saldo es MENOR que la cuota real: si
       es una cuota entera, puede ser la cuota de verdad con otro tipo de interés
       (mensual), y no se toca. */
    const saldoArchivo = fila.saldoActual != null && String(fila.saldoActual).trim() !== ''
      ? Math.round(parsearNumero(fila.saldoActual)) : null
    if (tasa !== null && tasa >= 0 && valorCuota > 0 && monto > 0 && periodos > 0 && saldoArchivo === valorCuota) {
      const totalConTasa = Math.round(monto * (1 + tasa / 100))
      const cuotaReal = Math.ceil(totalConTasa / periodos)
      if (Math.abs(valorCuota * periodos - totalConTasa) > periodos && saldoArchivo < cuotaReal) {
        advertencias.push(`En «Valor cuota» el archivo trae lo que le falta pagar (${pesos(valorCuota)}), no la cuota: con el ${tasa} % son ${periodos} cuotas de ${pesos(cuotaReal)} (total ${pesos(cuotaReal * periodos)})`)
        valorCuota = cuotaReal
      }
    }

    if (valorCuota > 0 && monto > 0 && dias > 0) {
      const totalArchivo = valorCuota * periodos
      const faltante = monto - totalArchivo
      if (totalArchivo < monto * 0.5 || totalArchivo > monto * 3) {
        errores.push(`La cuota del archivo (${pesos(valorCuota)} x ${periodos} = ${pesos(totalArchivo)}) no cuadra con el capital (${pesos(monto)}). Revisa la columna del valor de la cuota`)
      } else if (faltante > 0 && faltante <= periodos) {
        // Redondeo de la otra app (34 cuotas de 11.764 = 399.976 sobre 400.000):
        // la cuota sube 1 peso y cubre el capital.
        const ajustada = Math.ceil(monto / periodos)
        advertencias.push(`Cuota ajustada de ${pesos(valorCuota)} a ${pesos(ajustada)} por redondeo, para cubrir el capital`)
        valorCuota = ajustada
      } else if (faltante > 0) {
        // Cobraria menos de lo prestado. Alargar el plazo inflaria el abono
        // previo (total - saldo), que entra a la caja como recaudo: plata que
        // no existe. Mejor que el prestamista lo mire.
        errores.push(`La cuota x cuotas del archivo (${pesos(totalArchivo)}) es menor que el capital (${pesos(monto)}): cobraria menos de lo prestado. Revisa esta fila`)
        /* ⚠ «QUE LO MIRE» SIN DARLE CON QUÉ ERA UN CALLEJÓN (23 sep 2026). El
           prestamista veía el error y ninguna forma de arreglarlo desde aquí. El
           archivo trae la TASA, y con ella se le OFRECE el número de cuotas que
           cubre el total. Se ofrece, no se aplica: quien confirma es el
           prestamista, que tiene la cartulina en la mano.
           ⚠ El caso con el que se escribió («$400.000 al 20 %, cuota $12.000, 30
           cuotas» → «40 cuotas») NO era este: era la «cuota» que es el saldo, y se
           arregla arriba sin preguntar. Este ofrecimiento queda para el archivo que
           no trae saldo con qué distinguirlo. */
        if (tasa !== null && tasa >= 0) {
          const totalConTasa = monto * (1 + tasa / 100)
          let n = Math.round(totalConTasa / valorCuota)
          if (n * valorCuota < monto) n = Math.ceil(monto / valorCuota)
          if (n > periodos) {
            correccion = { numeroCuotas: n, valorCuota, total: n * valorCuota, tasa, frecuencia }
          }
        }
      }
    }

    if (monto > 0 && tasa !== null && tasa >= 0 && dias > 0 && fechaInicio && errores.length === 0) {
      calculado = calcularPrestamoImportado({
        montoPrestado: monto, tasaInteres: tasa, diasPlazo: dias, fechaInicio, frecuencia, valorCuota,
      })

      if (abonado === 0 && fila.saldoActual != null && String(fila.saldoActual).trim()) {
        const saldo = parsearNumero(fila.saldoActual)
        if (saldo >= 0 && saldo <= calculado.totalAPagar) {
          abonado = Math.round(calculado.totalAPagar - saldo)
        }
      }

      // ¿Este mismo préstamo ya lo tiene el cliente? Entonces no se vuelve a crear.
      if (huellasExistentes.get(cedula)?.has(huellaPrestamo({ montoPrestado: monto, fechaInicio, frecuencia }))) {
        repetido = true
      }

      if (abonado > calculado.totalAPagar) {
        errores.push(`Abonado ($${abonado.toLocaleString('es-CO')}) mayor al total a pagar ($${calculado.totalAPagar.toLocaleString('es-CO')})`)
      } else if (abonado > 0) {
        advertencias.push(`Abono previo de $${abonado.toLocaleString('es-CO')}`)
      }
    }
  }

  if (existente && !repetido) {
    advertencias.unshift(`Cliente "${existente.nombre}" ya existe. Se agregaran los prestamos al cliente existente.`)
  }
  if (repetido && errores.length === 0) {
    advertencias.length = 0
    advertencias.push('Este préstamo ya está en el sistema (mismo monto, fecha y frecuencia): no se vuelve a crear.')
  }
  const estado = errores.length > 0 ? 'error'
    : repetido ? 'repetido'
    : advertencias.length > 0 ? 'advertencia' : 'valido'

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
      valorCuota,
      frecuencia,
      fechaInicio,
      abonadoHasta: abonado,
      tienePrestamo,
    },
    calculado,
    correccion,
  }
}

/**
 * Agrupa filas validadas por cédula para la importación.
 * Retorna Map<cedula, { cliente, prestamos[] }>
 */
export function agruparPorCliente(filasValidadas) {
  const grupos = new Map()
  for (const fila of filasValidadas) {
    // Ni las filas con error ni las que ya están importadas: ver `huellaPrestamo`.
    if (fila.estado === 'error' || fila.estado === 'repetido') continue
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
        valorCuota: fila.datos.valorCuota || 0,
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
    .replace('numerocuotas', 'numeroCuotas')
    .replace('valorcuota', 'valorCuota')
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
