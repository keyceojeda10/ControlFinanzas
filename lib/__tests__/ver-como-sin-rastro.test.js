import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { marcarSoloLectura, estaEnSoloLectura, MENSAJE_EN_VISTA } from '@/lib/modo-vista'
import {
  sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones,
  guardarPagoPendiente, guardarOrdenPendiente, guardarClientePendiente, guardarPrestamoPendiente, encolarMutacion,
} from '@/lib/offline'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')
function almacen() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
afterEach(() => vi.unstubAllGlobals())

describe('la marca de solo lectura del teléfono', () => {
  it('se enciende y se apaga, y sin almacenamiento dice que no', () => {
    vi.stubGlobal('localStorage', almacen())
    expect(estaEnSoloLectura()).toBe(false)
    marcarSoloLectura(true)
    expect(estaEnSoloLectura()).toBe(true)
    marcarSoloLectura(false)
    expect(estaEnSoloLectura()).toBe(false)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } })
    expect(estaEnSoloLectura()).toBe(false)
    expect(() => marcarSoloLectura(true)).not.toThrow()
  })

  it('en vista, NINGUNA de las cuatro sincronizaciones sube nada con la sesión del cobrador', async () => {
    vi.stubGlobal('localStorage', almacen())
    vi.stubGlobal('navigator', { onLine: true })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    marcarSoloLectura(true)
    for (const sincronizar of [sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones]) {
      expect(await sincronizar()).toEqual({ synced: 0, failed: 0 })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('en vista, las cinco funciones que ENCOLAN una escritura rechazan sin tocar IndexedDB, y marcan el error como de vista', async () => {
    vi.stubGlobal('localStorage', almacen())
    const indexedDBEspia = { open: vi.fn() }
    vi.stubGlobal('indexedDB', indexedDBEspia)
    marcarSoloLectura(true)

    for (const promesa of [
      guardarPagoPendiente({}),
      guardarOrdenPendiente('ruta1', []),
      guardarClientePendiente({}),
      guardarPrestamoPendiente({}),
      encolarMutacion({ tipo: 'cliente.update', entityId: 'c1', payload: {} }),
    ]) {
      // No basta con el texto: las pantallas que llaman a estas funciones
      // solo enseñan err.message cuando además trae `soloLectura: true` (así
      // no confunden esto con un fallo real de IndexedDB). Ver ronda 2.
      await expect(promesa).rejects.toMatchObject({ message: MENSAJE_EN_VISTA, soloLectura: true })
    }

    // Ninguna llegó a abrir la base: nada se escribió en el teléfono.
    expect(indexedDBEspia.open).not.toHaveBeenCalled()
  })
})

describe('la carrera al entrar en vista a mitad de una subida', () => {
  // Reproducir de verdad las cuatro subidas (openDB con transacciones reales,
  // fetch por lote) exige una IndexedDB de mentira completa — este repo no
  // trae `fake-indexeddb` y ninguna otra prueba de lib/offline.js la monta;
  // todas anclan en código (ver salir-no-deja-datos-del-anterior.test.js y
  // pagos-sin-senal.test.js). Se ancla igual aquí: la guarda tiene que ser la
  // PRIMERA línea de código dentro del `for`, antes del `try` que hace fetch,
  // así que un `marcarSoloLectura(true)` a mitad de la vuelta anterior corta
  // ANTES del siguiente envío, sin marcar nada como fallido.
  const offline = src('lib/offline.js')

  function primeraLineaDelBucle(marcaFor) {
    const i = offline.indexOf(marcaFor)
    if (i < 0) return null
    const cuerpo = offline.slice(i + marcaFor.length)
    for (const linea of cuerpo.split('\n')) {
      const t = linea.trim()
      if (t === '' || t.startsWith('//')) continue
      return t
    }
    return null
  }

  it('sincronizarPagos corta antes del siguiente fetch', () => {
    expect(primeraLineaDelBucle('for (const pago of pendientes) {\n')).toBe('if (estaEnSoloLectura()) break')
  })
  it('sincronizarOrdenes corta antes del siguiente fetch', () => {
    expect(primeraLineaDelBucle('for (const entry of entries) {\n')).toBe('if (estaEnSoloLectura()) break')
  })
  it('sincronizarMutaciones corta antes del siguiente fetch — aquí una 4xx no tiene reintento automático', () => {
    expect(primeraLineaDelBucle('for (const m of pendientes) {\n')).toBe('if (estaEnSoloLectura()) break')
  })
  it('sincronizarCreaciones corta en las DOS vueltas (clientes y préstamos) — 4xx tampoco reintenta sola', () => {
    expect(primeraLineaDelBucle('for (const c of clientesPend) {\n')).toBe('if (estaEnSoloLectura()) break')
    expect(primeraLineaDelBucle('for (const p of prestamosPend) {\n')).toBe('if (estaEnSoloLectura()) break')
  })
})

describe('el mensaje de vista no tapa un error real (ronda 2)', () => {
  // Con la ronda 1, las ~21 pantallas que encolan mostraban `err?.message`
  // SIEMPRE que existiera — así que un fallo de IndexedDB de verdad (p. ej.
  // QuotaExceededError en un Android barato) le enseñaba el texto crudo del
  // navegador a CUALQUIER cobrador, no solo al dueño en vista. Cada sitio
  // tiene que decidir por `soloLectura` (el flag que pone
  // lib/modo-vista.js#errorEnVista), no por si el mensaje viene o no vacío.
  // Un representante por fichero basta — todos siguen el mismo patrón.
  const sitios = {
    'app/(dashboard)/cobros-hoy/page.jsx':      /e\?\.soloLectura \? e\.message : 'No se pudo guardar el pago\. Intenta de nuevo\.'/,
    'app/(dashboard)/prestamos/nuevo/page.jsx': /err\?\.soloLectura \? err\.message : 'No se pudo guardar offline\.'/,
    'app/(dashboard)/rutas/[id]/page.jsx':      /e\?\.soloLectura \? e\.message : 'No se pudo guardar el pago\. Intenta de nuevo\.'/,
    'components/clientes/ClienteForm.jsx':      /err\?\.soloLectura \? err\.message : 'No se pudo guardar offline\.'/,
    'components/gastos/ReportarGasto.jsx':      /e\?\.soloLectura \? e\.message : 'No se pudo guardar offline\.'/,
    'components/prestamos/EditarDiaCobro.jsx':  /err\?\.soloLectura \? err\.message : 'No se pudo guardar offline\.'/,
    'components/prestamos/ModificarPlazo.jsx':  /e\?\.soloLectura \? e\.message : 'No se pudo guardar offline\.'/,
    'components/prestamos/RegistrarPago.jsx':   /err\?\.soloLectura \? err\.message : 'No se pudo guardar el pago offline\.'/,
  }
  for (const [fichero, patron] of Object.entries(sitios)) {
    it(`${fichero} branchea por soloLectura, no por err?.message a secas`, () => {
      expect(src(fichero)).toMatch(patron)
    })
  }

  it('lib/modo-vista.js marca el error con soloLectura, y offline.js lo usa en las cinco', () => {
    const modoVista = src('lib/modo-vista.js')
    expect(modoVista).toMatch(/err\.soloLectura = true/)
    const offline = src('lib/offline.js')
    const veces = offline.match(/throw errorEnVista\(\)/g) ?? []
    expect(veces.length).toBe(5)
  })
})

describe('sin rastro en el cobrador', () => {
  const offline = src('lib/offline.js')
  it('en vista no se guarda nada para uso sin conexión ni se descarga la cartera', () => {
    expect(offline).toMatch(/export async function guardarEnCache\(key, data\) \{\n\s+if \(estaEnSoloLectura\(\)\) return/)
    expect(offline).toMatch(/export async function sincronizarTodo\(onProgress\) \{\n\s+if \(estaEnSoloLectura\(\)\) return \{ clientes: 0, prestamos: 0, rutas: 0, syncedAt: null \}/)
  })
  it('el ping de sesión y las notificaciones no corren en vista', () => {
    expect(src('components/providers/SesionTracker.jsx')).toMatch(/if \(session\.user\.soloLectura\) return/)
    expect(src('lib/push-cliente.js')).toMatch(/export async function activarPush\(\) \{\n\s+if \(estaEnSoloLectura\(\)\) return 'apagado'/)
  })
  it('al cambiar de identidad se tiran las lecturas y la sesión guardada, NO los cobros pendientes', () => {
    const c = src('lib/cambio-de-cuenta.js')
    expect(c).toMatch(/postMessage\(\{ type: 'CLEAR_API_CACHE' \}\)/)
    expect(c).toMatch(/await borrarCacheDeLecturas\(\)/)
    expect(c).toMatch(/localStorage\.removeItem\(CLAVE_SESION_GUARDADA\)/)
    expect(c).not.toMatch(/limpiarDatosOffline/)
    // La clave tiene que ser la MISMA que usa el SessionProvider.
    const clave = c.match(/const CLAVE_SESION_GUARDADA = '([^']+)'/)[1]
    expect(src('components/providers/SessionProvider.jsx')).toContain(`const STORAGE_KEY = '${clave}'`)
  })
})

describe('la entrada y la salida', () => {
  it('el botón y la franja usan el pase', () => {
    expect(src('components/cobradores/BotonVerComo.jsx')).toMatch(/signIn\('pase', \{ pase: d\.pase, redirect: false \}\)/)
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/ver-como\/volver', \{ method: 'POST' \}\)/)
    expect(src('app/(dashboard)/layout.jsx')).toMatch(/<FranjaVerComo \/>/)
  })
  it('a la hora, la franja reescribe la cookie y solo sale si la sesión nueva ya no es de vista (sin bucles)', () => {
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/auth\/session'\)/)
    expect(franja).toMatch(/if \(nueva\?\.user && !nueva\.user\.soloLectura\) return salir\(cobradorId\)/)
  })
})

describe('Tarea final ítem 1: el retorno automático reintenta', () => {
  // Un solo intento a vistaHasta+1s dejaba al dueño en solo lectura para
  // siempre si el teléfono no tenía red justo en ese instante, o si su reloj
  // iba adelantado y el servidor todavía no había cerrado la vista.
  const franja = src('components/armazon/FranjaVerComo.jsx')

  it('el primer intento espera vistaHasta + 5000, no + 1000', () => {
    expect(franja).toMatch(/const MARGEN_RELOJ_MS = 5_000/)
    expect(franja).toMatch(/\}, Math\.max\(0, vistaHasta \+ MARGEN_RELOJ_MS - Date\.now\(\)\)\)/)
  })

  it('reintenta cada ~45s, sin tope, hasta que vuelva o se desmonte', () => {
    expect(franja).toMatch(/const REINTENTO_MS = 45_000/)
    expect(franja).toMatch(/intervalId = setInterval\(intentar, REINTENTO_MS\)/)
    // Se apaga sola en cuanto la sesión nueva ya no está en vista.
    expect(franja).toMatch(/if \(await volverSiYaVencio\(cobradorId\) !== false\) \{\n\s+vivo = false\n\s+if \(intervalId\) clearInterval\(intervalId\)/)
    // Y al desmontar el componente, no sigue tocando el servidor en segundo plano.
    expect(franja).toMatch(/return \(\) => \{\n\s+vivo = false\n\s+clearTimeout\(primerIntento\)\n\s+if \(intervalId\) clearInterval\(intervalId\)\n\s+window\.removeEventListener\('online', intentar\)/)
  })

  it('también reintenta al volver la señal (evento online)', () => {
    expect(franja).toMatch(/window\.addEventListener\('online', intentar\)/)
  })
})

describe('Tarea final ítem 1: «Volver a mi cuenta» muestra el error real del pase', () => {
  const franja = src('components/armazon/FranjaVerComo.jsx')

  it('VERIFY_EMAIL se traduce a copy legible, no se enseña crudo', () => {
    expect(franja).toMatch(/if \(msg === 'VERIFY_EMAIL'\) return 'Tu correo no está verificado\. Entra con tu correo y contraseña para verificarlo\.'/)
  })

  it('un código interno de NextAuth cae al genérico, y cualquier otro mensaje real se enseña tal cual', () => {
    expect(franja).toMatch(/if \(!msg \|\| CODIGOS_NEXTAUTH_INTERNOS\.has\(msg\) \|\| !msg\.includes\(' '\)\) return MENSAJE_NO_VOLVIO/)
    expect(franja).toMatch(/return msg\n\}/)
  })

  it('volver() usa textoDelError en vez del genérico fijo de antes', () => {
    expect(franja).toMatch(/if \(!r\?\.error\) return salir\(d\.cobradorId\)\n\s+setVolviendo\(false\)\n\s+setError\(textoDelError\(r\.error\)\)/)
  })
})

describe('Tarea final ítem 2: sin GPS en modo vista', () => {
  it('la guarda de watchPosition también corta cuando la sesión es de solo lectura, no solo por esCobrador', () => {
    // En «ver como» esCobrador es true (es la sesión del cobrador): sin esta
    // guarda, el teléfono del DUEÑO pedía permiso de ubicación y POSTeaba a
    // /api/ubicacion, que el portero de solo lectura rechaza con 403.
    const ubi = src('components/providers/UbicacionProvider.jsx')
    expect(ubi).toMatch(/const soloLectura = !!session\?\.user\?\.soloLectura/)
    expect(ubi).toMatch(/if \(loading \|\| !esCobrador \|\| soloLectura\) return/)
  })
})

describe('Tarea final ítem 4: sin salto de hidratación (React #418) en la franja', () => {
  it('la franja solo pinta tras montar; el primer render del cliente coincide con el del servidor (null)', () => {
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/const \[montado, setMontado\] = useState\(false\)/)
    expect(franja).toMatch(/useEffect\(\(\) => \{ setMontado\(true\) \}, \[\]\)/)
    expect(franja).toMatch(/if \(!montado \|\| !enVista\) return null/)
  })

  it('el temporizador de retorno no depende del render: se agenda en su propio efecto, antes del `if` que corta el pintado', () => {
    const franja = src('components/armazon/FranjaVerComo.jsx')
    const iMontado = franja.indexOf('useEffect(() => { setMontado(true) }, [])')
    const iTemporizador = franja.indexOf("if (!enVista || !vistaHasta) return")
    const iCorte = franja.indexOf('if (!montado || !enVista) return null')
    expect(iMontado).toBeGreaterThan(-1)
    expect(iTemporizador).toBeGreaterThan(iMontado)
    expect(iCorte).toBeGreaterThan(iTemporizador)
  })
})

describe('Tarea final ítem 8: la Background Sync no falla lo pendiente por una vista viva', () => {
  const sw = src('public/sw.js')
  const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const codigo = sinComentarios(sw)

  it('syncMutacionesFromSW: un 403 con soloLectura se deja pendiente, sin marcar fallo ni sumar intento', () => {
    const i = codigo.indexOf('async function syncMutacionesFromSW')
    expect(i).toBeGreaterThan(-1)
    const bloque = codigo.slice(i, i + 2500)
    expect(bloque).toMatch(/if \(res\.status === 403 && cuerpo\?\.soloLectura\) \{\s*continue\s*\}/)
  })

  it('syncPagosFromSW: la misma regla, antes de la clasificación reintentable/no-reintentable', () => {
    const i = codigo.indexOf('async function syncPagosFromSW')
    expect(i).toBeGreaterThan(-1)
    const bloque = codigo.slice(i, i + 2500)
    const iGuarda = bloque.search(/if \(res\.status === 403 && cuerpo\?\.soloLectura\) \{\s*continue\s*\}/)
    const iReintentable = bloque.indexOf('const reintentable =')
    expect(iGuarda).toBeGreaterThan(-1)
    expect(iGuarda).toBeLessThan(iReintentable)
  })

  it('CACHE_NAME no se tocó aquí (sube en el release, no en este arreglo)', () => {
    expect(sw).toMatch(/const CACHE_NAME\s*=/)
  })
})
