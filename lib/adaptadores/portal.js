// lib/adaptadores/portal.js — el portal del cliente (T04-06, T04-07, T36-01).
//
// ══ ES LA ÚNICA CARA PÚBLICA DEL PRODUCTO ═══════════════════════════════════
//
// El pie de T04-06 lo dice: «es la pantalla que más gente ve del producto y la
// única cara pública». Un prestamista tiene 30 clientes; cada uno entra aquí a
// mirar su saldo. La app la ve el dueño, esto lo ve todo el barrio.
//
// De ahí salen tres reglas que NO son de diseño:
//
//   1. LO PAGADO ES EL LOGRO, NO LA DEUDA. La barra de avance va en verde y mide
//      lo que ya pagó. Para el dueño la barra mide lo cobrado; para el deudor,
//      lo saldado. Es el mismo número leído desde el otro lado.
//
//   2. SOLO SUS PROPIOS DATOS. Ni totales del negocio, ni otros clientes, ni
//      cuánto gana quien le prestó. Lo dice la pantalla de acceso porque, como
//      apunta la lámina, «el deudor desconfía por defecto».
//
//   3. LA RESPUESTA DE «OLVIDÉ MI CLAVE» ES IDÉNTICA EXISTA EL NÚMERO O NO.
//      Un desconocido no puede averiguar quién le debe a quién probando
//      teléfonos. Está en `respuestaDeRecuperacion` y tiene su prueba.

