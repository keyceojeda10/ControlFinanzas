// «EL SISTEMA SE CUELGA EN EL PAGO… Y DE REPENTE SE ABRE, BOOM» — el dueño, 20 sep 2026.
//
// Dos cosas distintas, y las dos se vigilan aquí:
//   1. LA CAUSA. Antes de MANDAR el cobro, la app hacía `await` de una lectura de
//      GPS en alta precisión con 4 s de plazo. Ahora el GPS se adelanta y el cobro
//      no lo espera más de 1,2 s; la ubicación que llega tarde se pone después.
//   2. LA ESPERA QUE QUEDA (el viaje al servidor) se cuenta: la pantalla de
//      «estoy en eso» sale en el acto tras el gesto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

const lee = (p) => fs.readFileSync(p, 'utf8')

describe('el GPS no tiene esperando a un cobro', () => {
  let geo
  let pendiente

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    pendiente = null
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (ok, mal, opciones) => { pendiente = { ok, mal, opciones } } },
    })
    geo = await import('@/lib/geo')
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('si el GPS no contesta, el cobro sale a los 1,2 s — no a los 4,5', async () => {
    let resuelto = 'esperando'
    geo.obtenerCoordsRapido().then((c) => { resuelto = c })
    await vi.advanceTimersByTimeAsync(1100)
    expect(resuelto).toBe('esperando')
    await vi.advanceTimersByTimeAsync(200)
    expect(resuelto).toBeNull()
  })

  it('con el GPS calentado al abrir la hoja, contesta AL INSTANTE', async () => {
    geo.calentarCoords()
    pendiente.ok({ coords: { latitude: 4.6, longitude: -74.1 } })
    await vi.advanceTimersByTimeAsync(0)
    let resuelto = 'esperando'
    geo.obtenerCoordsRapido().then((c) => { resuelto = c })
    await vi.advanceTimersByTimeAsync(0)
    expect(resuelto).toEqual({ latitud: 4.6, longitud: -74.1 })
  })

  it('una lectura de hace más de un minuto ya no vale', async () => {
    geo.calentarCoords()
    pendiente.ok({ coords: { latitude: 4.6, longitude: -74.1 } })
    await vi.advanceTimersByTimeAsync(61_000)
    let resuelto = 'esperando'
    geo.obtenerCoordsRapido().then((c) => { resuelto = c })
    await vi.advanceTimersByTimeAsync(1300)
    expect(resuelto).toBeNull()
  })

  it('sigue pidiendo alta precisión: es un dato de auditoría', () => {
    geo.calentarCoords()
    expect(pendiente.opciones.enableHighAccuracy).toBe(true)
  })

  it('la ubicación que llega tarde se le pone al pago', async () => {
    const fetchEspia = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchEspia)
    const tarea = geo.completarUbicacionDelPago('pago123')
    pendiente.ok({ coords: { latitude: 4.6, longitude: -74.1 } })
    await vi.advanceTimersByTimeAsync(0)
    await tarea
    expect(fetchEspia).toHaveBeenCalledWith('/api/pagos/pago123/ubicacion', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchEspia.mock.calls[0][1].body)).toEqual({ latitud: 4.6, longitud: -74.1 })
  })

  it('y nunca lanza, ni sin pago ni sin GPS', async () => {
    await expect(geo.completarUbicacionDelPago(null)).resolves.toBeUndefined()
  })
})

describe('el endpoint de la ubicación tardía solo RELLENA', () => {
  const src = lee('app/api/pagos/[id]/ubicacion/route.js')
  it('no pisa una ubicación que ya existe', () => {
    expect(src).toContain('if (pago.latitud != null) return Response.json({ ok: true, yaTenia: true })')
    expect(src).toContain('where: { id, organizationId, latitud: null }')
  })
  it('solo quien cobró o el dueño, y solo en los cinco minutos siguientes', () => {
    expect(src).toContain("if (rol !== 'owner' && pago.cobradorId !== userId)")
    expect(src).toMatch(/VENTANA_MS = 5 \* 60 \* 1000/)
  })
  it('es del negocio de la sesión', () => {
    expect(src).toContain('where: { id, organizationId }')
  })
  it('solo exporta verbos HTTP', () => {
    const exportados = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map((m) => m[1])
    expect(exportados).toEqual(['POST'])
  })
})

