// lib/fotos-donadas.js — La campaña de fin de semana para enseñarle a leer al
// sistema.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
//
// El lector de cartulinas está construido y NO SABEMOS SI ACIERTA. Se montó sin
// una sola foto real porque no había ninguna disponible: el plan lo dice con
// esas palabras —«no se puede medir primero»— y por eso se instrumentó para
// medirse solo. Esto es el otro lado de esa decisión: pedirle las fotos a quien
// sí las tiene.
//
// El muro del negocio es pasar el cuaderno. 73 % de los negocios se queda en
// cinco clientes o menos y de esos paga el 1 %; con 21 o más paga la mitad. Si
// el lector acierta, ese muro se cae; si no acierta, hay que saberlo YA y no
// después de construir encima.
//
// ── LO QUE NO SE PUEDE DECIR ────────────────────────────────────────────────
//
// ⚠ «Es anónimo» sería MENTIRA y no se dice en ningún texto de esta campaña.
// Una cartulina lleva nombre completo, cédula, dirección, teléfono y la deuda
// de los clientes del prestamista — gente que no está en la conversación y no
// dio permiso. En Colombia eso es dato personal de terceros (Ley 1581 de 2012).
//
// Lo que sí se puede hacer, y se hace:
//   · decirlo claro antes de que suba nada
//   · avisar que puede TAPAR LA CÉDULA — no hace falta: el sistema ya trabaja
//     con 1.683 clientes cuya cédula es `SIN-…`
//   · guardar las fotos fuera del alcance de la web
//   · borrarlas cuando termine la revisión, y decir cuándo
//
// ── DÓNDE SE GUARDAN, Y POR QUÉ NO DONDE LAS DEMÁS ──────────────────────────
//
// ⚠ NO van a `public/uploads/`. Todo lo que vive ahí lo sirve Next como archivo
// estático y NO PASA POR LA SESIÓN. Comprobado contra producción el 7 ago 2026:
//
//     GET /uploads/firmas/<org>/<hash>.png        → 200  (sin sesión)
//     GET /api/uploads/firmas/<org>/<hash>.png    → 401
//
// El API con permisos existe y funciona; la ruta estática lo rodea. Las
// direcciones no son adivinables ni listables, así que no es una puerta
// abierta, pero quien tenga el enlace entra siempre y sin cuenta. Para fotos de
// firmas eso ya está así de antes; para un montón de cartulinas ajenas no se
// repite.

/** Fotos que hacen falta para llenar la tabla de aciertos por campo. */
export const META_FOTOS = 40

/* Hasta el lunes 10 de agosto a medianoche.
   ⚠ EN UTC Y CON EL CONVENIO DE LA CASA: el día colombiano va de 05:00Z a
   05:00Z y el servidor corre en UTC, así que «el lunes por la noche» es el
   martes a las 04:59Z. Escribirlo como `2026-08-10T23:59` lo cerraría el lunes
   a las 6 de la tarde hora de Colombia, que es justo cuando la gente cuadra.
   Ver [[fechas_un_solo_calendario]]. */
export const CIERRA_EN = new Date('2026-08-11T04:59:59.000Z')

/**
 * ¿Sigue viva la campaña? Se cierra por lo que pase primero: por llegar a la
 * meta o por fecha.
 *
 * Cerrar POR CANTIDAD y no solo por fecha es a propósito. Un banner con fecha
 * fija se queda puesto aunque ya sobren fotos, y un banner que sobra se vuelve
 * ruido en el panel — que es lo que el propio panel avisa que pasa cuando se
 * apilan franjas.
 */
export function campanaViva(recogidas, ahora = new Date()) {
  if (recogidas >= META_FOTOS) return false
  return ahora < CIERRA_EN
}

/** Cuántas faltan, sin bajar de cero. */
export function faltan(recogidas) {
  return Math.max(0, META_FOTOS - recogidas)
}

/* ── LÍMITES DE UNA SUBIDA ──
   Diez por envío no es tacañería: son diez fotos de teléfono, que a 8 MB cada
   una son 80 MB por petición. Quien quiera mandar treinta las manda en tres
   tandas y el banner le va contando. */
export const MAX_POR_ENVIO = 10
export const MAX_BYTES = 8 * 1024 * 1024
export const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * La carpeta donde caen las fotos.
 *
 * ⚠ FUERA DE `public/` Y FUERA DE LA CARPETA DE LA APP. En el VPS va a
 * `/opt/cf-fotos-donadas`, igual que el respaldo: así ni un `git pull` ni un
 * despliegue las rozan, y no hay ninguna ruta web que llegue a ellas.
 * En desarrollo cae a una carpeta local que está en `.gitignore`.
 */
export function carpetaDonadas() {
  return process.env.FOTOS_DONADAS_DIR || `${process.cwd()}/.fotos-donadas`
}

/* Las formas del registro, tal como las describió el dueño: hay quien lleva una
   cartulina por cliente, quien lleva un cuaderno con la lista de muchos, y
   quien mezcla. No se adivina: se le pregunta, y es UN toque. */
export const FORMAS = [
  { id: 'cartulina', rotulo: 'Una tarjeta por cliente' },
  { id: 'lista', rotulo: 'Un cuaderno con la lista' },
  { id: 'otro', rotulo: 'Otra cosa' },
]
