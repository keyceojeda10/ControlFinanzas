import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── SEIS COSAS REPORTADAS CON CAPTURA ───────────────────────────────────────
// Todas medidas en el espejo antes de tocar nada.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const fichaCliente = leer('app/(dashboard)/clientes/[id]/page.jsx')
const heroCard = leer('components/clientes/ClienteHeroCard.jsx')
const lucas = leer('components/clientes/LucasSugiere.jsx')
const vistas = leer('components/prestamos/PrestamoDetalleViews.jsx')
const caja = leer('app/(dashboard)/caja/page.jsx')

describe('1 · el icono de Lucas, centrado en su cuadro', () => {
  it('el dibujo se baja para que coincida con el centro del lienzo', () => {
    // El trazado va de y=2 a y=18: su centro visual es y=10, no y=12.
    // `alignItems: center` centra la CAJA del svg, no el dibujo de dentro.
    expect(lucas).toMatch(/<g transform="translate\(0 2\)">/)
  })
})

describe('2 · Lucas se puede cerrar cuando solo avisa', () => {
  it('la ✕ sale si NO hay botones que pulsar', () => {
    expect(lucas).toMatch(/const sePuedeCerrar = !esOferta && !!claveCierre/)
  })

  it('con oferta NO sale: ahí hay una decisión que tomar', () => {
    // El bloque perdió su ✕ a propósito al rediseñarse: una decisión con monto
    // y botón no se cierra, se toma. Solo vuelve cuando no hay nada que hacer.
    const bloque = lucas.slice(lucas.indexOf('const sePuedeCerrar'))
    expect(bloque.slice(0, 400)).not.toMatch(/sePuedeCerrar = true/)
  })

  it('recuerda el cierre por el TITULAR, no un simple «cerrado»', () => {
    // Si la situación del cliente cambia, el aviso nuevo vuelve a salir en vez
    // de quedarse mudo. Mismo patrón que `AiTipBanner`.
    expect(lucas).toMatch(/sessionStorage\.setItem\(`lucas-cerrado-\$\{claveCierre\}`, titular\)/)
    expect(fichaCliente).toMatch(/claveCierre=\{id\}/)
  })
})

describe('3 · el aviso del mapa no miente', () => {
  it('con coordenadas GPS NO se avisa de que falta el número', () => {
    /* `direccionIncompleta` solo lee el TEXTO. Medido en producción: 353 de
       400 clientes con GPS recibían «sin número no sale en el mapa» siendo
       falso — el botón «Ir» los llevaba sin problema. */
    expect(heroCard).toMatch(/const tieneGps = cliente\?\.latitud != null && cliente\?\.longitud != null/)
    expect(heroCard).toMatch(/const falta = dir && !tieneGps \? direccionIncompleta\(dir\) : false/)
  })

  it('y deja de ir pegado al renglón de arriba', () => {
    expect(heroCard).toMatch(/padding: '12px 14px'/)
  })
})

describe('4 · un solo «Enviar por WhatsApp» en la ficha del cliente', () => {
  it('el botón verde suelto se fue', () => {
    // Medido: dos botones a 123px uno del otro, más el círculo de la tarjeta.
    // El suelto existía porque la lista quedaba tapada por la barra flotante;
    // ese motivo ya no se cumple.
    const codigo = fichaCliente
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect((codigo.match(/Enviar por WhatsApp/g) ?? []).length,
      'volvió a haber más de un «Enviar por WhatsApp»').toBe(1)
  })
})

describe('5 · «Cómo va» se lee mejor', () => {
  it('las cuotas van en su renglón, no apretadas entre las fechas', () => {
    // Primero las puse en medio de la fila inicio/vencimiento y quedaban
    // aplastadas contra las dos.
    expect(vistas).toMatch(/text-\[12px\] mt-4 text-center/)
  })

  it('y las frases se separan con una raya', () => {
    expect(vistas).toMatch(/mt-3 pt-3 leading-snug/)
  })
})

describe('6 · la caja no se queda angosta en ventana media', () => {
  it('hay un escalón en md: entre 672 y 1024', () => {
    /* Iba de `max-w-2xl` (672) directo a `lg:max-w-5xl`, y `lg:` no entra
       hasta los 1024 de ventana. Medido en el espejo: a 768 sobraban 130px a
       los lados y a 900 sobraban 262. Con el escalón, a 768 sobran 74 — el
       margen normal. */
    expect(caja).toMatch(/max-w-2xl md:max-w-3xl lg:max-w-5xl/)
  })
})

describe('extra · «Sin historial» no ocupa sitio', () => {
  it('el score gris no se pinta', () => {
    // Una pastilla con «?» que no responde ninguna pregunta. Los tres estados
    // que sí avisan de algo siguen saliendo.
    const score = leer('components/clientes/ScoreCrediticio.jsx')
    expect(score).toMatch(/data\.score === 'gris'\) return null/)
  })
})
