// lib/__tests__/aviso-sin-ubicacion.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Medido en producción el 22 sep 2026 sobre 14 días de cobros: la ubicación
// llega en el 70 % (87 % entre cobradores), pero no repartida. SEIS cobradores
// no mandan ninguna, ningún día —permiso negado en su teléfono— y uno que venía
// al 100 % todos los días se quedó en 0 de 11 de un día para otro. El sistema
// funcionaba; lo que faltaba era DECIRLO: ni el cobrador ni el dueño lo veían.
//
// `estadoUbicacion()` contesta con una palabra para poder escribirla en
// pantalla, y solo se avisa de lo que el cobrador puede arreglar.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

/* El navegador, de mentira: `permissions.query` y un GPS que contesta lo que se
   le diga. `lib/geo.js` guarda estado entre llamadas, así que cada caso lo
   importa de nuevo (`?v=`). */
async function conNavegador({ permiso, fallo, exito }) {
  vi.stubGlobal('navigator', {
    permissions: permiso === undefined ? undefined : { query: async () => ({ state: permiso }) },
    geolocation: {
      getCurrentPosition: (ok, mal) => {
        if (exito) ok({ coords: { latitude: 10, longitude: -74 } })
        else mal({ code: fallo })
      },
    },
  })
  return import(`@/lib/geo?v=${Math.random()}`)
}

afterEach(() => { vi.unstubAllGlobals() })

describe('¿por qué no llega la ubicación?', () => {
  it('sin geolocalización en el navegador', async () => {
    vi.stubGlobal('navigator', {})
    const geo = await import(`@/lib/geo?v=${Math.random()}`)
    expect(await geo.estadoUbicacion()).toBe('sin-soporte')
  })

  it('permiso negado: «sin-permiso», aunque nadie haya intentado leer', async () => {
    const geo = await conNavegador({ permiso: 'denied' })
    expect(await geo.estadoUbicacion()).toBe('sin-permiso')
  })

  it('permiso dado y el GPS contesta: «ok»', async () => {
    const geo = await conNavegador({ permiso: 'granted', exito: true })
    await geo.obtenerCoordsRapido(50)
    expect(await geo.estadoUbicacion()).toBe('ok')
  })

  it('permiso dado pero el teléfono no da la posición: «apagada»', async () => {
    const geo = await conNavegador({ permiso: 'granted', fallo: 2 })
    await geo.obtenerCoordsRapido(50)
    expect(await geo.estadoUbicacion()).toBe('apagada')
  })

  it('sin `permissions` (Safari viejo): lo dice el último fallo', async () => {
    const geo = await conNavegador({ permiso: undefined, fallo: 1 })
    await geo.obtenerCoordsRapido(50)
    expect(await geo.estadoUbicacion()).toBe('sin-permiso')
  })

  it('todavía sin pedirlo: «preguntar», que NO se le enseña a nadie', async () => {
    const geo = await conNavegador({ permiso: 'prompt' })
    expect(await geo.estadoUbicacion()).toBe('preguntar')
  })
})

describe('dónde se dice', () => {
  it('al cobrador, dentro de la hoja de cobro, y no en un recargo', () => {
    expect(src('components/prestamos/RegistrarPago.jsx'))
      .toMatch(/aviso=\{<AvisoUbicacion activo=\{open && !\['recargo', 'descuento'\]\.includes\(tipo\)\} \/>\}/)
    // Solo los dos estados que el cobrador puede arreglar.
    const aviso = src('components/cf/AvisoUbicacion.jsx')
    expect(aviso).toMatch(/'sin-permiso':/)
    expect(aviso).toMatch(/\n {2}apagada:/)
    expect(aviso).not.toMatch(/preguntar:/)
  })

  it('al dueño, en la caja de ese cobrador, y solo si hay alguno', () => {
    expect(src('app/api/caja/cobrador/[id]/route.js'))
      .toMatch(/const cobrosSinUbicacion = cobros\.filter\(\(p\) => p\.latitud == null\)\.length/)
    // El campo se pide en el select: sin él, `latitud` es undefined y saldrían todos.
    expect(src('app/api/caja/cobrador/[id]/route.js')).toMatch(/latitud: true,/)
    expect(src('components/caja/CajaCobradorDetalle.jsx')).toMatch(/\(data\?\.cobrosSinUbicacion \?\? 0\) > 0 && \(/)
  })
})
