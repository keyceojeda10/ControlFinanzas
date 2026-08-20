// lib/sitio-de-la-lista.js
//
// ══ VOLVER AL CLIENTE DONDE IBA COBRANDO ═══════════════════════════════════
//
// «que cuando salga de un préstamo vuelva al cliente donde iba cobrando»
//   — INVERSIONESJYM por el banner, 19 ago 2026.
//
// Tienen UNA ruta, BOSA, con 322 clientes. Cada vez que el cobrador entraba a
// una ficha y volvía, la lista aparecía arriba del todo: bajar a mano, buscar
// el nombre entre trescientas tarjetas iguales, seguir. Trescientas veces.
//
// ⚠ LA MÁQUINA YA EXISTÍA, ENGANCHADA A UN SOLO CAMINO.
// La pantalla de la ruta sabía hacer esto —guardaba el cliente, el
// desplazamiento y el modo de vista, y al volver resaltaba la ficha dos
// segundos—, pero lo tenía escrito dentro de sí misma y solo lo llamaba al ir
// a COBRAR. Tocar el nombre del cliente, que es el único destino posible
// cuando hoy no le toca cobro, salía sin guardar nada. Y «Cobros de hoy», la
// lista de clientes y la de préstamos no guardaban nada por ningún camino.
//
// Es el mismo fallo del comprobante de pago: se arregló una vía y se dejó la
// otra. Por eso esto vive aquí y no en ninguna pantalla — cuando mañana haya
// una quinta lista, importa cuatro funciones y ya está.

const PREFIJO = 'cf-sitio-'

// Lo que dura el resaltado al aterrizar. Igual que el de la ruta, que es el que
// el cobrador ya conoce.
export const MS_RESALTADO = 2200

/* ⚠ QUIÉN DESPLAZA DE VERDAD NO ES LA VENTANA.
   Las listas van dentro de un contenedor con `overflow-y: auto`, así que
   `window.scrollY` es SIEMPRE 0. Se busca en el DOM en vez de guardarse en una
   `ref` porque el contenedor cambia según el modo de vista y el ancho de la
   pantalla, y una referencia a la de ayer devuelve 0 sin avisar. */
export function contenedorQueDesplaza() {
  if (typeof document === 'undefined') return null
  let mejor = null
  for (const el of document.querySelectorAll('div, main, section')) {
    if (el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 300) {
      if (!mejor || el.clientHeight > mejor.clientHeight) mejor = el
    }
  }
  return mejor
}

export function desplazamientoActual() {
  if (typeof window === 'undefined') return 0
  return contenedorQueDesplaza()?.scrollTop ?? window.scrollY
}

/* Se llama JUSTO ANTES de salir de la pantalla, no en un `onScroll`: lo que
   hay que recordar es dónde estaba cuando se fue, no dónde estuvo. */
export function guardarSitio(clave, itemId) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(PREFIJO + clave, JSON.stringify({
      itemId: itemId == null ? null : String(itemId),
      y: desplazamientoActual(),
    }))
  } catch { /* modo privado, cuota llena: perder el sitio no puede romper el cobro */ }
}

/* SE CONSUME AL LEERLO. Si se quedara guardado, entrar a la lista por el menú
   —empezando el día, a propósito por arriba— daría un salto al cliente de
   ayer. Solo vale para el viaje de vuelta inmediato. */
export function tomarSitio(clave) {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const crudo = sessionStorage.getItem(PREFIJO + clave)
    if (!crudo) return null
    sessionStorage.removeItem(PREFIJO + clave)
    const sitio = JSON.parse(crudo)
    return sitio && typeof sitio === 'object' ? sitio : null
  } catch { return null }
}

/* ⚠ EL CLIENTE MANDA SOBRE LOS PÍXELES.
   La lista cambia entre que se sale y que se vuelve —al que se acaba de cobrar
   deja de tocarle y puede cambiarse de sitio—, así que el desplazamiento
   guardado apunta a otra fila. Buscar la ficha por su `id` acierta aunque la
   lista se haya movido; los píxeles quedan de respaldo, para cuando esa ficha
   ya no está (se filtró, se paginó, se cobró y se ocultó).

   Devuelve el elemento SOLO si aterrizó en él: quien llama decide si lo marca,
   y marcar por píxeles señalaría a quien no es. */
export function volverAlSitio(sitio, { ancla } = {}) {
  if (!sitio || typeof document === 'undefined') return null

  const id = sitio.itemId != null && typeof ancla === 'function' ? ancla(sitio.itemId) : null
  const el = id ? document.getElementById(id) : null
  if (el) {
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    return el
  }

  // `!= null` y no `if (sitio.y)`: el 0 es un desplazamiento válido —el
  // principio de la lista— y con la comprobación floja se descartaba.
  const y = sitio.y != null ? parseInt(sitio.y, 10) : NaN
  if (Number.isNaN(y)) return null
  const caja = contenedorQueDesplaza()
  if (caja) caja.scrollTop = y
  else window.scrollTo(0, y)
  return null
}

/* El resaltado no es adorno: con trescientas tarjetas iguales, aterrizar en el
   sitio correcto sin que nada diga cuál era obliga a releer nombres.
   Devuelve cómo quitarlo, para que la pantalla lo limpie si se desmonta antes
   de tiempo y no deje un anillo dorado clavado. */
export function marcarVuelta(el, ms = MS_RESALTADO) {
  if (!el || !el.classList) return () => {}
  el.classList.add('cf-vuelta')
  const t = setTimeout(() => el.classList.remove('cf-vuelta'), ms)
  return () => { clearTimeout(t); el.classList.remove('cf-vuelta') }
}
