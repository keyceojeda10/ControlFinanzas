// lib/bot-v2/videos.js — CADA TUTORIAL POR SU URL (BOT v3).
//
// ══ POR QUÉ ══════════════════════════════════════════════════════════════════
//
// Hasta ahora, a quien pedía ver cómo funciona algo se le mandaba la lista
// entera: 17 vídeos y que se busque el suyo. A alguien que pregunta «cómo creo
// una ruta» hay que darle el vídeo de las rutas, no la playlist.
//
// Los vídeos se publicaron el 24 y 25 de agosto de 2026 y **sí enseñan la
// interfaz de hoy**: comprobado sacando fotogramas de los ficheros que se
// subieron y comparándolos con el espejo corriendo el código actual (la
// cabecera, la barra de navegación y los dos botones de la pantalla de capital
// coinciden). Es la diferencia con las guías de capturas, que son del 15 de
// agosto y quedaron desfasadas.
//
// ⚠ Las URL están escritas a mano y verificadas una a una contra la playlist
//   (`yt-dlp --flat-playlist`) el 8 sep 2026. El modelo NUNCA escribe una URL
//   de vídeo: un enlace inventado mandado a un cliente es peor que no mandar
//   nada. Aquí y solo aquí.

import { mejorCoincidencia, frasesDe, PIDE_COMO, norm } from './emparejar.js'
import { EMPRESA } from './kb.js'

/* `desde` en segundos manda al minuto exacto. El de cobradores dura 5:39 y la
   parte de asignar la ruta empieza en el 3:40: sin la marca, el cliente que
   pregunta eso tiene que buscarla. */
const url = (id, desde) => `https://youtu.be/${id}${desde ? `?t=${desde}` : ''}`

/* Los 16 vivos de la playlist «Tutoriales Control Finanzas V2».
   `claves` decide con qué preguntas casa cada uno. */
export const VIDEOS = [
  { id: 'i3wTsg1uKKg', n: 1, titulo: 'Cómo registrarse y crear la cuenta', dur: '1:43',
    claves: 'crear cuenta, registrarse, abrir cuenta, empezar, darse de alta' },
  { id: '1LHUf6P5GgQ', n: 2, titulo: 'Cómo instalar la app en el celular', dur: '1:12',
    claves: 'instalar app, descargar app, instalar la aplicacion, descargar la aplicacion, poner el icono, acceso directo, instalar en el celular, instalar en el computador, android, iphone, aplicacion en el telefono, donde se abre la aplicacion, volver a entrar, como entro a la aplicacion, como entro al sistema, como ingreso a la aplicacion, por donde entro, se me perdio la aplicacion, no encuentro la aplicacion, como se llama la aplicacion, abrir la aplicacion' },
  { id: 'YnKwdrmQSjM', n: 3, titulo: 'Primeros pasos si cobra usted mismo', dur: '2:29',
    claves: 'primeros pasos, por donde empiezo, como funciona el sistema, empezar a usar, no entiendo como funciona, recorrido inicial, configurar el negocio' },
  { id: 'yBYlqReI0ro', n: 4, titulo: 'Primeros pasos si tiene cobradores', dur: '2:15',
    claves: 'primeros pasos con cobradores, empezar con trabajadores, configurar cobradores, modo equipo' },
  { id: 'GzrKD5wAyIk', n: 5, titulo: 'Cómo pasar la cartera del cuaderno a la app', dur: '1:07',
    claves: 'pasar el cuaderno, pasar mis clientes, pasar la cartera, cargar mis clientes, importar clientes, subir la cartera, pasar del excel, meter los clientes que ya tengo, clientes de antes, clientes de meses anteriores, cartulinas' },
  { id: '5AB_n3BU8OU', n: 6, titulo: 'Cómo registrar un cliente nuevo', dur: '2:18',
    claves: 'crear cliente, nuevo cliente, agregar cliente, registrar cliente, meter un cliente, dar de alta un cliente, cartulina, importar la tarjeta del cliente' },
  { id: '08Ma-JIASqM', n: 7, titulo: 'La pantalla de clientes y la ficha por dentro', dur: '2:53',
    claves: 'pantalla de clientes, ficha del cliente, ver un cliente, datos del cliente, buscar un cliente, editar un cliente, eliminar un cliente, inactivar un cliente' },
  { id: 'NJD6cW1ucOk', n: 8, titulo: 'Cómo crear un préstamo paso a paso', dur: '2:59',
    claves: 'crear prestamo, nuevo prestamo, prestar, registrar prestamo, dar credito, hacer un prestamo, hago un prestamo, modos de interes, plazo, cuotas' },
  { id: 'SNDHOnIP-fA', n: 10, titulo: 'Gestionar los préstamos: filtros, mora y renovaciones', dur: '3:08',
    claves: 'pantalla de prestamos, renovar prestamo, mora, filtros, prestamo por dentro, editar prestamo, eliminar prestamo, refinanciar, abonar, registrar pago, cobrar una cuota' },
  { id: 'bS5jsePzpEM', n: 12, titulo: 'Cómo crear y organizar las rutas de cobro', dur: '4:58',
    claves: 'crear ruta, nueva ruta, rutas de cobro, organizar la ruta, ordenar el recorrido, zona de cobro, orden de visitas' },
  { id: 'RGK62rs0Sg8', n: 13, titulo: 'Cómo crear y manejar los cobradores', dur: '5:39',
    claves: 'crear cobrador, agregar cobrador, dar acceso a un cobrador, usuario para el cobrador, permisos del cobrador, manejar cobradores, trabajadores' },
  /* El mismo vídeo, entrando en el minuto 3:40, donde explica asignar la ruta.
     Es la toma «sin ruta no cobra nada», y la pregunta llegó dos veces en la
     muestra de conversaciones reales: «¿a esa ruta le puedo asignar un
     cobrador?». No hacía falta grabar nada nuevo: hacía falta encontrarlo. */
  { id: 'RGK62rs0Sg8', n: 13, desde: 220, titulo: 'Cómo asignarle una ruta a un cobrador', dur: '5:39',
    claves: 'asignar cobrador a la ruta, asignar ruta al cobrador, poner un cobrador en la ruta, cobrador sin ruta, que ruta lleva el cobrador, cambiar de ruta al cobrador, asignarle la ruta' },
  { id: 'aca7TtTVXbw', n: 14, titulo: 'La caja del cobrador', dur: '1:45',
    claves: 'caja del cobrador, lo que entrega el cobrador, cierre del cobrador, fajo' },
  { id: 'mcxfV7lGM34', n: 15, titulo: 'La caja del día si cobra usted', dur: '1:47',
    claves: 'caja del dia, cerrar la caja, cierre del dia, leer la caja, ver caja, saldo del dia, cuanto entro y salio' },
  { id: '2mPiptEypnk', n: 16, titulo: 'Qué le tiene que entregar cada cobrador', dur: '2:00',
    claves: 'cuadrar con los cobradores, cuanto entrega cada cobrador, cuadre del dia, revisar diferencias, entregar el dinero' },
  { id: 'wyQdkrqVHNg', n: 17, titulo: 'El capital: su fondo de préstamos', dur: '4:18',
    claves: 'capital, mi plata, fondo de prestamos, inyectar capital, agregar capital, retirar capital, meter plata, dinero disponible para prestar, saldo del capital' },
  { id: '2lQ800X0_u8', n: 18, titulo: 'Reportes, gastos y todo lo del menú «Más»', dur: '2:16',
    claves: 'reportes, informes, gastos, menu mas, exportar, excel, estadisticas, analiticas, agregar gasto, registrar gasto' },
  { id: 'ohsPvDXqca8', n: 19, titulo: 'Los buscadores: cómo encontrar cualquier cosa', dur: '2:04',
    claves: 'buscador, buscar, encontrar una pantalla, no encuentro, donde esta, atajos' },
].map((v) => ({ ...v, url: url(v.id, v.desde), clave: `${v.id}#${v.desde || 0}` }))

