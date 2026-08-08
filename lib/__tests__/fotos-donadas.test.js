import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { campanaViva, faltan, META_FOTOS, CIERRA_EN, carpetaDonadas } from '@/lib/fotos-donadas'

// ── PEDIRLE LAS FOTOS A QUIEN LAS TIENE ─────────────────────────────────────
//
// El lector de cartulinas se construyó SIN UNA SOLA FOTO REAL —no había— y por
// eso se instrumentó para medirse solo. Esto es el otro lado: una campaña de
// fin de semana para que quien tiene el cuaderno nos deje verlo.
//
// El dueño lo planteó como novedad y él mismo se corrigió: una novedad se
// cierra y después no se encuentra. Va de banner, y se retira solo.
//
// Lo que fija esta prueba no es el diseño: es lo que NO se le puede prometer a
// nadie sobre las fotos de sus clientes.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
/* ⚠ SIN COMENTARIOS: las notas de estos archivos nombran lo prohibido para
   poder explicarlo. Una prueba sobre el texto entero se acusaría a sí misma. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const api = leer('app/api/fotos-donadas/route.js')
const banner = leer('components/dashboard/BannerFotosDonadas.jsx')
const lib = leer('lib/fotos-donadas.js')
const panel = leer('app/(dashboard)/dashboard/page.jsx')

describe('la campaña se retira sola', () => {
  const antes = new Date('2026-08-08T15:00:00Z')

  it('viva mientras falten fotos y no haya pasado la fecha', () => {
    expect(campanaViva(0, antes)).toBe(true)
    expect(campanaViva(39, antes)).toBe(true)
  })

  it('⚠ cierra al llegar a la meta AUNQUE sobre tiempo', () => {
    /* Es la mitad del porqué de cerrar por cantidad: un banner que ya no
       necesita nada sigue ocupando el panel que el cobrador abre cada mañana. */
    expect(campanaViva(META_FOTOS, antes)).toBe(false)
    expect(campanaViva(150, antes)).toBe(false)
  })

  it('y cierra por fecha aunque falten fotos', () => {
    expect(campanaViva(3, new Date('2026-08-12T10:00:00Z'))).toBe(false)
  })

  it('⚠ el corte es el martes a las 04:59Z, que es el lunes a medianoche en Colombia', () => {
    /* El día colombiano va de 05:00Z a 05:00Z y el servidor corre en UTC.
       Escrito como `2026-08-10T23:59` se habría cerrado el lunes a las 6 de la
       tarde hora de Bogotá — justo a la hora de cuadrar. */
    expect(CIERRA_EN.toISOString()).toBe('2026-08-11T04:59:59.000Z')
    expect(campanaViva(0, new Date('2026-08-11T04:00:00Z'))).toBe(true)
    expect(campanaViva(0, new Date('2026-08-11T05:00:00Z'))).toBe(false)
  })

  it('lo que falta nunca es negativo', () => {
    expect(faltan(0)).toBe(META_FOTOS)
    expect(faltan(60)).toBe(0)
  })
})

describe('⚠ dónde NO van las fotos', () => {
  it('fuera de public/, que se sirve sin sesión', () => {
    /* Comprobado contra producción el 7 ago 2026:
         GET /uploads/firmas/<org>/<hash>.png     → 200 SIN sesión
         GET /api/uploads/firmas/<org>/<hash>.png → 401
       El API con permisos existe; la ruta estática lo rodea. Para las firmas
       eso ya viene de antes; para cartulinas ajenas no se repite. */
    expect(carpetaDonadas()).not.toMatch(/public/)
    expect(api).not.toMatch(/'public'/)
    expect(lib).toMatch(/FOTOS_DONADAS_DIR/)
  })

  it('y la carpeta local está fuera de git', () => {
    expect(leer('.gitignore')).toMatch(/\.fotos-donadas/)
  })

  it('la foto se guarda entera, sin encoger', () => {
    /* La foto de cliente pasa por `sharp` a 400×400 porque es un avatar. Aquí
       encoger es destruir la prueba: lo que se va a medir es si el lector
       distingue un «3» de un «8» escritos a lápiz. */
    // Y por quinta vez: sin comentarios, que la nota del API nombra `sharp`
    // justo para explicar por qué NO se usa.
    expect(sinNotas(api)).not.toMatch(/sharp/)
    expect(sinNotas(api)).not.toMatch(/resize/)
  })
})

