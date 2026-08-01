// La tarjeta, como la define el paquete de diseño.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// `03-COMPONENTES.md · 1 · Tarjeta estándar` — «la pieza más usada del sistema»:
//
//     background: #FFFFFF;
//     border: 1px solid rgba(20,20,28,.08);
//     border-radius: 18px;
//     padding: 16px 19px;
//     display: flex; flex-direction: column; gap: 12px;
//
// Y la frase que decide todo lo demás, literal:
//
//     «SIN SOMBRA. La separación la da el borde de 1px sobre el fondo hueso.
//      Solo llevan sombra los elementos que de verdad flotan (hojas, modales,
//      tarjetas sobre un mapa).»
//
// De degradados no dice nada — ni `03-COMPONENTES.md`, ni `01-TOKENS.md`, ni
// `04-CRITERIOS.md` los mencionan una sola vez. El degradado teñido de las
// tarjetas viejas es invención del código anterior, no del diseño.
//
// ── QUE MIDE ESTA PRUEBA ──────────────────────────────────────────────────
//
// El dueño preguntó por qué el panel se ve como la versión antigua aunque los
// colores sean los nuevos. Medido, la respuesta era la superficie:
//
//     el rediseño   radio 18 · borde 1px · SIN sombra · fondo plano
//     lo anterior   radio 16 · sombra `cf-card-shadow` · degradado a 135°
//                   teñido con el color del KPI · efecto `kpi-lift` al tocar
//
// Los componentes del rediseño están limpios —cero sombras, cero degradados— y
// toda la deriva vive en las páginas que aún no se han tocado. Así que la regla
// es dura donde se construye y un techo que solo puede bajar en el resto.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

function archivos(dirs) {
  const acc = []
  const rec = (dir) => {
    let entradas
    try { entradas = readdirSync(dir) } catch { return }
    for (const nombre of entradas) {
      if (nombre === 'node_modules' || nombre === '.next' || nombre.startsWith('.')) continue
      const ruta = join(dir, nombre)
      if (statSync(ruta).isDirectory()) rec(ruta)
      else if (/\.(js|jsx)$/.test(nombre) && !/\.test\.jsx?$/.test(nombre)) acc.push(ruta)
    }
  }
  for (const d of dirs) rec(join(RAIZ, d))
  return acc
}

const sinComentarios = (t) => t.split('\n').filter((l) => {
  const s = l.trimStart()
  return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*') && !s.startsWith('{/*')
}).join('\n')

/** Donde se construye el rediseño. Aquí la regla no admite excepciones. */
const REDISENO = ['components/pantallas', 'components/cf', 'components/armazon']

/** Toda la interfaz, para el techo. */
const TODO = ['app', 'components']

const cuenta = (dirs, patron) => {
  let n = 0
  const donde = []
  for (const ruta of archivos(dirs)) {
    const cuerpo = sinComentarios(readFileSync(ruta, 'utf8'))
    for (const linea of cuerpo.split('\n')) {
      if (patron(linea)) { n++; donde.push(ruta.slice(RAIZ.length + 1)) }
    }
  }
  return { n, donde: [...new Set(donde)] }
}

// Una sombra sobre una tarjeta. Las hojas y los modales SÍ flotan y pueden
// llevarla, pero usan sus propias clases, no la de tarjeta.
const esSombraDeTarjeta = (l) => l.includes('cf-card-shadow')

// Un degradado pintado sobre la superficie de tarjeta. Es exactamente lo que
// hacía `KpiCard`: `linear-gradient(135deg, color-mix(... var(--cf-card)) ...)`.
const esDegradadoDeTarjeta = (l) => l.includes('linear-gradient') && l.includes('cf-card')

describe('donde se construye el rediseño, la receta se cumple entera', () => {
  it('ninguna tarjeta lleva sombra', () => {
    const { donde } = cuenta(REDISENO, esSombraDeTarjeta)
    expect(donde, 'la separación la da el borde de 1px, no una sombra').toEqual([])
  })

  it('ninguna tarjeta lleva un degradado de fondo', () => {
    const { donde } = cuenta(REDISENO, esDegradadoDeTarjeta)
    expect(donde, 'el paquete de diseño no menciona degradados ni una vez').toEqual([])
  })
})

describe('en el resto de la interfaz, el techo solo puede bajar', () => {
  /* Estas 77 son la estética anterior repartida por las páginas que todavía no
     se han rediseñado. No se pueden migrar de golpe —son 30 y pico de archivos
     y cada uno pide su cotejo— pero sí se puede impedir que crezcan.

     Es el mismo criterio que ya se usó para los daños de escritura: el examen
     no es que baje, es que NO SUBA. Cuando una pantalla se rediseñe, se baja el
     número aquí y la prueba lo fija. */
  const TECHO_SOMBRAS = 37
  const TECHO_DEGRADADOS = 40

  it(`no hay más de ${TECHO_SOMBRAS} sombras de tarjeta`, () => {
    const { n, donde } = cuenta(TODO, esSombraDeTarjeta)
    expect(n, `subió a ${n}; están en ${donde.length} archivos`).toBeLessThanOrEqual(TECHO_SOMBRAS)
  })

  it(`no hay más de ${TECHO_DEGRADADOS} degradados de tarjeta`, () => {
    const { n, donde } = cuenta(TODO, esDegradadoDeTarjeta)
    expect(n, `subió a ${n}; están en ${donde.length} archivos`).toBeLessThanOrEqual(TECHO_DEGRADADOS)
  })

  it('y si alguien los quita, que se entere y baje el techo', () => {
    // Un techo que se queda muy por encima de la realidad deja de vigilar. Si
    // esta falla, hay que BAJAR las constantes de arriba: es una buena noticia.
    const s = cuenta(TODO, esSombraDeTarjeta).n
    const g = cuenta(TODO, esDegradadoDeTarjeta).n
    expect(s, 'quedan menos sombras: baja TECHO_SOMBRAS').toBeGreaterThan(TECHO_SOMBRAS - 6)
    expect(g, 'quedan menos degradados: baja TECHO_DEGRADADOS').toBeGreaterThan(TECHO_DEGRADADOS - 6)
  })
})

describe('el primitivo Tarjeta es la receta, letra por letra', () => {
  /* Si alguien toca `Tarjeta`, cambia TODAS las tarjetas del rediseño a la vez.
     Por eso su receta se fija aquí contra el texto del paquete. */
  const fuente = readFileSync(join(RAIZ, 'components/cf/primitivos.jsx'), 'utf8')
  const tarjeta = fuente.slice(fuente.indexOf('export function Tarjeta'), fuente.indexOf('export function Tarjeta') + 700)

  it('fondo de tarjeta, no un color a mano', () => {
    expect(tarjeta).toMatch(/background:\s*'var\(--cf-card\)'/)
  })

  it('borde de 1px, que es lo que hace la separación', () => {
    expect(tarjeta).toMatch(/border:\s*'1px solid var\(--cf-border\)'/)
  })

  it('radio del token, no un número suelto', () => {
    expect(tarjeta).toMatch(/borderRadius:\s*'var\(--cf-r-card\)'/)
  })

  it('relleno 16 por 19, como dice la receta', () => {
    expect(tarjeta).toMatch(/'16px 19px'/)
  })

  it('y ninguna sombra', () => {
    expect(tarjeta).not.toMatch(/boxShadow|cf-card-shadow/)
  })
})