describe('los caminos que mueven plata ya no esperan al GPS fuera de la pantalla', () => {
  const CAMINOS = [
    'app/(dashboard)/rutas/[id]/page.jsx',
    'app/(dashboard)/cobros-hoy/page.jsx',
    'components/prestamos/RegistrarPago.jsx',
  ]
  for (const ruta of CAMINOS) {
    it(ruta, () => {
      const src = lee(ruta)
      expect(src, 'usa la pantalla').toMatch(/conPantalla\(/)
      expect(src, 'calienta el GPS al abrir').toMatch(/calentarCoords\(\)/)
      expect(src, 'completa la ubicación tardía').toMatch(/completarUbicacionDelPago\(/)
      // La lectura del GPS va DENTRO de la operación que cubre la pantalla.
      const dentro = src.slice(src.indexOf('conPantalla('))
      expect(dentro.slice(0, 400)).toMatch(/obtenerCoordsRapido\(\)/)
    })
  }

  it('los billetes solo si la plata va al bolsillo: lo decide entraAlFajo', () => {
    for (const ruta of CAMINOS) {
      const src = lee(ruta)
      expect(src).toMatch(/entraAlFajo\([^)]*\)[\s\S]{0,160}'cobro' : 'cobroEnCuenta'|enFajo \? 'cobro' : 'cobroEnCuenta'/)
    }
  })

  it('crear préstamo, renovar y crear cliente también la usan', () => {
    expect(lee('app/(dashboard)/prestamos/nuevo/page.jsx')).toContain("conPantalla('prestamo'")
    expect(lee('components/prestamos/RenovarPrestamo.jsx')).toContain("conPantalla(soloModo ? 'guardando' : 'renovar'")
    expect(lee('components/clientes/ClienteForm.jsx')).toContain("conPantalla(esEdicion ? 'guardando' : 'cliente'")
  })
})

describe('la pantalla de «estoy en eso»', () => {
  const src = lee('components/cf/Procesando.jsx')

  it('cada guion tiene pasos y una ilustración que existe', async () => {
    const { GUIONES } = await import('@/lib/procesando')
    for (const [clave, g] of Object.entries(GUIONES)) {
      expect(g.pasos.length, clave).toBeGreaterThan(0)
      expect(src, `falta el dibujo «${g.ilustracion}»`).toMatch(new RegExp(`\\b${g.ilustracion}: \\w+`))
    }
    // Una transferencia no pinta billetes que no están.
    expect(GUIONES.cobroEnCuenta.ilustracion).toBe('telefono')
  })

  it('no inventa espera: el mínimo es corto y no hay un «¡Listo!» de propina', async () => {
    const { MINIMO_MS } = await import('@/lib/procesando')
    expect(MINIMO_MS).toBeLessThanOrEqual(800)
    expect(src).not.toMatch(/>¡Listo!</)
  })

  describe('los tiempos', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('sale EN EL ACTO y se va en cuanto la operación termina', async () => {
      const { crearConPantalla, MINIMO_MS } = await import('@/lib/procesando')
      const pintado = []
      const conPantalla = crearConPantalla((e) => pintado.push(e ? (e.saliendo ? 'saliendo' : e.guion) : null))
      const promesa = conPantalla('cobro', () => new Promise((r) => setTimeout(() => r('ok'), 2000)))
      expect(pintado).toEqual(['cobro'])                       // sin esperar a nada
      await vi.advanceTimersByTimeAsync(2000)
      expect(pintado).toEqual(['cobro', 'saliendo'])           // 2 s > mínimo: ni un ms de más
      await vi.advanceTimersByTimeAsync(180)
      expect(pintado).toEqual(['cobro', 'saliendo', null])
      await expect(promesa).resolves.toBe('ok')
      expect(MINIMO_MS).toBeLessThan(2000)
    })

    it('si el servidor contesta en un suspiro, aguanta el mínimo y no parpadea', async () => {
      const { crearConPantalla, MINIMO_MS } = await import('@/lib/procesando')
      const pintado = []
      const conPantalla = crearConPantalla((e) => pintado.push(e ? (e.saliendo ? 'saliendo' : e.guion) : null))
      conPantalla('cobro', () => Promise.resolve('ok'))
      await vi.advanceTimersByTimeAsync(MINIMO_MS - 50)
      expect(pintado).toEqual(['cobro'])
      await vi.advanceTimersByTimeAsync(50)
      expect(pintado).toEqual(['cobro', 'saliendo'])
    })

    it('se quita también cuando la operación falla, y relanza el error', async () => {
      const { crearConPantalla } = await import('@/lib/procesando')
      const pintado = []
      const conPantalla = crearConPantalla((e) => pintado.push(e ? 'puesta' : null))
      const comprobacion = expect(conPantalla('cobro', () => Promise.reject(new Error('sin red')))).rejects.toThrow('sin red')
      await vi.advanceTimersByTimeAsync(1500)
      await comprobacion
      expect(pintado.at(-1)).toBeNull()
    })
  })

  it('es carbón literal, respeta «menos movimiento» y avisa al lector de pantalla', () => {
    expect(src).toContain('background: BLOQUE.fondo')
    expect(src).toContain('@media (prefers-reduced-motion: reduce)')
    expect(src).toContain('role="status"')
  })
})
