/* «Al tener usuarios guardados ya no se muestra la opción de olvidé mi
 * contraseña» (el dueño, 17 oct 2026). «La olvidé» vivía solo en el formulario,
 * y el formulario solo salía tras «Entrar con otra cuenta». El PIN no tenía
 * salida si se olvidaba, y del formulario no se volvía a las tarjetas. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recuperar la entrada con cuentas guardadas', () => {
  const tarjetas = readFileSync('components/auth/CuentasGuardadas.jsx', 'utf8')
  const login = readFileSync('app/login/page.jsx', 'utf8')
  it('las tarjetas llevan «Olvidé mi contraseña» a la página de recuperar', () => {
    expect(tarjetas).toMatch(/<Link href="\/forgot-password"[^>]*>\s*Olvidé mi contraseña\s*<\/Link>/)
  })
  it('el PIN tiene «Olvidé mi PIN»: al formulario con su correo escrito', () => {
    expect(login).toMatch(/setEmail\(cuentaPin\.email \|\| ''\); setModo\('formulario'\)[\s\S]{0,200}>\s*Olvidé mi PIN\s*<\/button>/)
    expect(readFileSync('app/api/cuentas-guardadas/route.js', 'utf8')).toMatch(/email: session\.user\.email \?\? null,/)
  })
  it('del formulario se vuelve a las tarjetas si hay cuentas guardadas', () => {
    expect(login).toMatch(/\{cuentas\.length > 0 && \([\s\S]{0,300}>\s*Volver a mis cuentas\s*<\/button>/)
  })
})
