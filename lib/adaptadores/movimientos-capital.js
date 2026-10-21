// lib/adaptadores/movimientos-capital.js — la lista de Capital → Movimientos,
// dicha para el dueño (DETALLES-CAJA-Y-CAPITAL #45, 19 oct 2026).
//
// Dos cosas que la lista enseñaba tal cual salían del libro:
//
//   · Al empezar el capital propio de una ruta se escriben DOS asientos que en
//     el capital del negocio se anulan (`empezarCapitalPropio`,
//     lib/rutas/traslado.js): «Capital propio: lo que Zona Norte movía con la
//     plata del negocio… +$333.200» y «Capital propio: Zona Norte empieza su
//     capital propio −$333.200». Para la dueña eran dos movimientos que no
//     explicaban nada. Van en UNA fila, en cero, con lo que pasó.
//   · El ajuste del cuadre decía «Cuadre de caja Camilo Ortiz (2026-10-19):
//     faltante - Lo trae mañana». Los nuevos ya se escriben bien en el origen
//     (`/api/caja/cuadre`); esto deja iguales a los viejos.
//
// Puro: la pantalla le pasa la página que trajo y pinta lo que devuelve.
import { diaDeCalendario } from '@/lib/notificacion-texto'
import { EMPIEZA_SU_CAPITAL } from '@/lib/rutas/capital-propio'

const CUADRE_VIEJO = /^Cuadre de caja (.+) \((\d{4}-\d{2}-\d{2})\): (corrección del cuadre|faltante|sobrante)(?: - (.*))?$/

/** «Faltante en el cuadre de Camilo Ortiz (19 oct) · Lo trae mañana». */
export function descripcionDeMovimiento(m) {
  const d = m?.descripcion ?? ''
  const v = CUADRE_VIEJO.exec(d)
  if (!v) return d
  const [, nombre, fecha, que, nota] = v
  const titulo = que === 'corrección del cuadre' ? 'Corrección del cuadre' : que === 'faltante' ? 'Faltante' : 'Sobrante'
  return descripcionDeCuadre({ titulo, nombre, fecha, nota })
}

/** El texto del ajuste del cuadre, el mismo al asentarlo y al editarlo. */
export function descripcionDeCuadre({ titulo, nombre, fecha, nota }) {
  return `${titulo} en el cuadre de ${nombre} (${diaDeCalendario(fecha)})${nota ? ` · ${nota}` : ''}`
}

/* ⚠ EDITAR EL CUADRE CAMBIA LA NOTA TAMBIÉN EN CAPITAL (DETALLES-CAJA-Y-
   CAPITAL #47). «Editar» reescribía la nota del cierre y el movimiento del
   faltante seguía con la de la primera confirmación: el cierre decía «Lo trae
   mañana, con la ruta» y Capital, «Lo trae mañanaLos trae mañana con la ruta».
   Solo cambia el TEXTO: el importe lo corrige `/api/caja/cuadre` con su propio
   asiento. Cada asiento conserva lo que fue —el primero, faltante o sobrante
   según hacia dónde movió el saldo; los siguientes, «Corrección del cuadre»—,
   también los escritos con el formato viejo. */
export function descripcionConNotaNueva(m, { nombre, fecha, nota }) {
  const d = m?.descripcion ?? ''
  const correccion = /^Corrección del cuadre /.test(d) || /^Cuadre de caja .+\): corrección del cuadre(?: - |$)/.test(d)
  const titulo = correccion ? 'Corrección del cuadre'
    : Number(m?.saldoNuevo) >= Number(m?.saldoAnterior) ? 'Sobrante' : 'Faltante'
  return descripcionDeCuadre({ titulo, nombre, fecha, nota })
}

/* Los dos asientos de una puesta en cero: misma ruta, mismo importe, signos
   contrarios y escritos en la misma transacción. Uno lleva «empieza su capital
   propio»; el otro es su contrapartida. */
const esPuestaEnCero = (m) => m?.referenciaTipo === 'ruta' && (m?.descripcion ?? '').includes(EMPIEZA_SU_CAPITAL)
const sonPareja = (a, b) => a && b
  && a.referenciaTipo === 'ruta' && b.referenciaTipo === 'ruta'
  && Math.round(Number(a.monto)) === Math.round(Number(b.monto))
  && Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) < 60_000
  && (esPuestaEnCero(a) !== esPuestaEnCero(b))

/* ⚠ EL SALDO DE LA FILA JUNTA ES EL DE DESPUÉS DE LOS DOS (DETALLES-CAJA-Y-
   CAPITAL #46). La fila heredaba el `saldoNuevo` del asiento «empieza su
   capital propio», que es el PRIMERO de la pareja: «Saldo: $5.067.267», el
   saldo de en medio ($5.400.467 − $333.200), en una fila que dice «no cambia
   tu capital». Va el del ÚLTIMO asiento, que es el de la fila anterior.

   ¿Cuál es el último? El de `createdAt` mayor; si empatan (misma transacción),
   aquel cuyo `saldoAnterior` es el `saldoNuevo` del otro: se escribió encima.
   Sin ninguna de las dos pistas, el que no es «empieza…», que
   `empezarCapitalPropio` escribe segundo. */
function ultimoDeLaPareja(a, b) {
  const ta = new Date(a.createdAt).getTime()
  const tb = new Date(b.createdAt).getTime()
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta > tb ? a : b
  const r = (n) => Math.round(Number(n))
  const encima = (x, y) => x.saldoAnterior != null && y.saldoNuevo != null && r(x.saldoAnterior) === r(y.saldoNuevo)
  if (encima(a, b) && !encima(b, a)) return a
  if (encima(b, a) && !encima(a, b)) return b
  return esPuestaEnCero(a) ? b : a
}

/**
 * Las filas de la lista: cada movimiento con su descripción legible, y la
 * pareja de una puesta en cero junta en una sola fila (`enCero: true`, monto 0).
 */
export function filasDeMovimientos(movimientos = []) {
  const lista = Array.isArray(movimientos) ? movimientos : []
  const filas = []
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i]
    const sig = lista[i + 1]
    /* Pasar plata entre cuentas: los dos asientos (sale y entra) en UNA fila,
       «De Nequi a Bancolombia», sin signo: el capital no cambia. */
    if (m?.tipo === 'traslado') {
      const pareja = sig?.tipo === 'traslado' && sig.referenciaId && sig.referenciaId === m.referenciaId
      filas.push({ ...m, entreCuentas: true })
      if (pareja) i += 1
      continue
    }
    if (sonPareja(m, sig)) {
      const empieza = esPuestaEnCero(m) ? m : sig
      const ultimo = ultimoDeLaPareja(m, sig)
      const primero = ultimo === m ? sig : m
      const nombre = (empieza.descripcion ?? '').replace(/^[^:]*:\s*/, '').replace(` ${EMPIEZA_SU_CAPITAL}`, '')
      filas.push({
        ...empieza,
        enCero: true,
        monto: 0,
        saldoAnterior: primero.saldoAnterior,
        saldoNuevo: ultimo.saldoNuevo,
        descripcion: `${nombre} empieza su capital propio · no cambia tu capital`,
      })
      i += 1
      continue
    }
    filas.push({ ...m, descripcion: descripcionDeMovimiento(m) })
  }
  return filas
}
