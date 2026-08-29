// lib/bot/codigos-wa.js — QUÉ SIGNIFICA CADA CÓDIGO DE ERROR DE META, EN CRISTIANO.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// La alerta de entrega decía SIEMPRE esta frase, cualquiera que fuera el error:
//
//   «⚠️ Si el error es 131042 (payment issue), revisar la forma de pago en
//    business.facebook.com → Configuración de pago → WhatsApp.»
//
// El 29 de agosto de 2026 saltó dos veces con el código 130472 —que no tiene
// nada que ver con el pago— y el dueño se pasó la mañana buscando un problema
// de facturación que no existía: «parece que el bot se cayó por pago a Meta».
//
// Una alerta que nombra una causa que no es la suya manda a la persona al sitio
// equivocado, y eso cuesta más caro que no avisar. Aquí cada código dice QUÉ
// pasó y QUÉ hacer, y el pago solo se nombra cuando el error es de pago.
//
// Los códigos son los que aparecen de verdad en producción, medidos sobre los
// fallos de agosto de 2026, más los tres de corte que ya vigilaba el webhook.

/**
 * @typedef {{ que: string, hacer: string, nuestro: boolean }} Explicacion
 *  `nuestro` = si hay algo que podamos hacer nosotros. Cuando es `false`, la
 *  alerta tiene que decirlo con esas palabras: si no, se busca un arreglo que
 *  no existe.
 */
const CODIGOS = {
  131049: {
    que: 'Meta no entregó el mensaje «para mantener la salud del ecosistema». Es su límite a los mensajes de marketing, no un fallo nuestro.',
    hacer: 'Sube el límite del número: pasa la verificación de negocio y consigue que aprueben el nombre para mostrar. Mientras tanto, mandar menos y mejor.',
    nuestro: false,
  },
  130472: {
    que: 'El número del destinatario está en un experimento de Meta, que le bloquea los mensajes de marketing.',
    hacer: 'Nada por nuestra parte: es del lado de Meta y del destinatario. Ese lead hay que buscarlo por otra vía.',
    nuestro: false,
  },
  131026: {
    que: 'El mensaje no se puede entregar: el número no tiene WhatsApp, o no acepta mensajes de empresas.',
    hacer: 'Nada. Es un teléfono que no sirve para WhatsApp.',
    nuestro: false,
  },
  131009: {
    que: 'El teléfono no tiene un formato válido.',
    hacer: 'Revisar cómo llega el número del formulario de Meta: le falta el indicativo o trae caracteres raros.',
    nuestro: true,
  },
  131047: {
    que: 'Pasaron más de 24 horas desde el último mensaje del cliente, así que ya no se le puede escribir texto libre.',
    hacer: 'Usar una plantilla aprobada para reabrir la conversación.',
    nuestro: true,
  },
  131042: {
    que: 'META CORTÓ LOS ENVÍOS POR FACTURACIÓN.',
    hacer: 'Arreglar la forma de pago en business.facebook.com → Configuración de pago → WhatsApp. Hasta que se arregle, el bot está mudo.',
    nuestro: true,
  },
  131031: {
    que: 'La cuenta está RESTRINGIDA por Meta.',
    hacer: 'Entrar al Business Manager y resolver la restricción. El bot no entrega nada mientras dure.',
    nuestro: true,
  },
  368: {
    que: 'La cuenta está BLOQUEADA temporalmente por Meta, normalmente por incumplir sus políticas.',
    hacer: 'Revisar el aviso en el Business Manager y esperar a que levanten el bloqueo.',
    nuestro: true,
  },
  133010: {
    que: 'El número no está registrado en la Cloud API.',
    hacer: 'Volver a registrar el número en Meta.',
    nuestro: true,
  },
}

/** El código, sacado de textos como «130472: User's number is part of…». */
export function codigoDe(error) {
  const m = String(error ?? '').match(/(\d{3,6})/)
  return m ? Number(m[1]) : null
}

/**
 * @param {string|number|null} error  el código o el texto entero de Meta
 * @returns {Explicacion}  siempre devuelve algo: un código que no conocemos
 *   tiene que producir una alerta honesta —«no sé qué es esto»— y no una
 *   explicación inventada ni, peor, la de otro código.
 */
export function explicarCodigo(error) {
  const codigo = typeof error === 'number' ? error : codigoDe(error)
  const conocido = CODIGOS[codigo]
  if (conocido) return { codigo, ...conocido }
  return {
    codigo,
    que: 'Meta rechazó el mensaje con un código que todavía no tenemos fichado.',
    hacer: 'Buscar el código en la documentación de la Cloud API antes de tocar nada.',
    nuestro: false,
  }
}

/** ¿Este error deja al bot MUDO, o solo pierde algunos mensajes? */
export function esCorte(error) {
  const codigo = typeof error === 'number' ? error : codigoDe(error)
  return codigo === 131042 || codigo === 131031 || codigo === 368
}
