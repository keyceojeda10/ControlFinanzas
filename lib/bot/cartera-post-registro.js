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
export const BOTONES_CARTERA = [
  { id: 'cartera_foto',  titulo: 'Ver cómo se hace' },
  { id: 'cartera_mano',  titulo: 'Prefiero a mano' },
  { id: 'cartera_ayuda', titulo: 'Necesito ayuda' },
]


/* ⚠ EL CAMINO QUE SE DICE AQUÍ TIENE QUE EXISTIR TAL CUAL.
 *
 * La primera versión decía «entre a Clientes y toque el botón de la cámara» y
 * «hasta 30 por foto». Las dos cosas eran falsas: la carga del cuaderno vive en
 * «Pasar mi cuaderno» (`/migrador`), y son **30 fotos de una vez**, no 30
 * clientes por foto. Mandar a alguien a una pantalla que no es lo deja
 * exactamente donde no queríamos: atascado y sin a quién preguntar.
 *
 * Si esa pantalla se renombra o se mueve, hay que cambiar estos textos. */
export function mensajeBienvenida(nombre) {
  /* ⚠ NO ES UN «BIENVENIDO A NUESTRA PLATAFORMA». Es el aviso de la trampa en
     la que se cae el 82 %: sentarse a teclear la cartera cliente por cliente y
     dejarla a medias. Se dice antes de que le pase, porque después ya no está
     hablando con nadie. */
  const saludo = nombre ? `Listo, ${nombre}, ` : 'Listo, '
  return `${saludo}tu cuenta ya quedó abierta.

Un consejo, que es donde se atasca casi todo el mundo: no te sientes a escribir tu cartera cliente por cliente, porque la dejas a medias.

Entra a «Pasar mi cuaderno» y tómale foto a las hojas. De ahí salen los nombres y los montos solos, hasta 30 fotos de una vez.`
}

/* ⚠ EL NÚMERO VA DESPUÉS DE ATENDER, NUNCA EN LUGAR DE ATENDER.
   Medido: 274 derivaciones a ese número en julio y agosto, y 4 tickets de
   soporte en toda la historia. Lo que convertía al 1 % era el traspaso —«eso se
   lo muestran en vivo, escríbales al 301» y fin de la conversación—, no el
   número en sí. Quien dice «no pude» se registra en el 44 % de los casos y paga
   en el 10 %: son clientes atascados, y se atienden aquí. El teléfono es una
   salida más, para quien prefiera llamar. */
const RESPUESTAS = {
  cartera_foto: {
    texto: `Es más rápido de lo que parece:

En el menú entras a «Pasar mi cuaderno» y le tomas foto a las hojas. Derechas y con buena luz, que se lean los números.

Te salen los nombres y los montos en una lista. Tú revisas, corriges lo que esté mal y guardas.

Sirve la cartulina de un cliente y también la hoja con la lista de todos. Si algo no te cuadra, me escribes por aquí.`,
    avisar: false,
  },
  cartera_mano: {
    texto: `Sin problema. En Clientes, con el botón de más (+) los vas metiendo uno por uno.

Eso sí: si pasas de veinte o treinta, la foto del cuaderno te ahorra la noche entera. Ahí sigue cuando la quieras.`,
    avisar: false,
  },
  cartera_ayuda: {
    /* Aquí no se manda a nadie a otro número: se pregunta y se avisa a un
       humano por el mismo camino que ya usan los leads calientes. */
    texto: `Cuéntame en qué parte te quedaste y lo vemos por aquí mismo.

Si prefiere, también nos escribe o nos llama al 301 199 3001.`,
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
