import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { bloqueaSoloLectura, mensajeSoloLectura } from '@/lib/solo-lectura'
import { firmarPase, leerPase, VIDA_PASE_MS } from '@/lib/pase-de-vista'

describe('solo lectura', () => {
  const vista = (method, pathname) => bloqueaSoloLectura({ soloLectura: true, pathname, method })
  it('en vista: leer pasa, escribir no', () => {
    expect(vista('GET', '/api/caja')).toBe(false)
    expect(vista('HEAD', '/api/rutas')).toBe(false)
    expect(vista('POST', '/api/prestamos/x/pagos')).toBe(true)
    expect(vista('PATCH', '/api/prestamos/x')).toBe(true)
    expect(vista('DELETE', '/api/pagos/x')).toBe(true)
    expect(vista('PUT', '/api/rutas/x/orden')).toBe(true)
  })
  it('las excepciones: salir, volver, iniciar sesión con el pase y el registro de errores', () => {
    expect(vista('POST', '/api/auth/callback/pase')).toBe(false)
    expect(vista('POST', '/api/auth/signout')).toBe(false)
    expect(vista('POST', '/api/ver-como/volver')).toBe(false)
    expect(vista('POST', '/api/errores-cliente')).toBe(false)
    // y NO el resto de /api/auth/: cambiar una clave con token sigue cerrado
    expect(vista('POST', '/api/auth/reset-password')).toBe(true)
  })
  it('fuera de vista no bloquea nada', () => {
    expect(bloqueaSoloLectura({ soloLectura: false, pathname: '/api/caja', method: 'POST' })).toBe(false)
  })
  it('el mensaje dice a quién está viendo', () => {
    expect(mensajeSoloLectura('Juan')).toBe('Estás viendo como Juan: desde aquí no se registra nada. Vuelve a tu cuenta.')
  })
  it('el middleware la aplica antes que nada en /api/', () => {
    const mw = readFileSync(resolve(process.cwd(), 'middleware.js'), 'utf8')
    const api = mw.indexOf("if (pathname.startsWith('/api/')) {")
    const regla = mw.indexOf('bloqueaSoloLectura({ soloLectura: token?.soloLectura, pathname, method: request.method })')
    expect(regla).toBeGreaterThan(api)
    expect(regla).toBeLessThan(mw.indexOf('const EXENTAS'))
  })
})

describe('el pase', () => {
  const S = 'secreto-de-prueba'
  it('firmado vale; alterado o vencido, no', () => {
    const ahora = 1_700_000_000_000
    const p = firmarPase({ tipo: 'ver-como', ownerId: 'o1', cobradorId: 'c1' }, S, ahora)
    expect(leerPase(p, S, ahora + 1000)).toMatchObject({ tipo: 'ver-como', ownerId: 'o1', cobradorId: 'c1' })
    expect(leerPase(p, S, ahora + VIDA_PASE_MS + 1)).toBeNull()
    expect(leerPase(p, 'otro-secreto', ahora)).toBeNull()
    const [cuerpo, firma] = p.split('.')
    const otro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, 'base64url').toString()), cobradorId: 'c2' })).toString('base64url')
    expect(leerPase(`${otro}.${firma}`, S, ahora)).toBeNull()
    expect(leerPase('basura', S, ahora)).toBeNull()
  })
})
