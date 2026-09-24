/* Del objeto de sesión al JWT, y la vuelta sola de «ver como» a la hora. Aparte
   de lib/auth.js para probarlo sin cargar NextAuth. */
import { usuarioParaSesion, sesionDeUsuario } from '@/lib/auth-sesion'

/** Del objeto de sesión (authorize) al JWT. Tres campos de la vista: en un login normal quedan en null.
 *
 * `token.sub` y `token.email` van aparte del resto: NextAuth los siembra solo
 * en un sign-in de verdad (desde el `user` de `authorize()`). `volverSiVencio`
 * reescribe el token SIN pasar por un sign-in, así que si no se ponen aquí a
 * mano, el dueño vuelve de «ver como» con el `sub` y el correo del cobrador
 * pegados en el JWT. */
export function copiarAlToken(token, user) {
  token.id                    = user.id
  token.sub                   = user.id
  token.email                 = user.email ?? token.email
  token.nombre                = user.nombre
  token.rol                   = user.rol
  token.organizationId        = user.organizationId
  token.plan                  = user.plan
  token.rutaId                = user.rutaId
  token.rutaIds               = user.rutaIds ?? []
  token.permisos              = user.permisos
  token.suscripcionVencimiento = user.suscripcionVencimiento
  token.onboardingCompletado  = user.onboardingCompletado
  token.emailVerificado       = user.emailVerificado
  token.avatarId              = user.avatarId ?? null
  token.country               = user.country ?? 'co'
  token.timezone              = user.timezone ?? null
  token.orgNombre             = user.orgNombre ?? null
  token.modoAbreviado         = user.modoAbreviado ?? false
  token.ocultarSaldoWA        = user.ocultarSaldoWA ?? false
  token.camposRecibo          = user.camposRecibo ?? null
  token.vistaDe               = user.vistaDe ?? null
  token.soloLectura           = !!user.soloLectura
  token.vistaHasta            = user.vistaHasta ?? null
  token.lastRefresh           = Date.now()
  return token
}

/* A la hora, la vista vuelve sola a la cuenta del dueño. ⚠ Si no se puede
   revisar al dueño (sin red, borrado, desactivado), NO se vuelve: se sigue en
   solo lectura. Nunca se sale de la vista a una cuenta con permiso de escribir
   sin haberla revisado. */
export async function volverSiVencio(token, ahora = Date.now()) {
  if (!token?.vistaDe || !token.vistaHasta || ahora <= token.vistaHasta) return token
  try {
    const dueno = await usuarioParaSesion(token.vistaDe.id)
    if (!dueno) return token
    return copiarAlToken(token, await sesionDeUsuario(dueno))
  } catch {
    return token
  }
}