function aNumero(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function positivo(v) {
  const n = aNumero(v)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

/* ── T04-07 · Lo que debe ─────────────────────────────────────────────────── */

/* «TE FALTA PAGAR», no «saldo pendiente». Es la deuda dicha en segunda persona y
   en las palabras que usa quien debe. */
export function loQueDebe({
  totalAPagar, pagado, cuotasPagadas, cuotasTotales, diasMora,
} = {}, formatear = String) {
  const total = positivo(totalAPagar)
  const ya = Math.min(positivo(pagado), total)
  const falta = Math.max(0, total - ya)
  const mora = positivo(diasMora)

  const cuotas = positivo(cuotasTotales)
  const hechas = Math.min(positivo(cuotasPagadas), cuotas)

  return {
    etiqueta: 'Te falta pagar',
    falta: formatear(Math.round(falta)),
    // La mora se dice, pero como pastilla y no como cifra grande: el número que
    // manda es lo que falta, no el reproche.
    mora: mora > 0 ? `${mora}d de atraso` : null,
    // VERDE Y MIDE LO PAGADO. Con la barra midiendo la deuda, un cliente que ha
    // pagado el 70% vería una barra casi vacía por un logro casi completo.
    progreso: total > 0 ? Math.min(100, Math.round((ya / total) * 100)) : 0,
    resumen: {
      pagado: formatear(Math.round(ya)),
      total: formatear(Math.round(total)),
      cuotas: cuotas > 0 ? `${hechas} de ${cuotas} cuotas` : null,
    },
    numeros: { falta: Math.round(falta), pagado: Math.round(ya), total: Math.round(total) },
  }
}

/* ── La próxima cuota ─────────────────────────────────────────────────────── */

/* «Mañana, martes 29 de julio» y no una fecha sola: el día relativo es lo que
   contesta la pregunta, y el absoluto lo confirma. */
export function proximaCuota({ monto, fecha, relativo } = {}, formatear = String) {
  const m = positivo(monto)
  if (m <= 0 && !fecha) return null
  return {
    etiqueta: 'Tu próxima cuota',
    monto: formatear(Math.round(m)),
    cuando: [relativo, fecha].filter(Boolean).join(', '),
  }
}

/* ── Sus pagos ────────────────────────────────────────────────────────────── */

/* Cada pago con su fecha y su punto de color. El abono parcial va en ámbar y lo
   dice: quien abonó $8.000 de una cuota de $14.500 tiene que poder distinguirlo de
   una cuota completa sin hacer la resta. */
export function misPagos(pagos = [], formatear = String, fechaLarga) {
  return pagos.filter(Boolean).map((p, i) => {
    const parcial = p.tipo === 'parcial' || p.tipo === 'abono'
    return {
      id: p.id ?? i,
      fecha: [
        fechaLarga ? fechaLarga(p.fecha) : p.fecha,
        parcial ? 'abono' : null,
      ].filter(Boolean).join(' · '),
      monto: formatear(Math.round(positivo(p.monto))),
      color: parcial ? 'oro' : 'verde',
      // ── EL MEDIO DE PAGO ──
      // El cliente entra al portal a comprobar que su pago quedo registrado, y
      // «$14.500 el 19 de julio» no distingue el que dio en efectivo del que
      // mando por Nequi. La pantalla del cobrador si lo dice; si la del cliente
      // no, no se pueden poner una al lado de la otra.
      //
      // Se devuelve `null` cuando no hay medio en vez de inventar «efectivo»:
      // los pagos viejos no lo tienen guardado, y suponerlo es afirmar algo que
      // nadie registro.
      detalle: p.medio ? String(p.medio) : null,
    }
  })
}

/* ── «Avisar»: el WhatsApp de que ya pagó ─────────────────────────────────── */

/* Hoy esto se hace por fuera del sistema —el cliente le escribe al prestamista— y
   la pantalla solo le ahorra escribirlo. NO registra el pago: eso lo hace quien
   cobra, y decirlo aquí evitaría que el cliente crea que ya quedó registrado.
;
   Devuelve el TEXTO, no envía nada: quien pulsa «enviar» es el cliente, en su
   propio WhatsApp. */
export function avisoDePago({ nombre, monto, cuando } = {}, formatear = String) {
  const partes = [
    nombre ? `Hola, soy ${nombre}.` : 'Hola.',
    positivo(monto) > 0
      ? `Ya hice el pago de ${formatear(Math.round(positivo(monto)))}${cuando ? ` de ${cuando}` : ''}.`
      : 'Ya hice el pago.',
    'Gracias.',
  ]
  return partes.join(' ')
}

/* ── T36-01 · Recuperar la clave ──────────────────────────────────────────── */

/* LA MISMA RESPUESTA EXISTA EL NÚMERO O NO.
;
   Si la pantalla dijera «ese número no está registrado», cualquiera podría probar
   teléfonos hasta dar con los clientes de un prestamista — o sea averiguar QUIÉN LE
   DEBE A QUIÉN, que en este negocio es información peligrosa para el deudor.
;
   Por eso la función no recibe si el número existe: no puede filtrarlo aunque
   quisiera. El backend manda el WhatsApp si procede y aquí no se entera. */
export function respuestaDeRecuperacion({ prestamista } = {}) {
  return {
    titulo: 'Olvidé mi clave',
    ayuda: 'Te mandamos una clave nueva por WhatsApp al número que tienes registrado.',
    // El condicional «si el número está registrado» es lo que hace que la
    // respuesta no confirme ni desmienta nada.
    nota: prestamista
      ? `Si el número está registrado con nosotros, te llega un mensaje en menos de un minuto. Si no llega, pregúntale directamente a ${prestamista}.`
      : 'Si el número está registrado con nosotros, te llega un mensaje en menos de un minuto.',
    accion: 'Mandarme la clave',
    // LA SALIDA HUMANA, con el nombre de la persona: el cliente no conoce «Control
    // Finanzas», conoce a quien le prestó.
    humana: prestamista ? `Escribirle a ${prestamista}` : null,
    // DEFENSA CONTRA LA ESTAFA. Si alguien clona esta página para pedir pagos, la
    // original dice que aquí nunca se pide plata.
    seguridad: 'Esta página es solo para consultar. Aquí no se paga ni se pide plata.',
  }
}

/* Lo que la pantalla de acceso promete y limita, en una frase. */
export const PROMESA_DE_PRIVACIDAD =
  'Solo puedes ver tu propio préstamo: saldo, pagos y próxima cuota. No se muestra información de otras personas.'

/* El PIN son cuatro dígitos. Se valida aquí para no mandar al backend lo que no
   puede ser un PIN, pero el acierto lo decide el backend: comparar en el cliente
   sería regalar el PIN a quien mire el código. */
export function pinCompleto(digitos = []) {
  return digitos.length === 4 && digitos.every((d) => /^\d$/.test(String(d ?? '')))
}

export function soloDigitos(texto, tope = 4) {
  return String(texto ?? '').replace(/\D/g, '').slice(0, tope).split('')
}
