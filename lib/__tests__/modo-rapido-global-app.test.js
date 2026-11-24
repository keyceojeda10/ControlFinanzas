// lib/__tests__/modo-rapido-global-app.test.js
//
// Tarea 10 (23 nov 2026), el lado de la app y el del panel.
//
// El modo rápido ya no se enciende «por dispositivo, con ?rapido=1»: nace
// encendido para todos y Carlos lo apaga desde su panel. La app decide así:
//
//     localStorage '0'  →  apagado        (salida de soporte, por teléfono)
//     localStorage '1'  →  encendido
//     sin valor         →  lo que diga GET /api/ajustes/modo-rapido
//     si la petición falla  →  no se manda nada: el service worker se queda como estaba
//
// `decidirModoRapido` es la parte pura y se prueba de verdad. `OfflineProvider` y
// el panel son de cliente y aquí no hay DOM, así que se anclan en el CÓDIGO sin
// comentarios (los comentarios de este repo citan a los clientes).

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { decidirModoRapido, CADA_CUANTO_SE_PREGUNTA_MS, CLAVE_LOCAL_MODO_RAPIDO } from '@/lib/modo-rapido'

const leer = (ruta) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('decidirModoRapido: quién manda', () => {
  const consultar = (respuesta) => vi.fn(async () => respuesta)

  it("el '0' del teléfono apaga, aunque el panel lo tenga encendido, y ni pregunta", async () => {
    const c = consultar({ activo: true })
    expect(await decidirModoRapido({ propio: '0', autenticado: true, consultar: c })).toBe(false)
    expect(c).not.toHaveBeenCalled()
  })

  it("el '1' del teléfono enciende, aunque el panel lo tenga apagado, y ni pregunta", async () => {
    const c = consultar({ activo: false })
    expect(await decidirModoRapido({ propio: '1', autenticado: true, consultar: c })).toBe(true)
    expect(c).not.toHaveBeenCalled()
  })

  it('sin valor en el teléfono manda el panel', async () => {
    expect(await decidirModoRapido({ propio: null, autenticado: true, consultar: consultar({ activo: true }) })).toBe(true)
    expect(await decidirModoRapido({ propio: null, autenticado: true, consultar: consultar({ activo: false }) })).toBe(false)
  })

  it('un valor raro en el teléfono no cuenta como «propio»: manda el panel', async () => {
    expect(await decidirModoRapido({ propio: 'si', autenticado: true, consultar: consultar({ activo: false }) })).toBe(false)
    expect(await decidirModoRapido({ propio: '', autenticado: true, consultar: consultar({ activo: true }) })).toBe(true)
  })

  it('si la petición falla no decide nada (null): el service worker se queda como estaba', async () => {
    const cae = vi.fn(async () => { throw new Error('sin red') })
    expect(await decidirModoRapido({ propio: null, autenticado: true, consultar: cae })).toBeNull()
  })

  it('si el servidor contesta algo que no es { activo: boolean }, tampoco decide', async () => {
    for (const r of [null, undefined, {}, { activo: 'si' }, { activo: 1 }, { error: 'x' }]) {
      expect(await decidirModoRapido({ propio: null, autenticado: true, consultar: consultar(r) }), JSON.stringify(r)).toBeNull()
    }
  })

  it('sin sesión no pregunta ni decide (la pantalla de entrada no apaga lo que había)', async () => {
    const c = consultar({ activo: false })
    expect(await decidirModoRapido({ propio: null, autenticado: false, consultar: c })).toBeNull()
    expect(c).not.toHaveBeenCalled()
  })

  it('pero el interruptor del propio teléfono vale también sin sesión', async () => {
    expect(await decidirModoRapido({ propio: '0', autenticado: false, consultar: consultar({ activo: true }) })).toBe(false)
  })

  it('se vuelve a preguntar cada 30 minutos', () => {
    expect(CADA_CUANTO_SE_PREGUNTA_MS).toBe(30 * 60 * 1000)
    expect(CLAVE_LOCAL_MODO_RAPIDO).toBe('cf-modo-rapido')
  })
})

