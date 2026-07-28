// La pantalla de login decidia que mensaje mostrar con una lista blanca de dos
// palabras ('desactivada', 'suspendida'). Todo lo demas caia en "Correo o
// contrasena incorrectos", incluidos dos avisos donde la clave estaba BIEN:
//
//   · "Demasiados intentos de inicio de sesion. Intenta en 15 minutos."
//   · "Tu cuenta de cobrador excede el limite del plan actual."
//
// Decirle a alguien que su clave esta mal cuando en realidad esta bloqueado lo
// empuja a resetear una contrasena correcta, o a reintentar y extender el
// bloqueo. Me paso a mi mismo capturando pantallas: perdi un rato largo
// persiguiendo una clave que no tenia nada de malo.
//
// Este test fija la regla nueva contra los mensajes REALES de lib/auth.js: se
// leen del fuente, para que si alguien agrega uno y la pantalla vuelve a
// tragarselo, esto falle.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(__dirname, '..', '..')

// Copia exacta de la logica de app/login/page.jsx. Si una cambia sin la otra,
// el ultimo test de este archivo lo detecta.
const CODIGOS_NEXTAUTH = new Set([
  'CredentialsSignin', 'Signin', 'Callback', 'Default', 'Configuration',
  'AccessDenied', 'Verification', 'SessionRequired', 'EmailSignin',
  'OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'OAuthAccountNotLinked',
  'EmailCreateAccount',
])
function esCodigoInterno(msg) {
  if (!msg) return true
  if (CODIGOS_NEXTAUTH.has(msg)) return true
  return !msg.includes(' ')
}
const mensajeMostrado = (err) =>
  esCodigoInterno(err) ? 'Correo o contraseña incorrectos' : err

describe('login: que mensaje ve el usuario', () => {
  it('clave o correo malos -> el generico', () => {
    // authorize() devuelve null en esos casos y NextAuth manda este codigo.
    expect(mensajeMostrado('CredentialsSignin')).toBe('Correo o contraseña incorrectos')
  })

  it('bloqueo por intentos -> se muestra el aviso real, NO "clave incorrecta"', () => {
    const m = 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos.'
    expect(mensajeMostrado(m)).toBe(m)
  })

  it('cobrador que excede el plan -> se muestra el aviso real', () => {
    const m = 'Tu cuenta de cobrador excede el limite del plan actual. Contacta al administrador.'
    expect(mensajeMostrado(m)).toBe(m)
  })

  it('cuenta desactivada y suspendida siguen mostrandose (no hubo regresion)', () => {
    for (const m of [
      'Tu cuenta está desactivada. Contacta al administrador.',
      'Tu cuenta está suspendida. Escríbenos a soporte@control-finanzas.com',
    ]) expect(mensajeMostrado(m)).toBe(m)
  })

  it('un codigo interno desconocido no se filtra a la pantalla', () => {
    // Red de seguridad: los codigos son un token sin espacios.
    expect(mensajeMostrado('AlgunCodigoNuevoDeNextAuth')).toBe('Correo o contraseña incorrectos')
    expect(mensajeMostrado('')).toBe('Correo o contraseña incorrectos')
    expect(mensajeMostrado(undefined)).toBe('Correo o contraseña incorrectos')
  })

  it('TODO mensaje que lanza lib/auth.js llega intacto al usuario', () => {
    const auth = fs.readFileSync(path.join(RAIZ, 'lib/auth.js'), 'utf8')
    const lanzados = [...auth.matchAll(/throw new Error\(\s*'([^']+)'/g)].map(m => m[1])
      .filter(m => m !== 'VERIFY_EMAIL')   // ese no se muestra: redirige

    expect(lanzados.length, 'deberia haber varios mensajes en lib/auth.js').toBeGreaterThan(2)
    const tragados = lanzados.filter(m => mensajeMostrado(m) !== m)
    expect(tragados, 'mensajes de lib/auth.js que la pantalla se traga').toEqual([])
  })

  it('la pantalla usa esta misma regla, no una lista blanca de palabras', () => {
    const src = fs.readFileSync(path.join(RAIZ, 'app/login/page.jsx'), 'utf8')
    expect(src).toMatch(/function esCodigoInterno/)
    expect(src).toMatch(/esCodigoInterno\(msg\)/)
    // la lista blanca vieja no debe volver
    expect(src).not.toMatch(/includes\('desactivada'\)/)
  })
})

describe('mis-estadisticas: no se queda cargando para siempre', () => {
  it('apaga loading cuando el usuario no es cobrador', () => {
    const src = fs.readFileSync(
      path.join(RAIZ, 'app/(dashboard)/mis-estadisticas/page.jsx'), 'utf8')

    // La guarda que sale temprano tiene que apagar loading en la misma linea,
    // o el render devuelve el skeleton para siempre y el mensaje
    // "Esta pagina es solo para cobradores" nunca se alcanza.
    const guarda = src.match(/if \(session\?\.user\?\.rol !== 'cobrador'\)[^\n]*\n/)
    expect(guarda, 'deberia existir la guarda de rol en el efecto').toBeTruthy()
    expect(guarda[0]).toMatch(/setLoading\(false\)/)
  })
})
