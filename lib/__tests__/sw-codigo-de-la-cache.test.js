// lib/__tests__/sw-codigo-de-la-cache.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Noto la aplicación bastante lenta, hasta el panel de administrador. Tarda
// mucho en cargar las secciones.» — el dueño, 14 ago 2026.
//
// Medido: el servidor pinta `/login` en 7 ms y la consulta más pesada del panel
// admin tarda 16 ms. La base entera son 282 MB con 99,999 % de aciertos. No era
// el servidor. El servidor está en **Boston** y cada viaje desde Colombia cuesta
// ~90 ms, y la app pedía a la red hasta su propio código —que lleva la huella
// del contenido en el nombre y NO PUEDE cambiar—.
//
// Peor: `networkFirst` ni siquiera guarda lo que trae. La caché de los chunks
// estaba viva en el nombre y muerta en los hechos, y sin señal la app no podía
// cargar ni su propio código.
//
// ── EL MIEDO QUE HABÍA ESCRITO, Y CÓMO SE COMPROBÓ ─────────────────────────
// El comentario decía que caché primero servía chunks viejos «porque los chunk
// IDs de Next.js pueden repetirse entre builds con contenido diferente». Se
// compiló el proyecto dos veces con código distinto y se compararon los 391
// archivos de cada build por md5:
//
//     nombres presentes en los DOS builds: 389
//       con contenido IDÉNTICO:  389
//       con contenido DISTINTO:  0
//
// Los dos archivos que cambiaron estrenaron nombre. El hash del nombre ES el del
// contenido. El fallo real era otro: `caches.match()` busca en TODAS las cachés
// del origen, huérfanas incluidas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
const sinNotas = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el código de la app se sirve de la caché', () => {
  it('_next/static no va a la red cada vez', () => {
    const rama = sinNotas.match(/if \(url\.pathname\.startsWith\('\/_next\/static'\)\)[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(rama, 'no se encontró la rama de _next/static').toBeTruthy()
    expect(rama).toMatch(/cacheFirst\(request, STATIC_CACHE\)/)
    expect(rama, 'volvió a pedir el código a la red en cada navegación').not.toMatch(/networkFirst/)
  })

  it('⚠ cacheFirst mira UNA caché, no todas', () => {
    /* `caches.match()` recorre todas las cachés del origen, incluidas las
       huérfanas de versiones viejas. ESE era el fallo que hizo apagar la caché
       entera; la respuesta es abrirla por su nombre, no dejar de usarla. */
    const fn = sinNotas.match(/async function cacheFirst[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fn, 'no se encontró cacheFirst').toBeTruthy()
    expect(fn).toMatch(/const cache = await caches\.open\(nombreCache\)/)
    expect(fn).toMatch(/await cache\.match\(request\)/)
    expect(fn, 'volvió la búsqueda en todas las cachés').not.toMatch(/caches\.match\(/)
  })

  it('guarda lo que trae, que antes no lo hacía', () => {
    const fn = sinNotas.match(/async function cacheFirst[\s\S]*?\n\}/)?.[0] ?? ''
    expect(fn).toMatch(/cache\.put\(request, response\.clone\(\)\)/)
  })
})

describe('qué sobrevive a un despliegue y qué no', () => {
  const activate = sinNotas.match(/addEventListener\('activate'[\s\S]*?\n\}\)/)?.[0] ?? ''

  it('⚠ la caché del código SOBREVIVE', () => {
    /* Es lo único que la hace útil: si se borra en cada release, todos los
       usuarios se bajan la app entera otra vez desde Boston. */
    expect(activate, 'no se encontró el activate').toBeTruthy()
    expect(activate).toMatch(/k !== STATIC_CACHE/)
  })

  it('las PÁGINAS y las CIFRAS sí se borran', () => {
    /* Ahí es donde el contenido viejo miente: una pantalla guardada de la
       versión anterior o unas cifras sin los campos nuevos. La caché del código
       no puede mentir porque su nombre lleva su huella. */
    expect(activate).toMatch(/k !== CACHE_NAME/)
    expect(activate).toMatch(/k !== API_CACHE/)
  })

  it('la caché del código se poda para que no crezca sin fin', () => {
    expect(sinNotas).toMatch(/TOPE_ARCHIVOS_EN_CACHE = \d{3,}/)
    expect(sinNotas).toMatch(/async function podarCache/)
    expect(activate, 'la poda no corre al activar').toMatch(/podarCache\(STATIC_CACHE\)/)
    // Se van los más antiguos: `cache.keys()` viene en orden de inserción.
    const poda = sinNotas.match(/async function podarCache[\s\S]*?\n\}/)?.[0] ?? ''
    expect(poda).toMatch(/claves\.slice\(0, sobran\)/)
  })
})

