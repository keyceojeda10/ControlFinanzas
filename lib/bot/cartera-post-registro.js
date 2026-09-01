// lib/bot/cartera-post-registro.js — el momento en que el bot deja de vender.
//
// ══ POR QUÉ ESTE MOMENTO Y NO OTRO ═════════════════════════════════════════
//
// Medido en producción el 1 sep 2026, sobre las 475 organizaciones creadas
// desde junio:
//
//   · 201 nunca cargaron un cliente
//   · 189 se quedaron entre uno y cinco
//   ·  34 llegaron a 6–20 · 44 a 21–100 · 7 pasaron de cien
//
// El 82 % no pasa del quinto cliente. Y del otro lado, de todas las personas
// que han escrito al bot desde julio, **dos** preguntaron cómo pasar sus
// clientes. Nadie pide ayuda con algo que todavía no sabe que le va a costar:
// se lo encuentra después, solo, y para entonces ya no está hablando con nadie.
//
// De ahí la regla: **la migración por foto no se ofrece cuando la piden, se
// ofrece cuando la cuenta acaba de nacer.** Si el bot no lo saca sin que se lo
// pidan, no lo descubre nadie.
//
// ══ Y POR QUÉ CON BOTONES ══════════════════════════════════════════════════
//
// De los leads que contestan algo, la mitad se queda en dos o tres mensajes. Un
// botón no gasta ninguno de esos turnos en que la persona escriba lo que
// quiere. Las tres salidas cubren lo que de verdad pasa después: lo intento, lo
// hago a mano, o me atasqué.
//
// ⚠ ESTO NO PASA POR EL MODELO. Son respuestas fijas: el camino conocido no
// tiene por qué costar una llamada al modelo ni admitir improvisación. El
// modelo sigue atendiendo el texto libre.

/** Los ids viajan a WhatsApp y vuelven en `interactive.button_reply.id`. Si se
 *  cambian, dejan de casar con lo que ya está en el teléfono de la gente. */
import { EMPRESA } from '@/lib/bot-v2/producto'

export const BOTONES_CARTERA = [
  { id: 'cartera_foto',  titulo: 'Ver cómo se hace' },
  { id: 'cartera_mano',  titulo: 'Prefiero a mano' },
  { id: 'cartera_ayuda', titulo: 'Necesito ayuda' },
]

const SOPORTE     = '301 199 3001'
const HORARIO     = 'de lunes a domingo, de 7 de la mañana a 10 de la noche'
/* ⚠ EL LINK DE LOS VIDEOS NO SE ESCRIBE, SE IMPORTA. Hay una prueba que
   prohíbe enlaces de YouTube sueltos en toda la app: los tutoriales de marzo
   enseñaban la interfaz anterior al rediseño, y cada enlace repartido por
   correos y pantallas mandaba al cliente a ver algo que ya no existía. */
const LINK_VIDEOS = EMPRESA.linkTutoriales

/* ⚠ EL CAMINO QUE SE DICE AQUÍ TIENE QUE EXISTIR TAL CUAL.
 *
 * La primera versión decía «entre a Clientes y toque el botón de la cámara» y
 * «hasta 30 por foto». Las dos cosas eran falsas: la carga del cuaderno vive en
 * «Pasar mi cuaderno» (`/migrador`) y son **30 fotos de una vez**. Mandar a
 * alguien a la pantalla que no es lo deja exactamente donde no queríamos.
 *
 * Si esa pantalla se renombra o se mueve, hay que cambiar estos textos. */
export function mensajeBienvenida(nombre) {
  /* ⚠ NO ES UN «BIENVENIDO A NUESTRA PLATAFORMA». Es el aviso de la trampa en
     la que cae el 82 %: sentarse a teclear la cartera cliente por cliente y
     dejarla a medias. Se dice antes de que le pase, porque después ya no está
     hablando con nadie. */
  const saludo = nombre ? `Listo, ${nombre}, ` : 'Listo, '
  return `${saludo}tu cuenta ya quedó abierta. Bienvenido a Control Finanzas.

Un consejo, que es donde se atasca casi todo el mundo: no te sientes a escribir tu cartera cliente por cliente, porque la dejas a medias.

Entra a «Pasar mi cuaderno» y tómale foto a las hojas. De ahí salen los nombres y los montos solos, hasta 30 fotos de una vez.

¿Cómo prefieres empezar?`
}

/* ⚠ NINGUNA RAMA TERMINA SIN SALIDA. «No dejes que mande un mensaje y ya está»
   — el dueño. Un mensaje que cierra la conversación con alguien que acaba de
   registrarse es justo el lead que se va a perder en los próximos cinco días.

   Y el teléfono va DESPUÉS de atender, nunca en lugar de atender: lo que
   convertía al 1 % era el traspaso —«eso se lo muestran en vivo, escríbales al
   301» y fin—, no el número en sí. */
const SALIDAS = [
  { id: 'cartera_videos', titulo: 'Ver los videos' },
  { id: 'cartera_ayuda',  titulo: 'Necesito ayuda' },
]

const RESPUESTAS = {
  cartera_foto: {
    texto: `Es más rápido de lo que parece:

En el menú entras a «Pasar mi cuaderno» y le tomas foto a las hojas. Derechas y con buena luz, que se lean los números.

Te salen los nombres y los montos en una lista. Tú revisas, corriges lo que esté mal y guardas. Sirve la cartulina de un cliente y también la hoja con la lista de todos.

Si te queda alguna duda, pregúntame por aquí lo que sea.`,
    botones: SALIDAS,
    avisar: false,
  },

  cartera_mano: {
    texto: `Sin problema. En Clientes, con el botón de más (+) los vas metiendo uno por uno.

Eso sí: si pasas de veinte o treinta, la foto del cuaderno te ahorra la noche entera, y ahí sigue cuando la quieras.

Cualquier cosa que necesites mientras los cargas, me escribes.`,
    botones: [
      { id: 'cartera_foto',   titulo: 'Ver cómo se hace' },
      { id: 'cartera_videos', titulo: 'Ver los videos' },
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
