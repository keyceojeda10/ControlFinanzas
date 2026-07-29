import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const raiz = process.cwd()
const timeout = fs.readFileSync(path.join(raiz, 'lib/fetch-timeout.js'), 'utf8')
const login = fs.readFileSync(path.join(raiz, 'app/login/page.jsx'), 'utf8')

// Dos defensas para el mismo fallo: el usuario mete bien la clave, signIn
// acierta, y la app le dice "Error al iniciar sesión".
//
// Pasaba porque tras el signIn hay un GET a /api/auth/session, y ese GET caía
// en el presupuesto de 1,5s del modo limbo. La persona quedaba FUERA de la app
// sin forma de entrar, que es el único sitio del sistema donde fallar rápido no
// tiene degradación posible.

describe('autenticación · nunca con el presupuesto del limbo', () => {
  it('/api/auth/ está exento, igual que el sync masivo', () => {
    expect(timeout).toMatch(/const esAuth = \(u\) => u\.includes\('\/api\/auth\/'\)/)
    expect(timeout).toMatch(/!esAuth\(url\)/)
  })
})

describe('login · si signIn acertó, la persona está dentro', () => {
  it('no deja que la consulta del rol tumbe el login', () => {
    // La consulta a /api/auth/session solo decide a qué panel ir. Si falla, el
    // destino por defecto es el panel normal — no un mensaje de error.
    const bloque = login.slice(login.indexOf('let esSuperadmin'), login.indexOf('window.location.href = esSuperadmin'))
    expect(bloque).toContain('try {')
    expect(bloque).toContain('catch')
    expect(login).toContain("window.location.href = esSuperadmin ? '/admin/dashboard' : '/dashboard'")
  })

  it('ya no hace .json() sobre una respuesta que puede venir abortada, sin red de seguridad', () => {
    // "SyntaxError: Unexpected end of JSON input" era esto.
    const sinProteger = /const session\s+= await sessionRes\.json\(\)\n\n\s+if \(session\?\.user\?\.rol/
    expect(login).not.toMatch(sinProteger)
  })
})
