/* CUENTAS GUARDADAS EN EL TELÉFONO — 24 sep 2026.
 *
 * La casilla «Mantener la sesión en este teléfono» no hacía NADA: la pantalla
 * guardaba `recordar` y nunca lo mandaba. El dueño pidió cambiarla por algo que
 * sirva: guardar una o varias cuentas y entrar con un toque, también en la app
 * instalada, donde muchos teléfonos no sugieren contraseñas.
 *
 * El teléfono NO guarda la contraseña: guarda una llave aleatoria de 32 bytes.
 * Aquí solo va su huella SHA-256 (con esa entropía un hash rápido basta) y, para
 * dueño y superadmin, un PIN de 4 números con bcrypt (poca entropía: hash lento
 * y 5 intentos). Revocar = borrar la fila.
 * Spec: docs/superpowers/specs/2026-09-24-cuentas-guardadas-y-ver-como-design.md
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { CUENTA_NO_VALE, PIN_AGOTADO } from '@/lib/cuentas-guardadas-textos'

export const DIAS_VIGENCIA = 60
export const MAX_INTENTOS_PIN = 5
const ROLES_CON_PIN = ['owner', 'superadmin']

export const llevaPin = (rol) => ROLES_CON_PIN.includes(rol)
export const pinValido = (pin) => /^\d{4}$/.test(String(pin ?? ''))

export function generarLlave() {
  return crypto.randomBytes(32).toString('base64url')
}

export function huellaDeLlave(llave) {
  return crypto.createHash('sha256').update(String(llave ?? '')).digest('hex')
}

export function llaveCoincide(llave, tokenHash) {
  const a = Buffer.from(huellaDeLlave(llave), 'hex')
  const b = Buffer.from(String(tokenHash ?? ''), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function vencida(lastUsedAt, ahora = Date.now()) {
  return ahora - new Date(lastUsedAt).getTime() > DIAS_VIGENCIA * 24 * 60 * 60 * 1000
}

export async function crearCuentaGuardada({ userId, rol, pin, dispositivo = null }) {
  if (llevaPin(rol) && !pinValido(pin)) throw new Error('PIN_REQUERIDO')
  const llave = generarLlave()
  const fila = await prisma.cuentaGuardada.create({
    data: {
      userId,
      tokenHash: huellaDeLlave(llave),
      pinHash: llevaPin(rol) ? await bcrypt.hash(String(pin), 10) : null,
      dispositivo,
    },
    select: { id: true },
  })
  return { id: fila.id, llave }
}

/** El userId si la llave (y el PIN, si lleva) valen. Si no, lanza con un mensaje para la persona. */
export async function abrirCuentaGuardada({ id, llave, pin }, ahora = Date.now()) {
  const fila = await prisma.cuentaGuardada.findUnique({
    where: { id: String(id ?? '') },
    select: { id: true, userId: true, tokenHash: true, pinHash: true, intentosPin: true, lastUsedAt: true },
  })
  if (!fila || !llaveCoincide(llave, fila.tokenHash)) throw new Error(CUENTA_NO_VALE)
  if (vencida(fila.lastUsedAt, ahora)) {
    await prisma.cuentaGuardada.delete({ where: { id: fila.id } }).catch(() => {})
    throw new Error(CUENTA_NO_VALE)
  }
  if (fila.pinHash) {
    const ok = pinValido(pin) && await bcrypt.compare(String(pin), fila.pinHash)
    if (!ok) {
      // El contador sube en la base, no en memoria: dos pedidos con el PIN
      // errado a la vez podrían leer el mismo número y pisarse el incremento
      // uno al otro, dejando probar más de MAX_INTENTOS_PIN veces.
      let intentos
      try {
        ({ intentosPin: intentos } = await prisma.cuentaGuardada.update({
          where: { id: fila.id },
          data: { intentosPin: { increment: 1 } },
          select: { intentosPin: true },
        }))
      } catch {
        // Otro pedido concurrente ya la borró (llegó a MAX_INTENTOS_PIN o venció): no hay fila que actualizar.
        throw new Error(PIN_AGOTADO)
      }
      if (intentos >= MAX_INTENTOS_PIN) {
        await prisma.cuentaGuardada.delete({ where: { id: fila.id } }).catch(() => {})
        throw new Error(PIN_AGOTADO)
      }
      const quedan = MAX_INTENTOS_PIN - intentos
      throw new Error(`PIN incorrecto. Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`)
    }
  }
  await prisma.cuentaGuardada.update({ where: { id: fila.id }, data: { intentosPin: 0, lastUsedAt: new Date(ahora) } })
  return fila.userId
}

/** La «x» de la tarjeta: sin sesión, la llave es la prueba de que es suya. */
export async function quitarConLlave({ id, llave }) {
  const fila = await prisma.cuentaGuardada.findUnique({ where: { id: String(id ?? '') }, select: { id: true, tokenHash: true } })
  if (!fila || !llaveCoincide(llave, fila.tokenHash)) return false
  await prisma.cuentaGuardada.delete({ where: { id: fila.id } })
  return true
}

/** Al cambiar la contraseña: ningún teléfono entra con la llave vieja. */
export async function cortarCuentasGuardadas(userId) {
  if (!userId) return
  await prisma.cuentaGuardada.deleteMany({ where: { userId } })
}