describe('lo que NO cambia', () => {
  it('las peticiones de dinero siguen yendo a la red primero', () => {
    /* Un saldo guardado es un saldo que miente. Este arreglo es solo para el
       código de la app, que no puede cambiar sin cambiar de nombre. */
    expect(sinNotas).toMatch(/networkFirstAPI\(request\)/)
    expect(sinNotas).toMatch(/networkFirstPage\(request\)/)
    expect(sinNotas).toMatch(/NETWORK_ONLY_WHEN_ONLINE/)
  })
})

describe('el modo rápido: apagado, y solo el armazón', () => {
  /* El dueño no puede juzgar esto en el espejo —«el espejo te sirve es a ti»—,
     así que va detrás de un interruptor por dispositivo: lo enciende en su
     teléfono, con su cartera, y nadie más lo tiene encima. */
  const provider = readFileSync(resolve(process.cwd(), 'components/providers/OfflineProvider.jsx'), 'utf8')

  it('nace apagado: sin interruptor, todo sigue igual', () => {
    expect(sinNotas).toMatch(/let modoRapido = null/)
    const lectura = sinNotas.match(/async function modoRapidoActivo[\s\S]*?\n\}/)?.[0] ?? ''
    expect(lectura).toMatch(/modoRapido = false/)
    // La navegación solo cambia de estrategia si el interruptor está puesto.
    expect(sinNotas).toMatch(/rapido \? armazonGuardadoYRefresca\(request\) : networkFirstPage\(request\)/)
  })

  it('⚠ NINGUNA ruta de /api/ cambia de estrategia', () => {
    /* Es la línea que separa «la pantalla aparece antes» de «la pantalla miente
       con plata». Las cifras siguen yendo a la red primero. */
    const armazon = sinNotas.match(/async function armazonGuardadoYRefresca[\s\S]*?\n\}/)?.[0] ?? ''
    expect(armazon, 'no se encontró la estrategia del armazón').toBeTruthy()
    expect(armazon, 'el armazón no puede tocar el API').not.toMatch(/\/api\//)
    // La rama del API sigue siendo la de siempre, sin condicional.
    expect(sinNotas).toMatch(/CACHEABLE_API\.some[\s\S]*?networkFirstAPI\(request\)/)
  })

  it('la primera vez espera a la red, no inventa una pantalla', () => {
    const armazon = sinNotas.match(/async function armazonGuardadoYRefresca[\s\S]*?\n\}/)?.[0] ?? ''
    expect(armazon).toMatch(/if \(guardado\)/)
    expect(armazon).toMatch(/return \(await refresco\) \?\? networkFirstPage\(request\)/)
  })

  it('el ajuste sobrevive a que el worker se duerma y a los despliegues', () => {
    /* Una variable en memoria se pierde cuando el navegador duerme el worker, y
       el ajuste se apagaría solo sin avisar. */
    expect(sinNotas).toMatch(/caches\.open\(AJUSTES_CACHE\)/)
    const activate = sinNotas.match(/addEventListener\('activate'[\s\S]*?\n\}\)/)?.[0] ?? ''
    expect(activate).toMatch(/k !== AJUSTES_CACHE/)
  })

  it('se enciende y se apaga desde el propio teléfono', () => {
    expect(provider).toMatch(/get\('rapido'\)/)
    expect(provider).toMatch(/localStorage\.setItem\('cf-modo-rapido', parametro\)/)
    expect(provider).toMatch(/type: 'MODO_RAPIDO', activo/)
    // Y apagarlo tiene que ser tan fácil como encenderlo.
    expect(provider).toMatch(/parametro === '1' \|\| parametro === '0'/)
  })
})
