/* El pase para entrar a «ver como» o volver: lo firma una ruta del API que SÍ ve
   la sesión del dueño, y lo canjea el proveedor `pase` de NextAuth. Dura 60 s.
   HMAC-SHA256 con NEXTAUTH_SECRET: sin el secreto no se fabrica uno. */
import crypto from 'crypto'

export const VIDA_PASE_MS = 60 * 1000
export const VISTA_MS = 60 * 60 * 1000

const firma = (cuerpo, secreto) => crypto.createHmac('sha256', String(secreto)).update(cuerpo).digest('base64url')

export function firmarPase(datos, secreto, ahora = Date.now()) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: ahora + VIDA_PASE_MS })).toString('base64url')
  return `${cuerpo}.${firma(cuerpo, secreto)}`
}

export function leerPase(pase, secreto, ahora = Date.now()) {
  try {
    const [cuerpo, f] = String(pase ?? '').split('.')
    if (!cuerpo || !f) return null
    const esperada = Buffer.from(firma(cuerpo, secreto))
    const dada = Buffer.from(f)
    if (esperada.length !== dada.length || !crypto.timingSafeEqual(esperada, dada)) return null
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
    if (!(datos?.exp > ahora)) return null
    return datos
  } catch { return null }
}
