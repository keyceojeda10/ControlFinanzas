// lib/adaptadores/plantillas.js — T11-01 plantillas de WhatsApp.
//
// ══ LO QUE LA LÁMINA DICE Y LO QUE DICE EL CÓDIGO ═══════════════════════════
//
// La lámina afirma que hoy solo hay envíos «para informar» y que «no hay nada
// para cobrar, reclamar un atraso, cerrar un acuerdo ni ofrecer una renovación».
// Tres de las cuatro YA EXISTEN en `lib/whatsapp.js`: `generarTextoRecordatorio`
// (la cuota de hoy), `generarEnlaceMora` (el atraso) y `generarTextoRenovacion`.
// La única que de verdad falta es ACUERDO.
//
// Las de hoy sí tienen otro problema, este real: van llenas de emojis —🙏, 👋,
// 💼— que la app no usa en ninguna otra parte, y la de renovación es un folleto
// de cinco párrafos con viñetas. Estas caben en una burbuja y se leen de un
// vistazo, que es lo que hace falta con el cliente delante.
//
// Pero el diagnóstico de fondo sí se sostiene, y es el que justifica la pantalla:
// NINGUNO ENSEÑA EL TEXTO ANTES DE MANDARLO. Se pulsa un botón y se abre WhatsApp
// con un mensaje que el cobrador no ha leído, en el chat de una persona que le
// debe plata. Aquí se elige plantilla, se lee el mensaje exacto con los datos ya
// puestos, y solo entonces se abre WhatsApp.
//
// ══ LO RELLENADO SE MARCA ══════════════════════════════════════════════════
//
// El resaltado no es decoración: es la diferencia entre «este texto es fijo» y
// «esto lo puso el sistema con los datos de este cliente». Si el nombre sale mal
// o la cuota no cuadra, lo resaltado es dónde mirar. Por eso `rellena` devuelve
// TROZOS y no una cadena: la cadena ya no sabe qué parte vino de dónde.

/** Las cuatro familias. El orden es el del día: primero se cobra, luego se
 *  reclama, luego se negocia, y solo al final se ofrece más plata. */
export const FAMILIAS = [
  { id: 'cobro', etiqueta: 'Cobro' },
  { id: 'atraso', etiqueta: 'Atraso' },
  { id: 'acuerdo', etiqueta: 'Acuerdo' },
  { id: 'renovar', etiqueta: 'Renovar' },
]

/** Las plantillas, por familia.
 *
 *  `cobro` y `atraso` son las que `lib/whatsapp.js` ya sabe redactar; aquí se
 *  reescriben para que quepan en la burbuja y digan siempre CÓMO pagar, que es lo
 *  que la versión de hoy no dice. `acuerdo` y `renovar` son nuevas.
 *
 *  Ninguna amenaza. No es delicadeza: un mensaje amenazante por escrito es
 *  prueba en contra del prestamista, y además funciona peor. */
export const PLANTILLAS = {
  cobro: [
    {
      id: 'cuota-hoy',
      titulo: 'Recordar la cuota de hoy',
      texto: 'Hola {nombre}, hoy vence tu cuota de {cuota}. Puedes pagar en efectivo o por {medio}. — {negocio}',
    },
    {
      id: 'estado-cuenta',
      titulo: 'Mandar el estado de cuenta',
      resumen: 'Saldo, cuotas pagadas y próximo cobro, con el enlace a su portal.',
      texto: 'Hola {nombre}. Tu saldo es {saldo} y llevas {cuotasPagadas}. El próximo cobro es el {proximoCobro}. Puedes ver todo aquí: {portal} — {negocio}',
    },
    {
      id: 'libre',
      titulo: 'Escribir un mensaje libre',
      resumen: 'Se abre WhatsApp vacío con el número del cliente.',
      texto: '',
      libre: true,
    },
  ],
  atraso: [
    {
      id: 'atraso-suave',
      titulo: 'Recordar lo atrasado',
      texto: 'Hola {nombre}, te escribo porque llevas {atraso} y tu saldo va en {saldo}. ¿Cuándo puedo pasar? — {negocio}',
    },
    {
      id: 'atraso-abono',
      titulo: 'Pedir un abono',
      resumen: 'Para cuando no puede pagar la cuota completa.',
      texto: 'Hola {nombre}. Sé que está difícil. Si no puedes con la cuota completa, abona lo que puedas hoy y lo demás lo cuadramos. — {negocio}',
    },
    {
      id: 'libre',
      titulo: 'Escribir un mensaje libre',
      resumen: 'Se abre WhatsApp vacío con el número del cliente.',
      texto: '',
      libre: true,
    },
  ],
  acuerdo: [
    {
      id: 'proponer',
      titulo: 'Proponer una fecha',
      texto: 'Hola {nombre}. Quedamos en que pagas {saldo} el {fechaAcuerdo}. Si algo cambia, avísame antes de ese día. — {negocio}',
    },
    {
      id: 'confirmar',
      titulo: 'Confirmar lo acordado',
      resumen: 'Deja por escrito lo que se habló en la puerta.',
      texto: 'Confirmo lo que hablamos, {nombre}: {saldo} el {fechaAcuerdo}. Gracias. — {negocio}',
    },
    {
      id: 'libre',
      titulo: 'Escribir un mensaje libre',
      resumen: 'Se abre WhatsApp vacío con el número del cliente.',
      texto: '',
      libre: true,
    },
  ],
  renovar: [
    {
      id: 'ofrecer',
      titulo: 'Ofrecerle renovar',
      // Solo tiene sentido para quien va al día. Ofrecer más plata a quien está
      // atrasado es cómo se vuelve incobrable una cartera.
      texto: 'Hola {nombre}, vas al día y ya llevas {cuotasPagadas}. Si necesitas más, te puedo renovar. ¿Hablamos? — {negocio}',
    },
    {
      id: 'libre',
      titulo: 'Escribir un mensaje libre',
      resumen: 'Se abre WhatsApp vacío con el número del cliente.',
      texto: '',
      libre: true,
    },
  ],
}

