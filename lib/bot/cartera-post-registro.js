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

export function mensajeBienvenida(nombre) {
  const saludo = nombre ? `Listo, ${nombre}. ` : 'Listo. '
  return `${saludo}Su cuenta ya está creada.

Lo que más cuesta es pasar la cartera. No la escriba a mano: tómele una foto a la hoja de su cuaderno y el sistema saca los clientes solo, hasta 30 por foto.`
}

/* ⚠ SIN DERIVAR AL 301 199 3001. Está medido: 274 derivaciones a ese número en
   julio y agosto, y 4 tickets de soporte en toda la historia del producto. El
   traspaso convierte cerca del 1 %. Quien dice «no pude» se registra en el 44 %
   de los casos y paga en el 10 % — son clientes atascados, no gente que se va,
   y hoy se les da un teléfono. */
const RESPUESTAS = {
  cartera_foto: {
    texto: `Se hace así:

1. Entre a Clientes y toque el botón de la cámara.
2. Tome la foto de la hoja del cuaderno, derecha y con buena luz.
3. Revise los nombres y montos que salieron, corrija lo que haga falta y guarde.

Puede repetirlo con cada hoja. Si algo sale mal, escríbame por aquí y lo miramos.`,
    avisar: false,
  },
  cartera_mano: {
    texto: `Sin problema. En Clientes, el botón de más (+) los agrega uno por uno.

Si en algún momento son muchos, la foto del cuaderno sigue ahí y le ahorra el trabajo.`,
    avisar: false,
  },
  cartera_ayuda: {
    /* Aquí no se manda a nadie a otro número: se pregunta y se avisa a un
       humano por el mismo camino que ya usan los leads calientes. */
    texto: `Cuénteme en qué parte se quedó y lo vemos por aquí mismo.`,
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
