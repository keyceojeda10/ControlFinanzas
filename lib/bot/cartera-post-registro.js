// lib/bot/cartera-post-registro.js — el momento en que el bot deja de vender.
//
// ══ POR QUÉ ESTE MOMENTO Y NO OTRO ═════════════════════════════════════════
//
// Medido en producción el 1 sep 2026, sobre las 475 organizaciones creadas
// desde junio: 201 nunca cargaron un cliente y 189 se quedaron entre uno y
// cinco. El 82 % no pasa del quinto. Y de todas las personas que han escrito al
// bot desde julio, DOS preguntaron cómo pasar sus clientes: nadie pide ayuda
// con algo que todavía no sabe que le va a costar.
//
// De ahí la regla: **cargar la cartera no se explica cuando la piden, se ofrece
// cuando la cuenta acaba de nacer**, que además es cuando la persona todavía
// tiene el teléfono en la mano.
//
// ══ SE OFRECEN LAS TRES VÍAS, NO SE EMPUJA NINGUNA ═════════════════════════
//
// ⚠ LA PRIMERA VERSIÓN INSISTÍA CON LA FOTO EN CADA MENSAJE. El dueño: «te
// desesperabas mucho por decir que se podría subir los clientes por imágenes, y
// no es así: se dan las opciones». Tenía razón dos veces, porque además me
// había dejado fuera una vía que existe.
//
// Las tres, tal como están en el menú de la app:
//
//   · uno por uno ....... Clientes, botón de más (+)
//   · con fotos ......... «Pasar mi cuaderno» (`/migrador`), hasta 30 fotos
//   · con un Excel ...... «Importar Excel» (`/carga-masiva`), acepta .xlsx,
//                         .xls y CSV, y detecta las columnas solo — no hace
//                         falta plantilla
//
// El dato del 82 % es la razón para SACAR el tema, no un sermón que soltarle al
// cliente. Se le dan las opciones y elige.
//
// ⚠ EL CAMINO QUE SE DICE AQUÍ TIENE QUE EXISTIR TAL CUAL. Una versión anterior
// mandaba a «Clientes, botón de la cámara», que no existe. Si esas pantallas se
// renombran o se mueven, hay que cambiar estos textos.

import { EMPRESA } from '@/lib/bot-v2/kb'

export const BOTONES_CARTERA = [
  { id: 'cartera_foto',  titulo: 'Con fotos' },
  { id: 'cartera_excel', titulo: 'Con un Excel' },
  { id: 'cartera_mano',  titulo: 'Uno por uno' },
]

const SOPORTE = EMPRESA.telefonoSoporte
const HORARIO = EMPRESA.horarioSoporteLargo
/* ⚠ EL LINK DE LOS VIDEOS NO SE ESCRIBE, SE IMPORTA. Hay una prueba que
   prohíbe enlaces de YouTube sueltos en toda la app: los tutoriales de marzo
   enseñaban la interfaz anterior al rediseño, y cada enlace repartido por
   correos y pantallas mandaba al cliente a ver algo que ya no existía. */
const LINK_VIDEOS = EMPRESA.linkTutoriales

/* ── LA CARTERA GRANDE SE LA CARGAMOS NOSOTROS (12 oct 2026) ──
   De los que declaran más de 100 clientes, solo el 9 % llega a cargarlos, y sin
   cartera nadie paga. A quien dijo en el formulario que maneja 50 o más, «uno
   por uno» es una burla: ese botón se cambia por el del asesor, que abre una
   carga con asesor (lib/carga-asesor/) para que las fotos o el Excel que mande
   por aquí mismo se peguen a ella. */
export const MINIMO_CARTERA_GRANDE = 50

/** ¿Declaró 50 clientes o más? Los rangos del formulario van por su piso. */
export function esCarteraGrande(cantClientes) {
  const t = String(cantClientes ?? '').toLowerCase()
  if (!t || /menos/.test(t)) return false
  const n = Number((t.match(/\d+/) || [])[0])
  return Number.isFinite(n) && n >= MINIMO_CARTERA_GRANDE
}

export const BOTON_ASESOR = { id: 'cartera_asesor', titulo: 'Que me la carguen' }

/** Los tres botones de la bienvenida: a la cartera grande, el asesor en vez de «uno por uno». */
export function botonesCartera({ grande = false } = {}) {
  return grande ? [BOTONES_CARTERA[0], BOTONES_CARTERA[1], BOTON_ASESOR] : BOTONES_CARTERA
}

