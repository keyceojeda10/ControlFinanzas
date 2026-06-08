// lib/normalizar-email.js
// Normaliza un email a su forma canonica: minusculas + sin puntos en la parte
// local (antes del @). Gmail trata los puntos como decorativos, asi que
// carlos.garcia@gmail.com == carlosgarcia@gmail.com — normalizamos siempre
// para que el mismo usuario siempre mapee al mismo registro en DB.
//
// TODOS los puntos de entrada del flujo de autenticacion deben usar esta
// funcion: registro, login, verificar-email y reenviar-verificacion.
export function normalizarEmail(email) {
  if (!email) return ''
  const lower = email.trim().toLowerCase()
  const atIndex = lower.indexOf('@')
  if (atIndex === -1) return lower
  const local = lower.slice(0, atIndex)
  const domain = lower.slice(atIndex + 1)
  return `${local.replace(/\./g, '')}@${domain}`
}
