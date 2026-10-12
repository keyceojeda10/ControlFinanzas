// lib/bot-v2/respuestas-cuenta.js — RESPUESTAS FIJAS QUE LEEN LA CUENTA (12 oct 2026).
//
// Dos respuestas fijas le llegaban al dueño sin mirar su cuenta, y se probó con
// el modelo de verdad contra el espejo:
//   · «¿cuánto vale el plan? para pagarlo» → el enlace y un vídeo, sin el precio
//     que preguntó ni la oferta del 35 % que le aplicaba;
//   · «no he tenido tiempo de pasar los clientes, son como 200» → el vídeo de
//     cómo cargarlos, cuando lo que había que ofrecerle era que se los cargamos.
// Puro: recibe la cuenta (lib/bot-v2/cuenta.js) y devuelve texto.

import { EMPRESA } from './kb.js'
import { respuestaEscalamiento } from './respuestas-fijas.js'

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

/** «Quiero pagar» del dueño: su plan con su precio, y la oferta si le aplica. */
export function respuestaPagoDeCuenta(cuenta) {
  const base = respuestaEscalamiento('intencion_pago_registrado')
  if (!cuenta) return base
  const cabecera = cuenta.precio ? `Su plan ${cuenta.plan} vale ${pesos(cuenta.precio)} al mes. ` : ''
  const oferta = cuenta.ofertaNequi
    ? `Y si deja su Nequi guardado para que se cobre solo cada mes, el próximo mes le sale 35 % más barato.\n\n`
    : ''
  return cabecera + (oferta ? base.replace('\n\nSi lo quiere ver antes', `\n\n${oferta.trimEnd()}\n\nSi lo quiere ver antes`) : base)
}

/* Lo que dice quien carga la cartera como un peso: pasar, subir o meter los
   clientes; que no ha tenido tiempo; que son muchos; que le da pereza. */
const LE_PESA_CARGAR = /\b(?:pasar|cargar|subir|meter|ingresar|montar)\w*\b[^.?!]{0,30}\b(?:clientes|cartera|cuaderno|pr[eé]stamos|deudores)|no (?:he|e) (?:tenido|sacado) (?:tiempo|el tiempo)|(?:me da|que) pereza|son (?:much[oa]s|como \d+|m[aá]s de \d+)|tengo (?:much[oa]s|como \d+|m[aá]s de \d+) clientes/i

/** ¿Hay que ofrecerle que se la carguemos? Solo con pocos clientes y sin una carga ya pedida. */
export function ofrecerCargaConAsesor(texto, cuenta) {
  return Boolean(cuenta) && !cuenta.cargaAbierta && cuenta.clientes < 6 && LE_PESA_CARGAR.test(String(texto || ''))
}

/** Va con la carga ya abierta (el agente la abre): por eso puede decir «mándemelas por aquí». */
export function respuestaCargaConAsesor() {
  return `Tranquilo, se los cargamos nosotros sin costo. Mándeme por aquí las fotos de las hojas del cuaderno o el Excel, todo junto y tal cual lo tiene. Si le queda más fácil, también los puede subir en ${EMPRESA.linkApp}/cargar-cartera

Una persona del equipo revisa cada cliente y le aviso por aquí cuando quede lista, en máximo 24 horas.`
}