export function mensajeBienvenida(nombre, { grande = false } = {}) {
  const saludo = nombre ? `Listo, ${nombre}, ` : 'Listo, '
  if (grande) {
    return `${saludo}tu cuenta ya quedó abierta. Bienvenido a Control Finanzas.

Lo primero es pasar tus clientes. Como manejas muchos, si prefieres te los cargamos nosotros: nos mandas las fotos de las hojas o el Excel y en máximo 24 horas los tienes listos. También los puedes subir tú mismo con fotos o con el Excel.

¿Cómo prefieres hacerlo?`
  }
  return `${saludo}tu cuenta ya quedó abierta. Bienvenido a Control Finanzas.

Lo primero es pasar tus clientes, y lo puedes hacer como te quede mejor: uno por uno, tomándole foto a las hojas de tu cuaderno, o subiendo el Excel que ya tengas.

¿Cómo prefieres hacerlo?`
}

/* ⚠ NINGUNA RAMA TERMINA SIN SALIDA. «No dejes que mande un mensaje y ya está»
   — el dueño. Quien acaba de registrarse y se queda sin a dónde seguir es justo
   el lead que se pierde en los próximos días.

   Y el teléfono va DESPUÉS de atender, nunca en lugar de atender: lo que
   convertía al 1 % era el traspaso —«eso se lo muestran en vivo, escríbales al
   301» y fin—, no el número en sí. */
const SALIDAS = [
  { id: 'cartera_videos', titulo: 'Ver los videos' },
  { id: 'cartera_ayuda',  titulo: 'Necesito ayuda' },
]

const RESPUESTAS = {
  cartera_foto: {
    texto: `En el menú entras a «Pasar mi cuaderno» y le tomas foto a las hojas. Derechas y con buena luz, que se lean los números.

Te salen los nombres y los montos en una lista: revisas, corriges lo que esté mal y guardas. Puedes mandar hasta 30 fotos de una vez, y sirve tanto la cartulina de un cliente como la hoja con la lista de todos.

Cualquier duda me la escribes por aquí.`,
    botones: SALIDAS,
    avisar: false,
  },

  cartera_excel: {
    texto: `En el menú entras a «Importar Excel» y subes el archivo.

No necesitas una plantilla ni acomodar nada: subes el que ya tengas y el sistema detecta solo las columnas. Acepta Excel y CSV. Después revisas lo que leyó y guardas.

Si el archivo te da problema, me lo dices y lo miramos.`,
    botones: SALIDAS,
    avisar: false,
  },

  cartera_mano: {
    texto: `En Clientes, con el botón de más (+) los vas metiendo uno por uno.

Si en algún momento se te hacen muchos, ahí siguen las otras dos: la foto del cuaderno y la importación desde Excel.

Cualquier cosa que necesites mientras los cargas, me escribes.`,
    botones: [
      { id: 'cartera_foto',   titulo: 'Con fotos' },
      { id: 'cartera_excel',  titulo: 'Con un Excel' },
      { id: 'cartera_ayuda',  titulo: 'Necesito ayuda' },
    ],
    avisar: false,
  },

  cartera_videos: {
    texto: `Claro. Tenemos el curso completo en video, paso a paso, desde crear la cuenta hasta cuadrar la caja de la noche:

${LINK_VIDEOS}

Cada uno dura entre dos y cinco minutos, y dentro del sistema tienes también las guías escritas de cada pantalla.

Si algo no te queda claro, me preguntas por aquí.`,
    botones: [{ id: 'cartera_ayuda', titulo: 'Necesito ayuda' }],
    avisar: false,
  },

  /* Abre la carga con asesor (`abrirCarga`, lo hace el webhook): sin eso, las
     fotos que mande a continuación no se pegarían a nada y le contestaría el
     bot de ventas. */
  cartera_asesor: {
    texto: `Listo. Mándame por aquí las fotos de las hojas o el Excel, todo junto y tal cual lo tienes. Si te queda más fácil, también los puedes subir en ${EMPRESA.linkApp.replace(/\/$/, '')}/cargar-cartera

Una persona del equipo revisa cada cliente y te aviso por aquí cuando quede cargada, en máximo 24 horas.`,
    botones: [],
    avisar: false,
    abrirCarga: true,
  },

  cartera_ayuda: {
    texto: `Cuéntame en qué parte te quedaste y lo vemos por aquí mismo, sin apuro.

Y si prefieres que te ayude una persona del equipo, nuestro soporte técnico está en el ${SOPORTE}, ${HORARIO}.`,
    botones: [{ id: 'cartera_videos', titulo: 'Ver los videos' }],
    avisar: true,
  },
}

/** La respuesta fija de un botón del momento post-registro, o `null` si el id
 *  no es de aquí (entonces sigue el camino normal). */
export function respuestaDeBoton(id) {
  return RESPUESTAS[id] ?? null
}

export function esBotonDeCartera(id) {
  return Object.prototype.hasOwnProperty.call(RESPUESTAS, String(id ?? ''))
}
