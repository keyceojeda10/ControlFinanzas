/* Los dos mensajes que obligan a quitar la tarjeta del teléfono. Viven aparte
   porque los lee el servidor (al rechazar) y el navegador (para quitarla), y
   lib/cuentas-guardadas.js no se puede importar en el navegador: usa crypto,
   bcrypt y Prisma. */
export const CUENTA_NO_VALE = 'Esta cuenta guardada ya no vale en este teléfono. Entra con tu correo y contraseña.'
export const PIN_AGOTADO = 'Demasiados PIN errados: quitamos esta cuenta del teléfono. Entra con tu correo y contraseña.'

export function esMensajeDeCuentaMuerta(msg) {
  return msg === CUENTA_NO_VALE || msg === PIN_AGOTADO
}
