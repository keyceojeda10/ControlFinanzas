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
import { validatePhone } from '@/lib/i18n'

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
  nombre:    ['nombre', 'nombres', 'nombre cliente', 'cliente'],
  apellido:  ['apellido', 'apellidos', 'apellido cliente'],
  telefono:  ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'whatsapp'],
  direccion: ['direccion', 'dirección', 'barrio'],
  cedula:    ['cedula', 'cédula', 'documento', 'identificacion', 'identificación', 'nit', 'rut', 'dni'],
  fecha:     ['fecha', 'fecha inicio', 'desembolso', 'fecha credito', 'fecha crédito'],
  capital:   ['capital', 'monto', 'prestado', 'valor prestado', 'valor credito', 'valor crédito',
    'monto credito', 'monto crédito', 'valor prestamo', 'valor préstamo'],
  interes:   ['interes', 'interés', 'tasa', '%'],
  cuota:     ['valor cuota', 'cuota'],
  plazo:     ['plazo', 'frecuencia', 'periodicidad'],
  /* El plazo EN DÍAS, cuando el archivo lo trae hecho. Sin esto hay que
     deducirlo de frecuencia × nº de cuotas, y un export que trae «Dias credito»
     pero no las cuotas se quedaba sin plazo y se descartaba entero. */
  diasPlazo: ['dias credito', 'días credito', 'dias del credito', 'plazo dias',
    'plazo en dias', 'dias plazo', 'duracion dias'],
  nCuotas:   ['cantidad cuotas', 'numero de cuotas', 'número de cuotas', 'cuotas'],
  pagadas:   ['cuotas pagadas'],
  saldo:     ['saldo actual', 'saldo'],
  estado:    ['manejo', 'estado'],
}

/* ⚠ LAS COLUMNAS DE OTRA PERSONA NO SON LAS DEL CLIENTE.
 *
 * Un export real de septiembre traía «Documento codeudor», y la cédula del
 * cliente acabó siendo esa columna —vacía en las 124 filas—, así que todas
 * salían con «CC null». Cualquier archivo con codeudor, fiador o referencia
 * cae en lo mismo, así que esas columnas se descartan antes de mirar nada. */
const DE_OTRO = /\b(codeudor|coodeudor|fiador|aval|garante|referencia|referido|conyuge|cónyuge)\b/

/* ⚠ CÓMO SE PUNTÚA, Y POR QUÉ NO VALE «LA PRIMERA QUE SUENE».
 *
 * Antes se recorrían las columnas de izquierda a derecha y la primera que
 * CONTUVIERA la palabra se quedaba el campo. En el mismo export de septiembre
 * eso puso el nombre en «Documento cliente» —porque contiene «cliente»— y los
 * 124 clientes se llamaban como su número de cédula.
 *
 * Ahora cada pareja (columna, campo) recibe una nota y se reparten de la mejor
 * a la peor. «Documento cliente» saca 1 para `nombre` (lo contiene) pero 2 para
 * `cedula` (empieza por «documento»), y «Nombre cliente» saca 3 exacto para
 * `nombre`: cada uno acaba donde tiene que estar. */
function nota(cabecera, sinonimo) {
  if (cabecera === sinonimo) return 3
  if (cabecera.startsWith(sinonimo + ' ') || cabecera.endsWith(' ' + sinonimo)) return 2
  return cabecera.includes(sinonimo) ? 1 : 0
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
    // Todas las parejas posibles con su nota, de la mejor a la peor.
    const parejas = []
    ;(fila || []).forEach((celda, col) => {
      const t = norm(celda)
      if (!t || DE_OTRO.test(t)) return          // el codeudor no es el cliente
      for (const [campo, nombres] of Object.entries(COLUMNAS)) {
        const n = Math.max(...nombres.map((s) => nota(t, s)))
        if (n > 0) parejas.push({ campo, col, n })
      }
    })
    /* De mayor nota a menor, y a igualdad la columna de más a la izquierda:
       en un archivo con «Telefono cliente» y «Celular cliente» las dos sacan
       la misma nota, y hay que quedarse con una de forma predecible. Cuál de
       las dos trae teléfonos de verdad lo decide después `mejorTelefono`,
       mirando los datos en vez de adivinar por el título. */
    parejas.sort((a, b) => b.n - a.n || a.col - b.col)

    const mapa = {}
    const usadas = new Set()
    let aciertos = 0
    for (const { campo, col, n } of parejas) {
      if (mapa[campo] != null || usadas.has(col)) continue
      mapa[campo] = col
      usadas.add(col)
      aciertos += n >= 2 ? 1 : 0.5      // media nota si solo se parece
    }
    if (aciertos > mejor.aciertos) mejor = { indice: i, aciertos, mapa }
  })

  return mejor
}

/* ⚠ CUÁL DE LAS DOS COLUMNAS DE TELÉFONO SIRVE, LO DICEN LOS DATOS.
 *
 * El export de septiembre traía «Telefono cliente» a `0` o `000` en las 124
 * filas y el número bueno en «Celular cliente». Por el título las dos son
 * igual de plausibles, así que se cuentan los teléfonos válidos de cada una y
 * gana la que más tenga. Si empatan se queda la que ya estaba: sin datos que
 * lo justifiquen no se cambia nada. */