/* ⚠ EL 06 ESTUVO RETIRADO UNAS HORAS EL 8 SEP 2026 y volvió con la apelación
 * aprobada. YouTube lo quitó por su política de acoso: en el minuto 0:55 se
 * escriben un nombre, una cédula, un celular y una dirección en el formulario,
 * y el filtro los leyó como datos de una persona real. Eran de atrezzo, y así
 * se explicó en la apelación.
 *
 * De ahí salió el arreglo de raíz: los datos de demostración de los guiones de
 * grabación pasaron a `1000000N` y `30000000NN`, que se leen de un vistazo
 * como falsos. Si el 07 cae por lo mismo, se apela igual. */

const ENTRADAS = VIDEOS.map((v) => ({ clave: v.clave, frases: frasesDe([...v.claves.split(','), v.titulo]) }))

/* ⚠ Si dos vídeos empatan no se manda ninguno, y eso es lo correcto: «cómo
   hago para editar la fecha inicial del préstamo» empata entre el de crear y
   el de gestionar, así que va a una persona. Editar fechas de un préstamo con
   pagos encima es delicado, y ahí es mejor una persona que un vídeo genérico. */

/** El vídeo que contesta esa pregunta, o null si no hay uno claro. */
export function elegirVideo(texto) {
  const t = norm(texto)
  if (!t || t.split(' ').length < 2) return null
  const clave = mejorCoincidencia(t, ENTRADAS, { minimo: 4 })
  return clave ? VIDEOS.find((v) => v.clave === clave) : null
}

/** ¿Está pidiendo ver algo, más que preguntando por ello? */
export function pideVer(texto) {
  return /\bv[ií]deos?\b|\btutorial(?:es)?\b|\bmu[eé]stre?me\b|\bense[ñn]e/i.test(String(texto || '')) || PIDE_COMO.test(norm(texto))
}

/** El mensaje con UN vídeo concreto. Corto: el vídeo es la respuesta. */
export function textoDeVideo(v, { registrado = false } = {}) {
  const cierre = registrado
    ? `Si algo no le sale, escriba al ${EMPRESA.telefonoSoporte} y lo acompañan en vivo.`
    : `Y si quiere ir probándolo mientras, son ${EMPRESA.diasPrueba} días gratis sin tarjeta.`
  return `Claro, ahí lo explican paso a paso (${v.dur}):\n\n${v.url}\n\n${cierre}`
}

/** Y la lista entera, para cuando piden «los videos» sin decir de qué. */
export function textoDeTodos({ registrado = false } = {}) {
  return registrado
    ? `Claro, aquí están todos los tutoriales en video:\n\n${EMPRESA.linkTutoriales}\n\nEstán en orden, desde lo básico hasta la caja. Si no encuentra el que necesita, escriba al ${EMPRESA.telefonoSoporte}.`
    : `Claro, tenemos los tutoriales en video, paso a paso:\n\n${EMPRESA.linkTutoriales}\n\nAhí va desde crear la cuenta hasta cuadrar la caja de la noche. Cada uno dura entre 1 y 5 minutos.\n\nY si quiere ir probando mientras los ve, son ${EMPRESA.diasPrueba} días gratis sin tarjeta.`
}
