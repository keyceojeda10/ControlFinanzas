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

  // Tarea final ítem 3: la tarjeta guardada también esconde los códigos internos.
  it('VERIFY_EMAIL desde la tarjeta redirige (con el correo si lo tiene) o avisa, sin enseñar el código crudo', () => {
    expect(login).toMatch(/if \(msg === 'VERIFY_EMAIL'\) \{/)
    expect(login).toMatch(/router\.push\(`\/verificar-email\?email=\$\{encodeURIComponent\(cuenta\.email\)\}`\)/)
    expect(login).toMatch(/'Tu correo no está verificado\. Entra con tu correo y contraseña para verificarlo\.'/)
  })
  it('cualquier otro código interno cae al mismo genérico que usa el formulario', () => {
    expect(login).toMatch(/setError\(esCodigoInterno\(msg\) \? 'Correo o contraseña incorrectos' : msg\)/)
  })
  it('CUENTA_NO_VALE / PIN_AGOTADO siguen quitando la tarjeta y mostrando su propio mensaje (sin tocar)', () => {
    expect(login).toMatch(/if \(esMensajeDeCuentaMuerta\(msg\)\) \{\n\s+quitarCuentaDelTelefono\(cuenta\.id\)/)
  })

  // Tarea final ítem 5 (parte cliente): no deja una fila huérfana en el servidor.
  it('al guardar, si ya había una tarjeta de esta persona en el teléfono, borra la fila vieja del servidor antes de guardar la nueva', () => {
    expect(login).toMatch(/const vieja = leerCuentasGuardadas\(\)\.find\(\(c\) => c\.userId === nueva\.userId\)/)
    expect(login).toMatch(/fetch\(`\/api\/cuentas-guardadas\/\$\{vieja\.id\}`, \{\n\s+method: 'DELETE', headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(\{ llave: vieja\.llave \}\),\n\s+\}\)\.catch\(\(\) => \{\}\)/)
    // El orden importa: primero se decide si hay que borrar la vieja, luego se guarda la nueva.
    const iVieja = login.indexOf('const vieja = leerCuentasGuardadas()')
    const iGuardar = login.indexOf('guardarCuentaEnTelefono(nueva)')
    expect(iVieja).toBeGreaterThan(-1)
    expect(iGuardar).toBeGreaterThan(iVieja)
  })

  // Tarea final ítem 7: sin flash del formulario en la app instalada.
  it('modo arranca neutro (null), no en \'formulario\': el efecto es el único que decide', () => {
    expect(login).toMatch(/const \[modo, setModo\] = useState\(null\)/)
    expect(login).toMatch(/setModo\(lista\.length \? 'cuentas' : 'formulario'\)/)
  })
  it('con la lista vacía (localStorage bloqueado) el efecto igual manda a \'formulario\', no deja `modo` colgado', () => {
    // La rama vieja solo decidía cuando SÍ había cuentas; con la lista vacía
    // `modo` se quedaba en null para siempre y no pintaba nada.
    expect(login).not.toMatch(/if \(lista\.length\) setModo\('cuentas'\)/)
  })
})
