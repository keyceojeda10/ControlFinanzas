// lib/__tests__/ajustes-globales.test.js
//
// Plan «La carga de cartera la revisa y la carga el dueño» (23 nov 2026), tarea
// 10: el modo rápido se enciende y se apaga para TODOS desde el panel.
//
// `modoRapidoGlobal()` es lo que contesta la app cuando pregunta «¿lo enciendo?».
// Tres reglas, las tres del dueño:
//   · sin fila = ENCENDIDO (decidió que nazca encendido);
//   · '0' = apagado;
//   · si la base falla, el modo de SIEMPRE (apagado): lo seguro.
// Y una caché de 60 s en memoria para no ir a la base en cada pregunta.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const m = vi.hoisted(() => ({
  fila: null,
  falla: false,
  prisma: null,
}))
m.prisma = {
  ajusteGlobal: {
    findUnique: vi.fn(async () => {
      if (m.falla) throw new Error('base caída')
      return m.fila
    }),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))

const { modoRapidoGlobal, modoRapidoConCache, invalidarAjustesGlobales, CLAVE_MODO_RAPIDO } = await import('@/lib/ajustes-globales')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-23T15:00:00Z'))
  m.fila = null
  m.falla = false
  m.prisma.ajusteGlobal.findUnique.mockClear()
  invalidarAjustesGlobales()
})
afterEach(() => vi.useRealTimers())

describe('modoRapidoGlobal', () => {
  it('lee la clave `modo_rapido`', async () => {
    await modoRapidoGlobal()
    expect(CLAVE_MODO_RAPIDO).toBe('modo_rapido')
    expect(m.prisma.ajusteGlobal.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clave: 'modo_rapido' } }),
    )
  })

  it('sin fila nace ENCENDIDO', async () => {
    m.fila = null
    expect(await modoRapidoGlobal()).toBe(true)
  })

  it("con valor '1' está encendido", async () => {
    m.fila = { valor: '1' }
    expect(await modoRapidoGlobal()).toBe(true)
  })

  it("con valor '0' está apagado", async () => {
    m.fila = { valor: '0' }
    expect(await modoRapidoGlobal()).toBe(false)
  })

  it('si la base falla, el modo de siempre (apagado), sin reventar', async () => {
    m.falla = true
    expect(await modoRapidoGlobal()).toBe(false)
  })

  it('un fallo no se queda guardado: en cuanto la base vuelve, contesta bien', async () => {
    m.falla = true
    expect(await modoRapidoGlobal()).toBe(false)
    m.falla = false
    m.fila = null
    expect(await modoRapidoGlobal()).toBe(true)
  })

  it('durante 60 s no vuelve a la base', async () => {
    m.fila = { valor: '1' }
    expect(await modoRapidoGlobal()).toBe(true)
    // Aunque la fila cambie por debajo, la respuesta guardada manda hasta que venza.
    m.fila = { valor: '0' }
    vi.advanceTimersByTime(59_000)
    expect(await modoRapidoGlobal()).toBe(true)
    expect(m.prisma.ajusteGlobal.findUnique).toHaveBeenCalledTimes(1)
  })

  it('pasados los 60 s vuelve a preguntar', async () => {
    m.fila = { valor: '1' }
    expect(await modoRapidoGlobal()).toBe(true)
    m.fila = { valor: '0' }
    vi.advanceTimersByTime(60_001)
    expect(await modoRapidoGlobal()).toBe(false)
    expect(m.prisma.ajusteGlobal.findUnique).toHaveBeenCalledTimes(2)
  })

  it('invalidarAjustesGlobales hace que el cambio se vea en la siguiente pregunta', async () => {
    m.fila = { valor: '1' }
    expect(await modoRapidoGlobal()).toBe(true)
    m.fila = { valor: '0' }
    invalidarAjustesGlobales()
    expect(await modoRapidoGlobal()).toBe(false)
  })
})

/* El «falló» no es lo mismo que «está apagado». La ruta que contesta a la app
   necesita distinguirlos: un bache de la base no puede apagar el modo rápido a
   nadie. Por eso existe `modoRapidoConCache`, que NO se traga el error. */
describe('modoRapidoConCache: el fallo se nota', () => {
  it('si la base falla, lanza (no devuelve false)', async () => {
    m.falla = true
    await expect(modoRapidoConCache()).rejects.toThrow('base caída')
  })

  it('sin fila ⇒ true, \'0\' ⇒ false, igual que modoRapidoGlobal', async () => {
    expect(await modoRapidoConCache()).toBe(true)
    invalidarAjustesGlobales()
    m.fila = { valor: '0' }
    expect(await modoRapidoConCache()).toBe(false)
  })

  it('comparte la caché de 60 s con modoRapidoGlobal', async () => {
    m.fila = { valor: '1' }
    expect(await modoRapidoConCache()).toBe(true)
    m.fila = { valor: '0' }
    expect(await modoRapidoGlobal()).toBe(true)
    expect(m.prisma.ajusteGlobal.findUnique).toHaveBeenCalledTimes(1)
  })

  it('un fallo no se guarda: la siguiente pregunta vuelve a la base', async () => {
    m.falla = true
    await expect(modoRapidoConCache()).rejects.toThrow()
    m.falla = false
    expect(await modoRapidoConCache()).toBe(true)
  })

  it('modoRapidoGlobal sigue diciendo «apagado» ante el fallo (para cualquier otro llamador)', async () => {
    m.falla = true
    expect(await modoRapidoGlobal()).toBe(false)
  })
})
