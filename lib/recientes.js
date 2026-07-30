// ── LOS ULTIMOS QUE ABRISTE ──
//
// T34-03 dice por que existe esto: hoy la busqueda vacia REPITE el texto del
// propio campo —arriba «buscar clientes, rutas, caja, configuracion», debajo
// «busca clientes, prestamos, rutas, caja, gastos, configuracion…»— y ocupa la
// pantalla entera para no decir nada.
//
// Una busqueda vacia es el mejor sitio para AHORRAR la busqueda. En este
// negocio se vuelve al mismo cliente varias veces al dia: el que no pago ayer,
// el que dijo que pasaba por la tarde, el que esta en mora. Enseñar esos tres
// evita teclear el nombre otra vez con un teclado en pantalla.
//
// Vive en localStorage porque es de ESTE telefono, no de la cuenta: el cobrador
// y el dueño no abren lo mismo, y no vale la pena una tabla para tres filas.

const CLAVE = 'cf:recientes'
const MAX = 3          // los que dibuja la lamina; mas empujan los atajos fuera
const GUARDA = 12      // se guardan mas por si alguno se borra o repite

/** Un dia en milisegundos, para no repetir el numero en tres sitios. */
const DIA = 86_400_000

/**
 * Cuanto hace, en el idioma de la lamina: «hace 1 h», «ayer», «hace 3 d».
 * Puro a proposito —recibe el ahora— para poder probarlo sin tocar el reloj.
 */
export function comoHace(cuando, ahora = Date.now()) {
  const ms = ahora - cuando
  if (!Number.isFinite(ms) || ms < 0) return ''
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  // «ayer» solo si de verdad fue ayer; a las 50 horas «ayer» seria mentira.
  const dias = Math.floor(ms / DIA)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} d`
  const semanas = Math.floor(dias / 7)
  if (semanas < 5) return `hace ${semanas} sem`
  return 'hace tiempo'
}

/**
 * Deja constancia de que se abrio algo. Se llama desde la pantalla de detalle,
 * que es la unica que sabe el nombre: la ruta sola solo trae el id.
 *
 * `fila`: { tipo, id, nombre, detalle?, estado? }
 *   tipo   — 'cliente' | 'prestamo' | 'ruta'; decide a donde se vuelve
 *   estado — 'rojo' | 'verde' | 'oro'; el aro del avatar, que es el estado
 */
export function anotarReciente(fila) {
  if (typeof window === 'undefined') return
  if (!fila?.id || !fila?.nombre) return
  try {
    const previos = leerCrudo().filter((r) => !(r.tipo === fila.tipo && r.id === fila.id))
    const nuevo = [{ ...fila, cuando: Date.now() }, ...previos].slice(0, GUARDA)
    window.localStorage.setItem(CLAVE, JSON.stringify(nuevo))
  } catch {
    // Modo incognito, cuota llena o localStorage bloqueado. No es critico:
    // sin recientes la busqueda sigue funcionando, solo pide teclear.
  }
}

function leerCrudo() {
  try {
    const bruto = window.localStorage.getItem(CLAVE)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

/** El destino de cada tipo. Fuera de aqui nadie tiene que saberlo. */
export function rutaDe(fila) {
  if (fila?.tipo === 'cliente') return `/clientes/${fila.id}`
  if (fila?.tipo === 'prestamo') return `/prestamos/${fila.id}`
  if (fila?.tipo === 'ruta') return `/rutas/${fila.id}`
  return null
}

/**
 * Los recientes listos para `BusquedaGlobal`: en el orden en que se abrieron,
 * con el «hace 1 h» ya calculado y en la forma exacta que espera su `Lista`
 * —`iniciales` o `icono`, nunca los dos, porque una ruta con iniciales se
 * leeria como un cliente.
 */
export function leerRecientes(ahora = Date.now()) {
  if (typeof window === 'undefined') return []
  return leerCrudo()
    .slice(0, MAX)
    .map((r) => ({
      id: `${r.tipo}-${r.id}`,
      tipo: r.tipo,
      idReal: r.id,
      nombre: r.nombre,
      detalle: r.detalle || '',
      estado: r.estado,
      iniciales: r.tipo === 'ruta' ? undefined : iniciales(r.nombre),
      cuando: comoHace(r.cuando, ahora),
      href: rutaDe(r),
    }))
}

/** Las dos primeras letras del nombre, como en la lamina («SO», «HP»). */
export function iniciales(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
