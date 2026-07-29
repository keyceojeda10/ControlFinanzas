// lib/adaptadores/revision.js — entre el lector (Excel u OCR) y «04 · Revisión».
//
// EL DISEÑO SE ROMPE CON DATOS REALES, Y AQUÍ SE ARREGLA.
//
// El mockup enseña 7 clientes y dice «Revisa los 2 marcados en ámbar». Con el
// export real —68 créditos— pasa esto: a los 68 les falta la cédula, porque el
// sistema de origen NO TIENE columna de cédula. «Revisa los 68 marcados en
// ámbar» no es un aviso, es la lista entera pintada de ámbar; y una pantalla
// donde todo está marcado es una pantalla donde nada está marcado.
//
// La distinción que hace falta: cuando a TODAS las filas les falta el mismo
// dato, no es un problema por fila — es una columna que el archivo no trae. Eso
// se dice una vez arriba y se resuelve una vez, no 68 veces hacia abajo.
//
// Los 44 teléfonos rotos son el caso intermedio: fallan muchos pero no todos,
// así que sí son un problema por fila.

/** Por encima de esto, el reparo deja de ser de la fila y pasa a ser del archivo. */
export const UMBRAL_COLUMNA = 0.9

const NOMBRE_CAMPO = {
  cedula: 'la cédula',
  telefono: 'el teléfono',
  direccion: 'la dirección',
  frecuencia: 'cada cuánto cobra',
  capital: 'el monto prestado',
  cuota: 'las cuotas',
  nombre: 'el nombre',
}

/**
 * Separa los reparos en dos montones: los que le pasan a casi todo el archivo
 * (una columna que falta) y los que le pasan a filas sueltas (un dato a mirar).
 */
export function repartirReparos(filas = []) {
  const total = filas.length
  if (!total) return { deColumna: [], porFila: [] }

  const cuenta = new Map()
  for (const f of filas) {
    for (const r of f.reparos ?? []) {
      cuenta.set(r.campo, (cuenta.get(r.campo) ?? 0) + 1)
    }
  }

  const deColumna = []
  const porFila = []
  for (const [campo, n] of cuenta) {
    ;(n / total >= UMBRAL_COLUMNA ? deColumna : porFila).push({
      campo,
      n,
      // «El archivo no trae la cédula» dice qué pasa y de quién es la culpa.
      // «Falta la cédula» repetido 68 veces suena a 68 errores del usuario.
      texto: n === total
        ? `El archivo no trae ${NOMBRE_CAMPO[campo] ?? campo}`
        : `${n} sin ${NOMBRE_CAMPO[campo] ?? campo}`,
    })
  }

  const orden = (a, b) => b.n - a.n
  return { deColumna: deColumna.sort(orden), porFila: porFila.sort(orden) }
}

/**
 * El titular. «Encontré 68 clientes» y, debajo, cuántos hay que mirar de
 * verdad — contando solo los reparos que son suyos, no los de columna.
 */
export function titular(filas = [], deColumna = []) {
  const total = filas.length
  const camposDeColumna = new Set(deColumna.map((c) => c.campo))
  const aRevisar = filas.filter((f) =>
    (f.reparos ?? []).some((r) => !camposDeColumna.has(r.campo))
  ).length

  return {
    total,
    aRevisar,
    titulo: `Encontré ${total} cliente${total === 1 ? '' : 's'}`,
    // Sin nada que revisar NO se dice «revisa los 0»: se dice que está limpio.
    detalle: aRevisar === 0
      ? 'No se crea nada hasta que confirmes.'
      : `Revisa ${aRevisar === 1 ? 'el marcado' : `los ${aRevisar} marcados`} en ámbar. No se crea nada hasta que confirmes.`,
  }
}

/**
 * Una fila de la lista. `contexto` es la línea gris bajo el nombre: si la fila
 * tiene un reparo suyo, ahí va el reparo en vez de los datos — el problema
 * pesa más que el dato correcto que hay al lado.
 */
/**
 * Cuando una fila tiene varios reparos, la línea gris solo cabe uno: manda el
 * más grave. Y grave aquí significa PLATA. En el archivo real, Robinson y Omar
 * son los dos préstamos cuyas cuotas no suman el total, y llevan además el
 * teléfono roto: sin este orden la tarjeta decía «Teléfono incompleto» y
 * escondía justo lo que hay que mirar. Un teléfono se pregunta; una cuota mal
 * puesta se cobra mal durante meses.
 */
const GRAVEDAD = ['capital', 'cuota', 'frecuencia', 'nombre', 'cedula', 'telefono', 'direccion']
const peso = (campo) => {
  const i = GRAVEDAD.indexOf(campo)
  return i === -1 ? GRAVEDAD.length : i
}

export function adaptarFila(f, camposDeColumna, formatear) {
  const propios = (f.reparos ?? [])
    .filter((r) => !camposDeColumna.has(r.campo))
    .sort((a, b) => peso(a.campo) - peso(b.campo))
  const datos = [
    f.cedula && `CC ${f.cedula}`,
    f.frecuencia,
    f.interes != null && `${f.interes}%`,
  ].filter(Boolean).join(' · ')

  return {
    nombre: f.nombre || 'Sin nombre',
    contexto: propios.length ? propios[0].texto : (datos || null),
    monto: f.capital != null ? formatear(f.capital) : null,
    // Ámbar solo por lo que es suyo. Si todo el archivo comparte el hueco, la
    // fila no tiene por qué llevar la marca.
    revisar: propios.length > 0,
    reparos: propios,
  }
}

export function adaptarRevision(lectura, formatear = String) {
  const filas = lectura?.filas ?? []
  const { deColumna, porFila } = repartirReparos(filas)
  const campos = new Set(deColumna.map((c) => c.campo))

  return {
    ...titular(filas, deColumna),
    deColumna,
    porFila,
    escala: lectura?.escala ?? null,
    filas: filas.map((f) => adaptarFila(f, campos, formatear)),
    cartera: formatear(lectura?.resumen?.cartera ?? 0),
  }
}
