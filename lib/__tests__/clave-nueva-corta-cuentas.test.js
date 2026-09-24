import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

/* Una llave que sobrevive al cambio de contraseña es una puerta que el dueño
   cree cerrada. Las CUATRO vías que cambian una clave cortan los teléfonos. */
describe('cambiar la contraseña corta las cuentas guardadas', () => {
  it('olvidé mi clave', () => {
    expect(src('app/api/auth/reset-password/route.js')).toMatch(/await cortarCuentasGuardadas\(data\.userId\)/)
  })
  it('mi perfil, solo si cambió la clave', () => {
    expect(src('app/api/configuracion/perfil/route.js')).toMatch(/if \(updates\.password\) await cortarCuentasGuardadas\(session\.user\.id\)/)
  })
  it('el dueño le cambia la clave a un cobrador', () => {
    expect(src('app/api/cobradores/[id]/route.js')).toMatch(/if \(data\.password\) await cortarCuentasGuardadas\(id\)/)
  })
  it('el superadmin', () => {
    expect(src('app/api/admin/organizaciones/[id]/route.js')).toMatch(/await cortarCuentasGuardadas\(body\.userId\)/)
  })
})