describe('OfflineProvider: cómo usa la decisión', () => {
  const provider = sinNotas(leer('components/providers/OfflineProvider.jsx'))
  /* El efecto del modo rápido: del `useEffect` que llama a `decidirModoRapido`
     hasta su lista de dependencias. */
  const llamada = provider.indexOf('await decidirModoRapido(')
  const abre = provider.lastIndexOf('useEffect(() => {', llamada)
  const cierra = provider.indexOf('\n  }, [', llamada)
  const efecto = llamada > -1 && abre > -1 && cierra > -1 ? provider.slice(abre, provider.indexOf('])', cierra) + 2) : ''

  it('hay un efecto propio del modo rápido', () => {
    expect(efecto, 'no se encontró el efecto').toBeTruthy()
    expect(efecto).toMatch(/type: 'MODO_RAPIDO', activo/)
  })

  it("pregunta al servidor SOLO cuando el teléfono no tiene su propio valor: lo decide `decidirModoRapido`", () => {
    expect(provider).toMatch(/import \{[^}]*decidirModoRapido[^}]*\} from '@\/lib\/modo-rapido'/)
    expect(efecto).toMatch(/fetch\('\/api\/ajustes\/modo-rapido'\)/)
    expect(efecto).toMatch(/propio: localStorage\.getItem\(CLAVE_LOCAL_MODO_RAPIDO\)|getItem\(CLAVE_LOCAL_MODO_RAPIDO\)/)
    // Y la petición solo se hace dentro de `consultar`, que la función llama al final.
    expect(efecto).toMatch(/consultar:/)
  })

  it('una respuesta que no es 200 (el 503 de un bache de la base) no decide nada', () => {
    // `consultar` devuelve null cuando `!r.ok`, y `decidirModoRapido` lo vuelve null.
    expect(efecto).toMatch(/\(r\.ok \? r\.json\(\) : null\)/)
  })

  it('si no hay decisión (null) no manda nada al service worker', () => {
    expect(efecto).toMatch(/if \(activo !== null\)/)
    // Nunca se manda un `false` por defecto: `activo` solo se manda tras ese `if`.
    const iMandar = efecto.indexOf("type: 'MODO_RAPIDO', activo")
    const iSi = efecto.indexOf('if (activo !== null)')
    expect(iSi).toBeGreaterThan(-1)
    expect(iSi).toBeLessThan(iMandar)
  })

  it('el interruptor de la URL (?rapido=1 / ?rapido=0) sigue como salida de soporte', () => {
    expect(provider).toMatch(/get\('rapido'\)/)
    expect(provider).toMatch(/localStorage\.setItem\(CLAVE_LOCAL_MODO_RAPIDO, parametro\)/)
    expect(provider).toMatch(/parametro === '1' \|\| parametro === '0'/)
  })

  it('al volver a la pestaña vuelve a preguntar si pasaron 30 minutos', () => {
    expect(efecto).toMatch(/addEventListener\('visibilitychange'/)
    expect(efecto).toMatch(/removeEventListener\('visibilitychange'/)
    expect(efecto).toMatch(/Date\.now\(\) - ultimaConsulta >= CADA_CUANTO_SE_PREGUNTA_MS/)
  })

  it('no se pregunta en desarrollo (ahí el service worker ni se registra)', () => {
    expect(efecto).toMatch(/process\.env\.NODE_ENV !== 'production'/)
  })

  it('la sesión entra en la cuenta: al iniciar sesión sin recargar, se pregunta entonces', () => {
    expect(provider).toMatch(/useSession\(\)/)
    expect(efecto).toMatch(/autenticado: estadoSesion === 'authenticated'/)
    expect(efecto).toMatch(/\}, \[estadoSesion\]\)/)
  })
})

describe('el panel: «Modo rápido para todos»', () => {
  const panelCrudo = leer('app/admin/inicio/page.jsx')
  const panel = sinNotas(panelCrudo)

  it('usa el Toggle canónico, no un switch propio', () => {
    expect(panel).toMatch(/import \{ Toggle \} from '@\/components\/ui\/Toggle'/)
    expect(panel).toMatch(/<Toggle\b[^>]*label="Modo rápido para todos"/)
  })

  it('lee y escribe contra /api/admin/ajustes', () => {
    expect(panel).toMatch(/fetch\('\/api\/admin\/ajustes'\)/)
    expect(panel).toMatch(/fetch\('\/api\/admin\/ajustes', \{[^}]*method: 'PATCH'/)
    expect(panel).toMatch(/JSON\.stringify\(\{ modoRapido: /)
  })

  it('explica en palabras simples lo que hace y cómo se apaga', () => {
    expect(panel).toContain('Las pantallas salen al instante desde el teléfono y las cifras se traen de la red.')
    expect(panel).toContain('Si alguien reporta algo raro, apágalo aquí y en unos minutos todos vuelven al modo de siempre.')
  })

  it('no inventa su propio estado: hasta que el servidor contesta, el interruptor está quieto', () => {
    expect(panel).toMatch(/disabled=\{[^}]*(guardando|encendido === null)/)
  })

  it('el panel no estrena colores ni emojis: tokens de la casa', () => {
    const bloque = panel.match(/function ModoRapidoParaTodos[\s\S]*?\n\}\n/)?.[0] ?? ''
    expect(bloque, 'no se encontró el bloque').toBeTruthy()
    expect(bloque).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(bloque).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('el panel se pinta con el componente puesto en la página de Inicio', () => {
    expect(panel).toMatch(/<ModoRapidoParaTodos \/>/)
  })
})

describe('sw.js: la cabecera del modo rápido dice la verdad nueva', () => {
  const sw = leer('public/sw.js')

  it('ya no dice que está apagado para todo el mundo ni que es por dispositivo', () => {
    expect(sw).not.toMatch(/apagado para todo el mundo/)
    expect(sw).not.toMatch(/Se enciende por dispositivo con `\?rapido=1`/)
  })

  it('el worker no cambió de lógica: sigue sin saberlo hasta que la app se lo dice', () => {
    const codigo = sinNotas(sw)
    expect(codigo).toMatch(/e\.data\?\.type === 'MODO_RAPIDO'/)
    expect(codigo).not.toMatch(/ajustes\/modo-rapido/)
  })
})