describe('⚠ lo que no se le puede prometer a nadie', () => {
  it('en ningún texto se dice que las fotos son anónimas', () => {
    /* Sería mentira. Una cartulina lleva nombre, cédula, dirección y la deuda
       de gente que no está en esta conversación y no dio permiso — dato
       personal de terceros, Ley 1581 de 2012.
       La idea del dueño era buena; esta palabra era lo único que había que
       cambiarle. */
    for (const [nombre, src] of [['banner', banner], ['lib', lib], ['api', api]]) {
      expect(sinNotas(src), `${nombre} promete anonimato`).not.toMatch(/anónim|anonim/i)
    }
  })

  it('se le dice ANTES de elegir fotos que llevan los datos de sus clientes', () => {
    expect(banner).toMatch(/datos de tus clientes/)
    const avisoAntes = banner.indexOf('datos de tus clientes')
    /* ⚠ ANCLADO AL `input`, NO AL RÓTULO. Estaba anclado a «Elegir fotos» y al
       renombrar el botón a «De la galería» la prueba falló por el nombre, no por
       el orden. El `input` de archivo es lo que de verdad no puede ir antes del
       aviso: es el momento en que la persona elige. */
    const eligeDespues = banner.indexOf("type=\"file\"")
    expect(avisoAntes).toBeGreaterThan(-1)
    expect(eligeDespues).toBeGreaterThan(-1)
    expect(avisoAntes, 'el aviso va antes del selector, no en letra chica debajo').toBeLessThan(eligeDespues)
  })

  it('se le ofrece tapar la cédula, y se dice que no hace falta', () => {
    // El sistema ya trabaja con 1.683 clientes cuya cédula es `SIN-…`.
    expect(banner).toMatch(/tapa la cédula/i)
    expect(banner).toMatch(/No la necesitamos/i)
  })

  it('se dice que se borran, y cuándo', () => {
    expect(banner).toMatch(/Se borran/i)
    expect(banner).toMatch(/31 de agosto/)
  })

  it('y que es voluntario', () => {
    expect(banner).toMatch(/voluntario/i)
  })
})

describe('el banner en el panel', () => {
  it('va DESPUÉS del onboarding', () => {
    /* Quien está configurando la cuenta tiene una tarea a medias; pedirle un
       favor por encima de ella le cambia el orden a lo suyo. */
    expect(panel.indexOf('CobradorOnboarding')).toBeLessThan(panel.indexOf('<BannerFotosDonadas'))
  })

  it('solo al dueño', () => {
    /* El cuaderno es suyo y es quien puede decidir compartir los datos de sus
       clientes. Un cobrador no toma esa decisión por él. */
    expect(panel).toMatch(/\{esOwner && <BannerFotosDonadas \/>\}/)
  })

  it('⚠ no es otra franja ámbar', () => {
    /* El propio panel lo tiene escrito: «cuatro franjas ámbar no son cuatro
       avisos, son una pared». Esto no es una alerta —no se pierde un peso por
       ignorarlo— así que la tarjeta va en papel con borde. El ámbar se queda
       para el botón. */
    expect(banner).toMatch(/background: 'var\(--cf-card\)'/)
  })

  it('y no se cae la pantalla si su cuenta falla', () => {
    // Es un banner de tres días; no puede llevarse por delante el panel con el
    // que se cobra.
    expect(api).toMatch(/viva: false, recogidas: 0/)
  })
})

describe('los límites de una subida', () => {
  it('el endpoint tiene presupuesto de tiempo largo', () => {
    /* Diez fotos de teléfono por una red móvil de barrio no caben en los 8 s
       del presupuesto normal: se abortaría igual que se abortaba la lectura de
       cartulinas, con el mismo «signal is aborted without reason». */
    expect(leer('lib/fetch-timeout.js')).toMatch(/api\/fotos-donadas/)
  })

  it('se comprueban los primeros bytes, no la extensión', () => {
    expect(api).toMatch(/esImagenDeVerdad/)
  })

  it('una foto mala no tumba el envío entero', () => {
    // Mismo criterio que el lote de cartulinas: se rechaza esa y siguen las
    // demás, diciendo cuál y por qué.
    expect(api).toMatch(/rechazadas\.push/)
    expect(api).toMatch(/continue/)
  })
})