export function mejorTelefono(cabecera = [], datos = [], mapa = {}, pais = null) {
  const candidatas = []
  cabecera.forEach((celda, col) => {
    const t = norm(celda)
    if (!t || DE_OTRO.test(t)) return
    if (COLUMNAS.telefono.some((s) => nota(t, s) > 0)) candidatas.push(col)
  })
  if (candidatas.length < 2) return mapa.telefono ?? null

  let ganadora = mapa.telefono ?? candidatas[0]
  let mejorCuenta = -1
  for (const col of candidatas) {
    const cuenta = datos.reduce((a, f) => a + (telefonoValido(f?.[col], pais) ? 1 : 0), 0)
    if (cuenta > mejorCuenta) { mejorCuenta = cuenta; ganadora = col }
  }
  return ganadora
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

/* ⚠ NO TODOS LOS TELÉFONOS TIENEN DIEZ DÍGITOS.
 *
 * Esto pedía 10 —los de Colombia— y el sistema vende en doce países: Chile y
 * Ecuador tienen 9, y Costa Rica, Guatemala, El Salvador, Honduras, Nicaragua y
 * Panamá tienen 8 (`lib/countries.js`). Con un export chileno de 124 clientes
 * eso tiró 108 teléfonos buenos y los marcó «sin teléfono».
 *
 * Con país se usa la validación que el sistema ya tiene para cada uno. Sin él,
 * el rango internacional: de 8 dígitos —el país más corto— a 15, que es el
 * máximo de E.164. «312», «222» o «3» siguen sin ser teléfonos.
 *
 * ⚠ Y los ceros de relleno tampoco. En ese mismo archivo la columna del fijo
 * venía a `0`, `000` y hasta `0000000000000000`: dieciséis dígitos que no son
 * un número de nadie. */
export function telefonoValido(v, pais = null) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length < 8 || d.length > 15) return false
  if (/^0+$/.test(d)) return false
  if (!pais) return true
  try { return validatePhone(d, pais) || d.length >= 8 } catch { return true }
}

/**
 * Convierte una fila en un cliente con su préstamo, y ANOTA LO QUE NO CUADRA.
 *
 * No descarta filas: un cliente que debe plata no se tira porque le falte el
 * teléfono. Los reparos se devuelven para que la pantalla de revisión los
 * marque en ámbar y la persona decida.
 */
export function leerFila(fila, mapa, factor = 1, pais = null) {
  const v = (campo) => (mapa[campo] == null ? null : fila[mapa[campo]])
  const reparos = []

  /* Nombre y apellido en columnas separadas es lo normal en los exports de
     otros sistemas, y quedarse solo con el primero deja fichas a medias. */
  const nombre = [String(v('nombre') ?? '').trim(), String(v('apellido') ?? '').trim()]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (!nombre) reparos.push({ campo: 'nombre', texto: 'Sin nombre' })

  const telefono = String(v('telefono') ?? '').trim()
  if (!telefonoValido(telefono, pais)) {
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
    telefono: telefonoValido(telefono, pais) ? telefono : null,
    direccion: String(v('direccion') ?? '').trim() || null,
    cedula: cedula || null,
    capital: capital == null ? null : capital * factor,
    cuota: cuota == null ? null : cuota * factor,
    saldo: aNumero(v('saldo')) == null ? null : aNumero(v('saldo')) * factor,
    nCuotas,
    diasPlazo: aNumero(v('diasPlazo')),
    // Redondeado: el origen manda «3.50 cuotas pagadas» y medio pago no existe.
    pagadas: aNumero(v('pagadas')) == null ? null : Math.round(aNumero(v('pagadas'))),
    interes,
    frecuencia,
    estado: norm(v('estado')) || null,
    reparos,
  }
}

/** Todo junto: de las filas crudas del archivo a lo que ve la revisión. */
export function leerExcel(filas = [], { pais = null } = {}) {
  const cab = encontrarEncabezado(filas)
  if (cab.indice < 0 || cab.aciertos < 3) {
    return { error: 'No reconocí las columnas del archivo', filas: [], escala: null }
  }

  const datos = filas.slice(cab.indice + 1).filter((f) => (f || []).some((c) => c != null && c !== ''))
  /* Con dos columnas de teléfono gana la que trae teléfonos, no la que va
     antes. Se decide aquí porque hace falta ver los datos, y `encontrarEncabezado`
     solo ve los títulos. */
  const mapa = { ...cab.mapa, telefono: mejorTelefono(filas[cab.indice] || [], datos, cab.mapa, pais) }
  const escala = detectarEscala(datos.map((f) => (mapa.capital == null ? null : f[mapa.capital])))
  const leidas = datos.map((f) => leerFila(f, mapa, escala.factor, pais))

  return {
    filas: leidas,
    escala,
    mapa,
    // El resumen que necesita el pie de la pantalla de revisión.
    resumen: {
      total: leidas.length,
      conReparos: leidas.filter((f) => f.reparos.length > 0).length,
      cartera: leidas.reduce((s, f) => s + (f.saldo ?? f.capital ?? 0), 0),
    },
  }
}