/** Rellena una plantilla y devuelve TROZOS, no una cadena.
 *
 *  Cada trozo es `{ texto, dato }`. Los que traen `dato: true` son los que puso
 *  el sistema y los que la pantalla resalta. Una cadena ya rellenada no sabe qué
 *  parte vino de dónde, y ese es justo el dato que hay que enseñar.
 *
 *  Un hueco sin valor NO se queda como `{nombre}` a la vista: se cae la frase
 *  entera antes que mandarle «Hola {nombre}» a un cliente. */
export function rellena(texto, datos = {}) {
  const partes = String(texto ?? '').split(/(\{\w+\})/g)
  const trozos = []
  for (const p of partes) {
    if (!p) continue
    const hueco = p.match(/^\{(\w+)\}$/)
    if (hueco) {
      const valor = datos[hueco[1]]
      // Sin valor no se pinta el hueco crudo: se deja vacío. Es feo, pero
      // «Hola {nombre}» delante del cliente es peor.
      if (valor == null || valor === '') continue
      trozos.push({ texto: String(valor), dato: true })
    } else {
      trozos.push({ texto: p, dato: false })
    }
  }
  return trozos
}

/** El texto plano, que es lo que de verdad se manda. */
export function comoTexto(trozos) {
  return (trozos ?? []).map((t) => t.texto).join('').replace(/\s+/g, ' ').trim()
}

/** ¿Quedó algún hueco sin llenar?
 *
 *  Sirve para avisar ANTES de abrir WhatsApp. Un mensaje al que le falta la
 *  cuota se manda igual y queda raro; peor, el cobrador no se entera. */
export function huecosVacios(texto, datos = {}) {
  const nombres = [...String(texto ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  return nombres.filter((n) => datos[n] == null || datos[n] === '')
}

/** El enlace de WhatsApp, con el número normalizado.
 *
 *  Devuelve `null` sin teléfono: es la única forma de que la pantalla sepa que
 *  tiene que desactivar el botón en vez de abrir un wa.me roto. */
export function enlaceWhatsApp(telefono, mensaje, indicativo = '57') {
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  if (digitos.length < 7) return null
  // Con indicativo ya puesto no se le añade otro. Un `5757…` no le llega a nadie.
  const numero = digitos.length > 10 ? digitos : `${indicativo}${digitos}`
  const texto = String(mensaje ?? '').trim()
  return texto
    ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/${numero}`
}

/** Prepara una plantilla para pintarla: trozos, texto plano y qué le falta. */
export function preparaPlantilla(plantilla, datos = {}) {
  if (!plantilla) return null
  if (plantilla.libre) {
    return { ...plantilla, trozos: [], texto: '', faltan: [] }
  }
  const trozos = rellena(plantilla.texto, datos)
  return {
    ...plantilla,
    trozos,
    texto: comoTexto(trozos),
    faltan: huecosVacios(plantilla.texto, datos),
  }
}
