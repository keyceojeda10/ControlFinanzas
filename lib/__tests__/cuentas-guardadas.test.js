import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const fila = vi.hoisted(() => ({ current: null }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaGuardada: {
      create: vi.fn(async ({ data }) => { fila.current = { id: 'cg1', intentosPin: 0, lastUsedAt: new Date(), ...data }; return { id: 'cg1' } }),
      findUnique: vi.fn(async () => fila.current),
      // `{ intentosPin: { increment: 1 } }` se aplica numéricamente, como haría
      // MariaDB, y con `select` devuelve solo esos campos: así la prueba puede
      // comprobar que el código usa el valor que vuelve del `update`, no uno
      // calculado aparte en JS.
      update: vi.fn(async ({ data, select }) => {
        const cambios = {}
        for (const [campo, valor] of Object.entries(data)) {
          cambios[campo] = (valor && typeof valor === 'object' && 'increment' in valor)
            ? (fila.current[campo] ?? 0) + valor.increment
            : valor
        }
        fila.current = { ...fila.current, ...cambios }
        if (!select) return fila.current
        return Object.fromEntries(Object.keys(select).map((campo) => [campo, fila.current[campo]]))
      }),
      delete: vi.fn(async () => { fila.current = null }),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}))

import {
  llevaPin, pinValido, generarLlave, huellaDeLlave, llaveCoincide, vencida,
  crearCuentaGuardada, abrirCuentaGuardada, quitarConLlave, MAX_INTENTOS_PIN,
} from '@/lib/cuentas-guardadas'
import { CUENTA_NO_VALE, PIN_AGOTADO, esMensajeDeCuentaMuerta } from '@/lib/cuentas-guardadas-textos'

beforeEach(() => { fila.current = null })

describe('la llave', () => {
  it('es larga y aleatoria, y el servidor solo guarda su huella', () => {
    const a = generarLlave(), b = generarLlave()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43) // 32 bytes en base64url
    expect(huellaDeLlave(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(llaveCoincide(a, huellaDeLlave(a))).toBe(true)
    expect(llaveCoincide(b, huellaDeLlave(a))).toBe(false)
    expect(llaveCoincide(a, 'basura')).toBe(false)
  })
})

describe('quién lleva PIN', () => {
  it('dueño y superadmin sí; cobrador no', () => {
    expect(llevaPin('owner')).toBe(true)
    expect(llevaPin('superadmin')).toBe(true)
    expect(llevaPin('cobrador')).toBe(false)
    expect(pinValido('0427')).toBe(true)
    expect(pinValido('427')).toBe(false)
    expect(pinValido('12a4')).toBe(false)
  })
})

describe('vigencia', () => {
  it('60 días sin uso y deja de valer', () => {
    const ahora = Date.parse('2026-09-24T12:00:00Z')
    expect(vencida(new Date(ahora - 59 * 86400000), ahora)).toBe(false)
    expect(vencida(new Date(ahora - 61 * 86400000), ahora)).toBe(true)
  })
})

describe('abrir una cuenta guardada', () => {
  it('cobrador: con la llave basta', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador', dispositivo: 'Android · Chrome' })
    expect(fila.current.pinHash).toBeNull()
    expect(await abrirCuentaGuardada({ id, llave })).toBe('u1')
  })

  it('dueño sin PIN no se puede guardar', async () => {
    await expect(crearCuentaGuardada({ userId: 'u2', rol: 'owner' })).rejects.toThrow('PIN_REQUERIDO')
  })

  it('dueño: PIN correcto entra y deja el contador en cero', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    expect(await bcrypt.compare('0427', fila.current.pinHash)).toBe(true)
    await expect(abrirCuentaGuardada({ id, llave, pin: '1111' })).rejects.toThrow(/Te quedan 4 intentos/)
    expect(await abrirCuentaGuardada({ id, llave, pin: '0427' })).toBe('u2')
    expect(fila.current.intentosPin).toBe(0)
  })

  it(`al ${MAX_INTENTOS_PIN}.º PIN errado la cuenta se borra`, async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    for (let i = 1; i < MAX_INTENTOS_PIN; i++) {
      await expect(abrirCuentaGuardada({ id, llave, pin: '9999' })).rejects.toThrow(/PIN incorrecto/)
    }
    await expect(abrirCuentaGuardada({ id, llave, pin: '9999' })).rejects.toThrow(PIN_AGOTADO)
    expect(fila.current).toBeNull()
  })

  it('el contador sale del update atómico, no de un cálculo en JS: si otro pedido ya lo subió a 4, este PIN errado agota', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    fila.current.intentosPin = 4 // otro pedido concurrente ya lo dejó aquí
    await expect(abrirCuentaGuardada({ id, llave, pin: '9999' })).rejects.toThrow(PIN_AGOTADO)
    expect(fila.current).toBeNull()
  })

  it('llave equivocada o cuenta vencida: el mismo mensaje, y la vencida se borra', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador' })
    await expect(abrirCuentaGuardada({ id, llave: 'otra' })).rejects.toThrow(CUENTA_NO_VALE)
    fila.current.lastUsedAt = new Date(Date.now() - 61 * 86400000)
    await expect(abrirCuentaGuardada({ id, llave })).rejects.toThrow(CUENTA_NO_VALE)
    expect(fila.current).toBeNull()
  })

  it('quitar con la llave solo borra si la llave es la suya', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador' })
    expect(await quitarConLlave({ id, llave: 'otra' })).toBe(false)
    expect(await quitarConLlave({ id, llave })).toBe(true)
  })

  it('Tarea final ítem 9: si un borrado del 5.º intento falló antes, la fila sobrevive agotada y la siguiente entra sin comparar el PIN', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    fila.current.intentosPin = MAX_INTENTOS_PIN // el delete de la última vez no se completó
    const espiaCompare = vi.spyOn(bcrypt, 'compare')
    await expect(abrirCuentaGuardada({ id, llave, pin: '0427' })).rejects.toThrow(PIN_AGOTADO)
    expect(fila.current).toBeNull() // esta vez sí se borró
    expect(espiaCompare).not.toHaveBeenCalled() // ni siquiera con el PIN correcto
    espiaCompare.mockRestore()
  })

  it('el navegador reconoce los dos mensajes que obligan a quitar la tarjeta', () => {
    expect(esMensajeDeCuentaMuerta(CUENTA_NO_VALE)).toBe(true)
    expect(esMensajeDeCuentaMuerta(PIN_AGOTADO)).toBe(true)
    expect(esMensajeDeCuentaMuerta('PIN incorrecto. Te quedan 2 intentos.')).toBe(false)
  })
})
