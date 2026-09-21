/* LA BARRA QUE SE TOCA Y EL ICONO DE LA NOTIFICACIÓN — 20 sep 2026.
 *
 * Dos cosas que el dueño reportó el mismo domingo, con fotos:
 *
 * 1. «Le doy a las barritas del recaudado y no muestra nada; eso funcionaba».
 *    La frase del día tocado se había metido DENTRO de `cumplieron != null`, y
 *    `cumplieron` es null cuando hoy no toca cobrar. En domingo el recuadro de
 *    selección aparecía y no salía texto. Es la TERCERA vez que esta gráfica
 *    pierde la función de tocarla (antes: `<button>` → `<span>` con `title`).
 *
 * 2. «En la notificación sale un círculo blanco, y en la barra de arriba un
 *    cuadrito blanco». El `icon` era un SVG —Chrome en Android no lo pinta— y
 *    el `badge` era el logo cuadrado opaco, que Android usa de máscara alfa: un
 *    cuadrado lleno da un cuadrado blanco. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { altoDeBarra, alturaDeLaLinea, topeDeLaEscala } from '@/lib/semana-de-cobros'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')

describe('la barra tocada habla aunque hoy no toque cobrar', () => {
  const panel = leer('components/pantallas/Panel.jsx')
  /* La gráfica se mudó a un componente que comparten el Inicio y el resumen del
     día: el dueño comparó las dos pantallas y pidió que se vieran igual. */
  const semana = leer('components/cf/SemanaDeCobros.jsx')

  it('el detalle del día NO cuelga de que hoy haya meta', () => {
    /* La causa del reporte: la frase vivía dentro de `{cumplieron != null && …}`
       y `cumplieron` es null en domingo. Ahora el detalle depende solo de que
       haya un día elegido, y el pie —que sí habla de la meta— se adapta. */
    expect(semana).toContain('{dia && (')
    expect(semana).toContain('const dia = iDia != null ? dias[iDia] : null')
    expect(panel).not.toMatch(/\{cumplieron != null && \(\s*\n\s*<p/)
    // El pie del Inicio dice algo en los dos casos, con meta y sin ella.
    expect(panel).toMatch(/cumplieron != null\s*\n?\s*\? \(cumplieron === 0/)
    expect(panel).toMatch(/Toca una barra para ver ese día/)
  })

  it('las barras siguen siendo botones: un `title` no se toca con el dedo', () => {
    const i = semana.indexOf('{dias.map((x, i) => {')
    expect(i).toBeGreaterThan(-1)
    const bloque = semana.slice(i, i + 1200)
    expect(bloque).toContain('<button')
    expect(bloque).toContain('onClick={() => setElegido(')
    expect(bloque).toContain('aria-label={`${nombreDe(i)}')
  })

  it('y dice en cuántos cobros fue, con el cero por su nombre', () => {
    expect(semana).toContain("dia.cobros === 1 ? 'cobro' : 'cobros'")
    expect(semana).toContain('No entró plata ese día.')
  })

  it('el promedio es UNO, el mismo que ve en el resumen del día', () => {
    /* Llegué a calcularlo aquí sobre los días CON cobro mientras el resumen lo
       sacaba sobre los siete: el mismo martes habría salido «por encima» en una
       pantalla y «por debajo» en la otra. */
    expect(semana).toContain('promedioDeLaSemana(montos)')
    expect(leer('lib/resumen-del-dia.js')).toContain('export function promedioDeLaSemana')
    expect(leer('lib/resumen-del-dia.js')).toContain('promedioSemana: promedioDeLaSemana(semana)')
  })

  it('y el dato viaja: el API lo manda y el adaptador lo pasa', () => {
    const api = leer('app/api/dashboard/resumen/route.js')
    const i = api.indexOf('sparkline7d,')
    expect(api.slice(i, i + 500)).toContain('cobros7d,')
    expect(leer('lib/adaptadores/panel.js')).toContain('cobrosSemana:')
  })
})

describe('el icono de la notificación', () => {
  const sw = leer('public/sw.js')
  const push = leer('lib/push.js')

  it('nunca es un SVG: Chrome en Android no lo pinta y deja el hueco', () => {
    for (const m of sw.match(/icon: [^,\n]+/g) ?? []) expect(m, m).not.toContain('.svg')
    for (const m of push.match(/icon: [^,\n]+/g) ?? []) expect(m, m).not.toContain('.svg')
    expect(push).toContain("icon: payload.icon || '/icons/icon-192.png'")
  })

  it('el badge es la silueta, no el logo cuadrado (Android lo usa de máscara)', () => {
    expect(sw.match(/badge: '\/icons\/badge-96\.png'/g)).toHaveLength(2)
    expect(sw).not.toContain("badge: '/icons/icon-192.png'")
  })

  it('el badge existe, es PNG y está casi todo transparente', () => {
    const f = path.join(process.cwd(), 'public/icons/badge-96.png')
    expect(fs.existsSync(f)).toBe(true)
    const buf = fs.readFileSync(f)
    expect(buf.subarray(1, 4).toString()).toBe('PNG')
    // IHDR: ancho, alto y tipo de color (6 = RGBA, con canal alfa).
    expect(buf.readUInt32BE(16)).toBe(96)
    expect(buf.readUInt32BE(20)).toBe(96)
    expect(buf[25]).toBe(6)
  })

  it('y el service worker lo cachea, o el primer aviso sin señal se queda sin él', () => {
    expect(sw).toContain("'/icons/badge-96.png',")
  })
})

describe('el gráfico y su frase cuentan la MISMA historia', () => {
  /* La adenda: «si dice 3 de 7, tiene que haber exactamente 3 barras por encima
     de la línea». Con números, que es como se caza: el caso real del espejo
     —meta de $15.000 contra una semana de $1,2M— dibujaba SIETE barras por
     encima mientras la frase decía dos. */
  const cuantasPorEncima = (montos, meta, altoBarra = 104) => {
    const tope = topeDeLaEscala(montos, meta)
    const linea = alturaDeLaLinea({ meta, tope, altoBarra })
    return montos.filter((m) => altoDeBarra({ monto: m, meta, tope, altoBarra }) > linea).length
  }

  const casos = [
    { nombre: 'el caso medido: meta diminuta y semana grande', montos: [1195000, 1243000, 0, 0, 0, 0, 0], meta: 15000 },
    { nombre: 'nadie llega', montos: [10000, 20000, 0, 5000, 0, 0, 1000], meta: 500000 },
    { nombre: 'todos llegan', montos: [90000, 80000, 120000, 70000, 95000, 88000, 91000], meta: 50000 },
    { nombre: 'la mitad', montos: [90000, 10000, 120000, 0, 95000, 0, 30000], meta: 50000 },
    { nombre: 'justo en la meta', montos: [50000, 49999, 50001, 0, 0, 0, 0], meta: 50000 },
    { nombre: 'una semana entera en cero', montos: [0, 0, 0, 0, 0, 0, 0], meta: 40000 },
  ]

  for (const c of casos) {
    it(c.nombre, () => {
      const dice = c.montos.filter((m) => m >= c.meta).length
      expect(cuantasPorEncima(c.montos, c.meta), `dibuja ${cuantasPorEncima(c.montos, c.meta)} barras por encima y la frase dice ${dice}`).toBe(dice)
    })
  }

  it('y el día vacío se sigue viendo: nunca desaparece del todo', () => {
    for (const meta of [null, 15000, 500000]) {
      const tope = topeDeLaEscala([1243000, 0], meta)
      expect(altoDeBarra({ monto: 0, meta, tope, altoBarra: 104 })).toBeGreaterThanOrEqual(3)
    }
  })

  it('sin meta no hay línea, y las barras miden lo suyo', () => {
    expect(alturaDeLaLinea({ meta: null, tope: 100, altoBarra: 104 })).toBe(null)
    expect(altoDeBarra({ monto: 50, meta: null, tope: 100, altoBarra: 104 })).toBe(52)
  })
})
