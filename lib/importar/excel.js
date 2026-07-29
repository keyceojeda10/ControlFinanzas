// lib/importar/excel.js — leer el Excel que el prestamista ya tiene.
//
// Escrito contra un export REAL de otro sistema (68 créditos, «Reporte general
// de créditos activos»), no contra un archivo de ejemplo inventado. Todo lo que
// hay aquí sale de algo que ese archivo hace de verdad.
//
// EL PELIGRO Nº1 ES LA ESCALA. En ese archivo el capital mediano es «1.000» y
// la cartera entera suma «128.000». Una cartera de ciento veintiocho mil pesos
// no existe: el sistema de origen exporta EN MILES, y la cartera real es de
// $128.000.000. Si se importa tal cual, el negocio entra mil veces más pequeño
// —y como todo queda proporcionado entre sí, ni una sola cifra se ve «rota»:
// las cuotas, los saldos y los porcentajes cuadran perfectamente. Es el error
// más caro y el más silencioso, así que NO se adivina: se detecta, se avisa y
// lo confirma la persona.

/** Colombia: «1.200.000» son 1,2 millones; el punto separa miles, no decimales. */
export function aNumero(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const s = String(v).trim()
  // Un solo punto o coma con 1-2 dígitos detrás sí es decimal («3.50» cuotas).
  const decimal = /^-?\d+[.,]\d{1,2}$/.test(s)
  const limpio = decimal ? s.replace(',', '.') : s.replace(/[.,\s]/g, '')
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** Los nombres de columna del export real, y los que suelen venir cerca. */
const COLUMNAS = {
  nombre:    ['nombre', 'cliente', 'nombres'],
  telefono:  ['telefono', 'teléfono', 'celular', 'movil', 'móvil'],
  direccion: ['direccion', 'dirección', 'barrio'],
  cedula:    ['cedula', 'cédula', 'documento', 'identificacion', 'identificación', 'nit'],
  fecha:     ['fecha', 'fecha inicio', 'desembolso'],
  capital:   ['capital', 'monto', 'prestado', 'valor prestado'],
  interes:   ['interes', 'interés', 'tasa', '%'],
  cuota:     ['valor cuota', 'cuota'],
  plazo:     ['plazo', 'frecuencia', 'periodicidad'],
  nCuotas:   ['cantidad cuotas', 'numero de cuotas', 'número de cuotas', 'cuotas'],
  pagadas:   ['cuotas pagadas'],
  saldo:     ['saldo actual', 'saldo'],
  estado:    ['manejo', 'estado'],
}

const norm = (s) => String(s ?? '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Encuentra la fila de encabezados. NO ES SIEMPRE LA PRIMERA: el archivo real
 * empieza con «Reporte general de créditos activos - idApp: 7c08518ae74» y los
 * títulos están en la segunda. Leer la fila 1 como encabezado convierte el
 * archivo entero en basura, así que se busca la fila que más columnas conocidas
 * reconoce.
 */
export function encontrarEncabezado(filas = []) {
  let mejor = { indice: -1, aciertos: 0, mapa: {} }
  const candidatas = filas.slice(0, 10)

  candidatas.forEach((fila, i) => {
    const mapa = {}
    let aciertos = 0
    ;(fila || []).forEach((celda, col) => {
      const t = norm(celda)
      if (!t) return
      for (const [campo, nombres] of Object.entries(COLUMNAS)) {
        if (mapa[campo] != null) continue
        // Coincidencia exacta primero; si no, que la celda empiece por el
        // nombre («valor cuota» no debe caer en «cuota» antes de tiempo).
        if (nombres.includes(t)) { mapa[campo] = col; aciertos++; return }
      }
    })
    // Segunda pasada, más laxa, solo para lo que quedó sin asignar.
    ;(fila || []).forEach((celda, col) => {
      const t = norm(celda)
      if (!t) return
      for (const [campo, nombres] of Object.entries(COLUMNAS)) {
        if (mapa[campo] != null) continue
        if (nombres.some((n) => t.includes(n))) { mapa[campo] = col; aciertos++; return }
      }
    })
    if (aciertos > mejor.aciertos) mejor = { indice: i, aciertos, mapa }
  })

  return mejor
}

/**
 * ¿Vienen los montos en miles?
 *
 * Se mira la MEDIANA del capital, no la suma ni el promedio: un solo préstamo
 * enorme mal tecleado no puede decidir la escala de toda la cartera.
 *
 * El corte en 50.000 no es un número bonito. Nadie presta 50.000 pesos como
 * negocio —no paga ni el transporte de ir a cobrarlo— así que una mediana por
 * debajo de eso significa que la unidad no son pesos. Y por arriba, nadie
 * exporta en miles una cartera cuya mediana ya es 50.000 (serían préstamos de
 * 50 millones como caso típico).
 */
export function detectarEscala(capitales = []) {
  const nums = capitales.map(aNumero).filter((n) => n != null && n > 0).sort((a, b) => a - b)
  if (!nums.length) return { factor: 1, sospecha: false, mediana: null }
  const mediana = nums[Math.floor(nums.length / 2)]
  const sospecha = mediana < 50_000
  return { factor: sospecha ? 1000 : 1, sospecha, mediana }
}

const FRECUENCIAS = {
  diario: 'diario', diaria: 'diario',
  semanal: 'semanal', semana: 'semanal',
  quincenal: 'quincenal', quincena: 'quincenal',
  mensual: 'mensual', mes: 'mensual',
}

export function aFrecuencia(v) {
  return FRECUENCIAS[norm(v)] ?? null
}

/** Un teléfono colombiano son 10 dígitos. «312», «222» o «3» no son teléfonos. */
export function telefonoValido(v) {
  return String(v ?? '').replace(/\D/g, '').length >= 10
}

/**
 * Convierte una fila en un cliente con su préstamo, y ANOTA LO QUE NO CUADRA.
 *
 * No descarta filas: un cliente que debe plata no se tira porque le falte el
 * teléfono. Los reparos se devuelven para que la pantalla de revisión los
 * marque en ámbar y la persona decida.
 */
export function leerFila(fila, mapa, factor = 1) {
  const v = (campo) => (mapa[campo] == null ? null : fila[mapa[campo]])
  const reparos = []

  const nombre = String(v('nombre') ?? '').trim()
  if (!nombre) reparos.push({ campo: 'nombre', texto: 'Sin nombre' })

  const telefono = String(v('telefono') ?? '').trim()
  if (!telefonoValido(telefono)) {
    reparos.push({ campo: 'telefono', texto: telefono ? 'Teléfono incompleto' : 'Sin teléfono' })
  }

  // La cédula es OBLIGATORIA en /api/clientes y el export real no la trae en
  // ninguna columna. Se marca, no se inventa: un documento inventado bloquea
  // el día que ese cliente firme un pagaré.
  const cedula = String(v('cedula') ?? '').trim()
  if (!cedula) reparos.push({ campo: 'cedula', texto: 'Falta la cédula' })

  const capital = aNumero(v('capital'))
  const cuota   = aNumero(v('cuota'))
  const nCuotas = aNumero(v('nCuotas'))
  const interes = aNumero(v('interes'))
  const frecuencia = aFrecuencia(v('plazo'))

  if (!capital || capital <= 0) reparos.push({ campo: 'capital', texto: 'Sin monto prestado' })
  if (!frecuencia) reparos.push({ campo: 'frecuencia', texto: 'No dice cada cuánto cobra' })

  // ¿El préstamo se sostiene solo? cuota × nº de cuotas debería dar el total
  // con intereses. En el archivo real 66 de 68 cuadran; los 2 que no, no son
  // un fallo del lector: son datos malos en el origen, y hay que verlos.
  if (capital && cuota && nCuotas && interes != null) {
    const esperado = capital * (1 + interes / 100)
    const suma = cuota * nCuotas
    if (Math.abs(suma - esperado) > Math.max(1, esperado * 0.02)) {
      reparos.push({ campo: 'cuota', texto: 'Las cuotas no suman el total' })
    }
  }

  return {
    nombre,
    telefono: telefonoValido(telefono) ? telefono : null,
    direccion: String(v('direccion') ?? '').trim() || null,
    cedula: cedula || null,
    capital: capital == null ? null : capital * factor,
    cuota: cuota == null ? null : cuota * factor,
    saldo: aNumero(v('saldo')) == null ? null : aNumero(v('saldo')) * factor,
    nCuotas,
    // Redondeado: el origen manda «3.50 cuotas pagadas» y medio pago no existe.
    pagadas: aNumero(v('pagadas')) == null ? null : Math.round(aNumero(v('pagadas'))),
    interes,
    frecuencia,
    estado: norm(v('estado')) || null,
    reparos,
  }
}

/** Todo junto: de las filas crudas del archivo a lo que ve la revisión. */
export function leerExcel(filas = []) {
  const cab = encontrarEncabezado(filas)
  if (cab.indice < 0 || cab.aciertos < 3) {
    return { error: 'No reconocí las columnas del archivo', filas: [], escala: null }
  }

  const datos = filas.slice(cab.indice + 1).filter((f) => (f || []).some((c) => c != null && c !== ''))
  const escala = detectarEscala(datos.map((f) => (cab.mapa.capital == null ? null : f[cab.mapa.capital])))
  const leidas = datos.map((f) => leerFila(f, cab.mapa, escala.factor))

  return {
    filas: leidas,
    escala,
    mapa: cab.mapa,
    // El resumen que necesita el pie de la pantalla de revisión.
    resumen: {
      total: leidas.length,
      conReparos: leidas.filter((f) => f.reparos.length > 0).length,
      cartera: leidas.reduce((s, f) => s + (f.saldo ?? f.capital ?? 0), 0),
    },
  }
}
