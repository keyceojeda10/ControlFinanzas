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
      tasaInteres: f.interes ?? 0,
      diasPlazo,
      frecuencia: f.frecuencia || 'diario',
      // Sin fecha en el archivo se usa hoy: el préstamo existe, y dejarlo sin
      // fecha lo manda al descarte.
      fechaInicio: f.fechaInicio || hoy,
    })
  })

  return { filas: listas, descartadas }
}
