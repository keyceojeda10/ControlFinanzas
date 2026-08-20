// lib/__tests__/volver-al-sitio.test.js
//
// «que cuando salga de un préstamo vuelva al cliente donde iba cobrando»
//   — INVERSIONESJYM, 19 ago 2026. Una ruta, BOSA, 322 clientes.
//
// Esto prueba la MÁQUINA, no las pantallas: quién guarda y quién vuelve. Que
// cada lista esté enganchada se comprueba en `abono-sigue-pendiente.test.js`,
// leyendo su JSX.
//
// No hay jsdom en este proyecto —el entorno de vitest es `node`—, así que el
// DOM se finge a mano. Es suficiente: la máquina solo pide `getElementById`,
// `querySelectorAll`, `scrollIntoView`, `scrollTop` y `sessionStorage`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  guardarSitio, tomarSitio, volverAlSitio, marcarVuelta,
  desplazamientoActual, contenedorQueDesplaza, MS_RESALTADO,
} from '../sitio-de-la-lista'

function fingirElemento({ id = '', scrollHeight = 0, clientHeight = 0 } = {}) {
  const clases = new Set()
  return {
    id, scrollHeight, clientHeight, scrollTop: 0,
    traidaALaVista: null,
    scrollIntoView(opts) { this.traidaALaVista = opts },
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c),
    },
    clases,
  }
}

let cajas, fichas, guardadas

beforeEach(() => {
  cajas = []
  fichas = new Map()
  guardadas = new Map()
  globalThis.document = {
    querySelectorAll: () => cajas,
    getElementById: (id) => fichas.get(id) ?? null,
  }
  globalThis.window = {
    scrollY: 0,
    desplazadaA: null,
    scrollTo(_x, y) { this.desplazadaA = y },
  }
  globalThis.sessionStorage = {
    getItem: (k) => (guardadas.has(k) ? guardadas.get(k) : null),
    setItem: (k, v) => guardadas.set(k, String(v)),
    removeItem: (k) => guardadas.delete(k),
  }
})

afterEach(() => {
  delete globalThis.document
  delete globalThis.window
  delete globalThis.sessionStorage
})

describe('quién desplaza de verdad', () => {
  it('el contenedor con overflow, no la ventana', () => {
    // La lista va dentro de un div con `overflow-y: auto`: `window.scrollY` es
    // SIEMPRE 0. Guardar el de la ventana era guardar cero siempre.
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    lista.scrollTop = 1840
    cajas = [fingirElemento({ scrollHeight: 100, clientHeight: 100 }), lista]

    expect(contenedorQueDesplaza()).toBe(lista)
    expect(desplazamientoActual()).toBe(1840)
  })

  it('sin contenedor que desplace, la ventana', () => {
    cajas = [fingirElemento({ scrollHeight: 100, clientHeight: 100 })]
    globalThis.window.scrollY = 320
    expect(desplazamientoActual()).toBe(320)
  })

  it('un contenedor bajito no cuenta', () => {
    // 200px de alto es una tarjeta con scroll interno, no la lista.
    cajas = [fingirElemento({ scrollHeight: 900, clientHeight: 200 })]
    expect(contenedorQueDesplaza()).toBe(null)
  })
})

describe('guardar y recoger el sitio', () => {
  beforeEach(() => {
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    lista.scrollTop = 1840
    cajas = [lista]
  })

  it('guarda la fila y el desplazamiento', () => {
    guardarSitio('cobros-hoy', 'cli_7')
    expect(tomarSitio('cobros-hoy')).toEqual({ itemId: 'cli_7', y: 1840 })
  })

  it('⚠ SE CONSUME AL LEERLO', () => {
    // Si se quedara guardado, abrir la lista por el menú a la mañana siguiente
    // —a propósito por arriba— daría un salto al cliente de ayer.
    guardarSitio('clientes', 'cli_7')
    expect(tomarSitio('clientes')).not.toBe(null)
    expect(tomarSitio('clientes')).toBe(null)
  })

  it('cada lista tiene el suyo', () => {
    guardarSitio('clientes', 'cli_1')
    guardarSitio('prestamos', 'pre_9')
    expect(tomarSitio('clientes').itemId).toBe('cli_1')
    expect(tomarSitio('prestamos').itemId).toBe('pre_9')
  })

  it('sin nada guardado no hay salto', () => {
    expect(tomarSitio('ni-idea')).toBe(null)
  })

  it('un guardado corrupto no rompe la pantalla', () => {
    guardadas.set('cf-sitio-clientes', '{esto no es json')
    expect(tomarSitio('clientes')).toBe(null)
  })
})

describe('volver', () => {
  const ancla = (id) => `cliente-${id}`

  it('⚠ EL CLIENTE MANDA SOBRE LOS PÍXELES', () => {
    // La lista cambia entre salir y volver —al que se acabó de cobrar deja de
    // tocarle y se cambia de sitio—, así que los píxeles apuntan a otra fila.
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    cajas = [lista]
    const ficha = fingirElemento({ id: 'cliente-cli_7' })
    fichas.set('cliente-cli_7', ficha)

    const el = volverAlSitio({ itemId: 'cli_7', y: 1840 }, { ancla })

    expect(el).toBe(ficha)
    expect(ficha.traidaALaVista).toEqual({ behavior: 'instant', block: 'center' })
    expect(lista.scrollTop, 'usó los píxeles teniendo la ficha').toBe(0)
  })

  it('si esa ficha ya no está, los píxeles de respaldo', () => {
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    cajas = [lista]

    const el = volverAlSitio({ itemId: 'cli_7', y: 1840 }, { ancla })

    expect(el, 'no se resalta a quien no es').toBe(null)
    expect(lista.scrollTop).toBe(1840)
  })

  it('⚠ EL 0 ES UN DESPLAZAMIENTO VÁLIDO', () => {
    // Es el principio de la lista. Con la comprobación floja (`if (y)`) se
    // descartaba, y el respaldo no llegaba a correr.
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    lista.scrollTop = 2000
    cajas = [lista]

    volverAlSitio({ itemId: 'cli_7', y: 0 }, { ancla })

    expect(lista.scrollTop).toBe(0)
  })

  it('sin sitio guardado no se mueve nada', () => {
    const lista = fingirElemento({ scrollHeight: 4000, clientHeight: 600 })
    lista.scrollTop = 900
    cajas = [lista]

    expect(volverAlSitio(null, { ancla })).toBe(null)
    expect(lista.scrollTop).toBe(900)
  })

  it('sin contenedor, la ventana', () => {
    cajas = []
    volverAlSitio({ itemId: 'cli_7', y: 640 }, { ancla })
    expect(globalThis.window.desplazadaA).toBe(640)
  })
})

describe('el resaltado', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('se pone y se quita solo', () => {
    // Con trescientas tarjetas iguales, aterrizar sin que nada diga cuál era
    // obliga a releer nombres.
    const ficha = fingirElemento({ id: 'cliente-cli_7' })
    marcarVuelta(ficha)
    expect(ficha.classList.contains('cf-vuelta')).toBe(true)

    vi.advanceTimersByTime(MS_RESALTADO + 10)
    expect(ficha.classList.contains('cf-vuelta')).toBe(false)
  })

  it('se puede quitar antes, si la pantalla se va', () => {
    // Si no, se queda un anillo dorado clavado en una fila al volver.
    const ficha = fingirElemento({ id: 'cliente-cli_7' })
    const quitar = marcarVuelta(ficha)
    quitar()
    expect(ficha.classList.contains('cf-vuelta')).toBe(false)
  })
})
