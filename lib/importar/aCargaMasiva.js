// lib/importar/aCargaMasiva.js — del Excel leído a lo que espera
// /api/carga-masiva/importar.
//
// AQUÍ SE DECIDE CUÁNTOS CLIENTES SE CREAN, y por eso está separado y probado.
//
// El importador agrupa POR CÉDULA (`agruparPorCliente` en lib/carga-masiva.js).
// El export real no trae ninguna: si se manda tal cual, las 68 filas caen en el
// mismo grupo —la clave vacía— y en vez de 68 clientes se crea UNO con 68
// préstamos. No falla, no avisa: importa mal y calla.
//
// La salida es un marcador `SIN-…` por fila, el mismo patrón que ya usan el
// migrador y la cartulina. NO es inventarse un documento: es una clave interna
// que se ve a simple vista que no es una cédula, para que el día que alguien
// vaya a firmar un pagaré salte a los ojos que falta.

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

// Los mismos bloques que usa calcularPrestamo (lib/calculos.js). Si allí
// cambian, aquí también: por eso la conversión de abajo se deriva de la fórmula
// en vez de llevar números a mano.
const PERIODOS_POR_MES = { diario: 30, semanal: 4, quincenal: 2, mensual: 1 }

/**
 * EL MISMO 20% SIGNIFICA COSAS DISTINTAS, y esto costó $73.138.900 en la
 * primera importación de prueba.
 *
 * El archivo trae una tasa PLANA sobre todo el préstamo: capital × 1,20 es el
 * total, se cobre en 6 semanas o en 6 meses (se comprueba en el propio
 * archivo — cuota × nº de cuotas = capital × 1,20 en 66 de 68 filas).
 *
 * El sistema guarda `modoInteres: 'fijo'`, donde la tasa es MENSUAL:
 *
 *     interés = monto × (tasa/100) × meses,  meses = nCuotas / periodosPorMes
 *
 * Metido tal cual, un préstamo semanal a 8 cobros (~2 meses) cobraba 40% en vez
 * de 20%. De 68 préstamos, los 45 de más de un mes salieron mal; los 23 de un
 * mes o menos, bien, porque ahí mensual y plano coinciden.
 *
 * Se despeja la tasa que hace que el interés salga igual al plano:
 *
 *     monto × (x/100) × meses = monto × (plana/100)   →   x = plana / meses
 *
 * No es una aproximación: es la inversa exacta de la fórmula de arriba.
 */
export function tasaMensualEquivalente(tasaPlana, frecuencia, nCuotas) {
  const porMes = PERIODOS_POR_MES[frecuencia]
  const n = Number(nCuotas)
  const t = Number(tasaPlana)
  if (!porMes || !Number.isFinite(n) || n <= 0 || !Number.isFinite(t)) return null
  const meses = n / porMes
  if (meses <= 0) return null
  return t / meses
}

/** Marcador de cédula ausente. Se distingue de una cédula de verdad a simple vista. */
export function marcadorCedula(i, semilla = '') {
  return `SIN-${semilla}${String(i).padStart(3, '0')}`
}

export function esMarcador(cedula) {
  return String(cedula ?? '').startsWith('SIN-')
}

/**
 * El plazo en DÍAS, que es lo que pide el importador. El archivo da «semanal»
 * y «6 cuotas»; el importador quiere 42. Sin esto, `diasPlazo` va vacío y el
 * préstamo se descarta con «monto o plazo inválido».
 */
export function diasDePlazo(frecuencia, nCuotas) {
  const d = DIAS_POR_PERIODO[frecuencia]
  const n = Number(nCuotas)
  if (!d || !Number.isFinite(n) || n <= 0) return null
  return Math.round(d * n)
}

/**
 * @param filas   las que devuelve leerExcel()
 * @param opts    { semilla, hoy } — `hoy` en YYYY-MM-DD para las filas sin fecha
 */
export function aCargaMasiva(filas = [], { semilla = '', hoy = null } = {}) {
  const listas = []
  const descartadas = []

  filas.forEach((f, i) => {
    const diasPlazo = diasDePlazo(f.frecuencia, f.nCuotas)

    // Sin monto o sin plazo el importador lo tira igualmente, pero en silencio
    // y en mitad de la transacción. Mejor decirlo antes, con el nombre delante.
    if (!f.capital || f.capital <= 0 || !diasPlazo) {
      descartadas.push({ nombre: f.nombre, motivo: !f.capital ? 'sin monto' : 'sin plazo' })
      return
    }

    // La tasa del archivo es plana; el sistema la guarda como mensual. Sin
    // convertirla, la deuda entra inflada y el cliente paga de más.
    const tasa = tasaMensualEquivalente(f.interes ?? 0, f.frecuencia, f.nCuotas)
    if (tasa == null) {
      descartadas.push({ nombre: f.nombre, motivo: 'no pude convertir la tasa' })
      return
    }

    listas.push({
      nombre: f.nombre || 'Cliente importado',
      // Una cédula de verdad si la hay; si no, el marcador — DISTINTO por fila,
      // que es lo único que separa 68 clientes de uno solo.
      cedula: f.cedula || marcadorCedula(i, semilla),
      telefono: f.telefono || null,
      direccion: f.direccion || null,
      referencia: null,
      tienePrestamo: true,
      montoPrestado: f.capital,
      tasaInteres: tasa,
      // Se guarda la plana original para poder auditar de dónde salió la otra.
      tasaPlanaOrigen: f.interes ?? 0,
      diasPlazo,
      frecuencia: f.frecuencia || 'diario',
      // Sin fecha en el archivo se usa hoy: el préstamo existe, y dejarlo sin
      // fecha lo manda al descarte.
      fechaInicio: f.fechaInicio || hoy,
    })
  })

  return { filas: listas, descartadas }
}
