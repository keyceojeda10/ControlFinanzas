// lib/__tests__/sin-margen.test.js
//
// LA PROP QUE SE CAE AL SUELO. Cuarta vez el mismo patrón en esta sesión:
//
//   · `onCrear` en Armazon        → el FAB se pulsaba y no hacía nada
//   · `onAvisos` en la cabecera   → la campana era decorativa
//   · nombre/rol/iniciales        → la barra lateral pintaba un avatar vacío
//   · `sinMargen` en Panel        → 40px de margen donde la lámina pide 20
//
// Siempre igual: la página pasa la prop, el componente no la declara, y NADA
// falla. No hay error, no hay aviso, no hay prueba en rojo. Solo queda mal, y en
// el caso del margen se nota tan poco que lo encontró el usuario mirando una
// captura, no yo midiendo.
//
// Esta prueba cierra ese agujero para la prop que más se repite: recorre las
// páginas del dashboard, mira a qué componente le pasan `sinMargen`, y comprueba
// que ese componente la declare. Es mecánico y cuesta nada mantenerlo.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/** Todos los .jsx bajo app/ y components/pantallas/. */
function archivos(dir, salida = []) {
  const abs = path.join(process.cwd(), dir)
  if (!fs.existsSync(abs)) return salida
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) archivos(rel, salida)
    else if (e.name.endsWith('.jsx')) salida.push(rel)
  }
  return salida
}

const PAGINAS = archivos('app')
const PANTALLAS = archivos('components/pantallas')

/** ¿A qué componentes se les pasa `sinMargen`? */
function quienRecibeSinMargen(fuente) {
  const recibe = new Set()
  // <Componente ... sinMargen ... />  — el nombre puede estar varias líneas antes.
  const re = /<([A-Z][A-Za-z0-9_]*)\b([^>]*?)\/?>/gs
  let m
  while ((m = re.exec(fuente))) {
    const [, nombre, props] = m
    if (/\bsinMargen\b/.test(props)) recibe.add(nombre)
  }
  return recibe
}

describe('`sinMargen`: quien la recibe, la usa', () => {
  const usos = []
  for (const p of PAGINAS) {
    const fuente = fs.readFileSync(path.join(process.cwd(), p), 'utf8')
    for (const comp of quienRecibeSinMargen(fuente)) usos.push({ pagina: p, comp })
  }

  it('hay usos que comprobar', () => {
    // Si el escaneo se rompe, la prueba pasaría vacía y en verde diciendo que
    // todo está bien. Es el mismo error que está tapando.
    expect(usos.length).toBeGreaterThan(0)
  })

  it('ningún componente recibe `sinMargen` sin declararla', () => {
    const rotos = []
    for (const { pagina, comp } of usos) {
      // Se busca el archivo del componente por nombre en components/pantallas.
      //
      // Y SI NO, POR EXPORT CON NOMBRE: no todo componente vive en un archivo
      // que se llama igual. `PanelCargando` es un export de `Cargando.jsx`, y
      // la prueba lo daba por inexistente — que es peor que no comprobarlo,
      // porque falla por el motivo equivocado y manda a buscar donde no es.
      const archivo = PANTALLAS.find((f) => path.basename(f, '.jsx') === comp)
        ?? PANTALLAS.find((f) => new RegExp(`export function ${comp}\\b`).test(fs.readFileSync(f, 'utf8')))
      if (!archivo) {
        rotos.push(`${comp} (usado en ${pagina}) no se encontró en components/pantallas`)
        continue
      }
      const fuente = fs.readFileSync(path.join(process.cwd(), archivo), 'utf8')
      if (!/\bsinMargen\b/.test(fuente)) {
        rotos.push(`${comp} recibe \`sinMargen\` en ${pagina} y NO la declara`)
      }
    }
    expect(rotos, rotos.join(' · ')).toEqual([])
  })
})

describe('el relleno lateral se pone UNA vez', () => {
  it('quien acepta `sinMargen` lo usa para soltar su relleno lateral', () => {
    // No basta con declarar la prop: hay que APLICARLA. Un componente que la
    // recibe y la ignora es exactamente el fallo original con un nombre nuevo.
    const rotos = []
    for (const f of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
      if (!/\bsinMargen\b/.test(fuente)) continue
      // Tiene que aparecer decidiendo el padding, no solo en la firma.
      if (!/sinMargen\s*\?/.test(fuente)) {
        rotos.push(`${path.basename(f)} declara \`sinMargen\` pero no decide el relleno con ella`)
      }
    }
    expect(rotos, rotos.join(' · ')).toEqual([])
  })
})

describe('el margen doble se detecta ANTES de que se vea', () => {
  // ── LA PRUEBA QUE FALTABA ──
  //
  // Las dos de arriba miran a quien RECIBE `sinMargen`. El fallo real es el
  // contrario: un componente que pone `--cf-pad-screen` de lado, se monta en una
  // página del dashboard —que ya da sus 20px con `px-5`— y NADIE le pasa la
  // prop. Nada avisa. La ficha del préstamo llevaba así desde que se montó y lo
  // encontró el usuario mirando una captura: «sale muy angosto, no en el ancho
  // normal de los otros elementos».
  //
  // Aquí se busca justo eso: montado + relleno lateral propio + sin prop.

  /** Componentes de pantalla montados en alguna página real (no en el banco). */
  function montadosEnPaginas() {
    const montados = new Map()   // nombre → página donde se monta
    for (const pagina of PAGINAS) {
      // El banco de pruebas SÍ los quiere a pantalla completa: ahí no hay
      // `px-5` de layout y el componente tiene que poner su propio relleno.
      if (pagina.includes('app/estilo/')) continue
      const fuente = fs.readFileSync(path.join(process.cwd(), pagina), 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      for (const m of fuente.matchAll(/<([A-Z][\w$]*)/g)) {
        if (!montados.has(m[1])) montados.set(m[1], pagina)
      }
    }
    return montados
  }

  it('nadie pone relleno lateral encima del que ya pone el armazón', () => {
    const montados = montadosEnPaginas()
    const rotos = []

    for (const f of PANTALLAS) {
      const nombre = path.basename(f, '.jsx')
      const pagina = montados.get(nombre)
      if (!pagina) continue                       // solo vive en el banco
      const fuente = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
      // ¿Pone relleno lateral propio? `padding: 'X var(--cf-pad-screen) Y'` o
      // `padding: '0 20px'` con el token.
      if (!/padding:\s*[`'"][^`'"]*var\(--cf-pad-screen\)/.test(fuente)) continue
      // ¿Lo suelta con `sinMargen`?
      if (/sinMargen\s*\?/.test(fuente)) continue
      rotos.push(`${nombre} pone --cf-pad-screen y se monta en ${pagina} sin poder soltarlo`)
    }

    expect(
      rotos,
      `margen doble (40px donde van 20): ${rotos.join(' · ')}. ` +
      'Declara `sinMargen` en el componente y pásasela desde la página.',
    ).toEqual([])
  })
})
