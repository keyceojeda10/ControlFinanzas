import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as c from '@/lib/cuentas-guardadas-cliente'

// El módulo lee `localStorage` en cada llamada, no al cargarse: basta con cambiar el global.
function almacen() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
afterEach(() => vi.unstubAllGlobals())

describe('las cuentas guardadas en el teléfono', () => {
  it('guardar, leer y quitar', () => {
    vi.stubGlobal('localStorage', almacen())
    c.guardarCuentaEnTelefono({ id: 'a', llave: 'k', userId: 'u1', nombre: 'Juan', rol: 'cobrador', orgNombre: 'N', conPin: false })
    expect(c.leerCuentasGuardadas()).toHaveLength(1)
    c.quitarCuentaDelTelefono('a')
    expect(c.leerCuentasGuardadas()).toEqual([])
  })

  it('la misma persona guardada otra vez reemplaza su tarjeta, no la duplica', () => {
    vi.stubGlobal('localStorage', almacen())
    c.guardarCuentaEnTelefono({ id: 'a', llave: 'k1', userId: 'u1', nombre: 'Juan', rol: 'cobrador' })
    c.guardarCuentaEnTelefono({ id: 'b', llave: 'k2', userId: 'u2', nombre: 'Carlos', rol: 'owner', conPin: true })
    c.guardarCuentaEnTelefono({ id: 'c', llave: 'k3', userId: 'u1', nombre: 'Juan', rol: 'cobrador' })
    expect(c.leerCuentasGuardadas().map((x) => x.id).sort()).toEqual(['b', 'c'])
  })

  it('sin almacenamiento (modo privado) no rompe: lista vacía', () => {
    const lanza = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: lanza, setItem: lanza, removeItem: lanza })
    expect(c.leerCuentasGuardadas()).toEqual([])
    expect(() => c.guardarCuentaEnTelefono({ id: 'a', userId: 'u1' })).not.toThrow()
  })

  it('basura en el almacén no rompe', () => {
    const a = almacen(); a.setItem('cf-cuentas-guardadas', '{no es json')
    vi.stubGlobal('localStorage', a)
    expect(c.leerCuentasGuardadas()).toEqual([])
  })
})

describe('la pantalla de entrada', () => {
  const login = readFileSync(resolve(process.cwd(), 'app/login/page.jsx'), 'utf8')
  it('la casilla dice lo que hace y SÍ se usa', () => {
    expect(login).toMatch(/>\s*Guardar esta cuenta en este teléfono\s*</)
    expect(login).toMatch(/if \(recordar\)/)
  })
  it('entra con la cuenta guardada y quita la tarjeta si ya no vale', () => {
    expect(login).toMatch(/signIn\('cuenta-guardada', \{ id: cuenta\.id, llave: cuenta\.llave, pin, redirect: false \}\)/)
    expect(login).toMatch(/if \(esMensajeDeCuentaMuerta\(msg\)\) \{/)
  })
  it('el PIN nuevo se escribe dos veces y tienen que coincidir', () => {
    expect(login).toMatch(/if \(pin !== pinNuevo\) \{/)
  })
})
